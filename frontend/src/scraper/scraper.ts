// scraper.ts — runs INSIDE the iframe (same context as the store page). The
// parent page can never read a cross-origin iframe's DOM, so this script must
// be injected/executed in the iframe itself. ExternalIframe already has
// sandbox="allow-scripts allow-same-origin" — for a cross-origin src that
// combo is fine; the trick is getting this code into the iframe (see mount()).
//
// Flow: init() -> highlight product images with a green outline. Clicking a
// highlighted image scrapes THAT product and postMessages it to the parent.
import type { ClothingType } from "../types";

// --- Types (mirror the JSON config files) -----------------------------------

export interface SiteConfig {
  site: string;
  brand: string;
  matchHosts: string[];
  isProductPage: { urlPattern: string; jsonLdType: string };
  jsonLd: { use: boolean; type: string; notes?: string };
  selectors: {
    productUrl: string | null;
    name: string | null;
    image: string | null;
    type: string | null;
    price?: string | null;
  };
  fallbacks?: Partial<Record<"image" | "name" | "url", string>>;
  // Cookie-banner auto-accept: click the accept button and hide the banner.
  // `hide` selectors are display:none'd; `accept` selectors are clicked once
  // per page load (the consent cookie itself persists via the proxy jar).
  cookieBanner?: { accept?: string[]; hide?: string[] };
  notes?: string[];
}

export interface ScrapedProduct {
  url: string | null;
  image: string | null;
  name: string | null;
  type: ClothingType | null; // null = couldn't classify (caller rejects e.g. shoes)
  brand: string | null;
}

// Message the iframe posts to the parent on a highlighted-image click.
export interface ScraperMessage {
  source: "store-scraper";
  product: ScrapedProduct;
}

export const SCRAPER_SOURCE = "store-scraper";

// Common consent platforms — covers most Shopify + OneTrust-family banners
// without per-site config. Site configs add their own selectors on top.
// ponytail: best-effort selector lists; a store with a custom banner just
// gets a new selector in its config when noticed.
const GENERIC_BANNER_ACCEPT = [
  "#onetrust-accept-btn-handler",
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  ".osano-cm-accept-all",
  ".cky-btn-accept",
  ".iubenda-cs-accept-btn",
  "[data-cookiescript='accept']",
  ".gdpr-cookie-accept",
  "#cookie-action-ok",
  // Shopify's own privacy & compliance banner (default on most Shopify themes)
  "#shopify-pc__banner__btn-accept",
  ".klaro .cm-btn-accept-all",
  "#cmplz-accept-all",
  "#BorlabsCookieBox .brlbs-btn-accept-all",
];
const GENERIC_BANNER_HIDE = [
  "#onetrust-banner-sdk",
  "#onetrust-consent-sdk",
  "#CybotCookiebotDialog",
  "#CybotCookiebotDialogBodyUnderlay",
  ".osano-cm-window",
  ".cky-consent-container",
  ".iubenda-cs-banner",
  ".cookie-banner",
  ".cookie-consent",
  "#cookie-banner",
  "#cookie-consent",
  "#shopify-pc__banner",
  "#shopify-pc__dialog",
  "#shopify-pc__prefs-dialog",
  // CMPs that render into a shadow root — hiding the host covers everything
  "#usercentrics-root",
  "#klaro",
  "#tarteaucitronRoot",
  "#cmplz-cookiebanner-container",
  "#BorlabsCookieBox",
];

// Map clothing keywords -> OutfitSlot types (frontend/src/types.ts). Keys are
// valid ClothingType values; anything unmatched (incl. shoes) -> null.
const TYPE_MAP: Record<ClothingType, string[]> = {
  top:    ["top", "tee", "t-shirt", "shirt", "blouse", "sweater", "hoodie", "tank", "crop", "pullover", "sweatshirt", "button-up", "polo"],
  bottom: ["pants", "jeans", "skirt", "shorts", "sweatpant", "legging", "trouser", "cargo"],
  hat:    ["hat", "beanie", "cap", "bucket"],
  dress:  ["dress", "gown", "romper", "jumpsuit"],
  jacket: ["jacket", "coat", "cardigan", "blazer", "puffer", "parka", "bomber", "windbreaker"],
};

const HIGHLIGHT_CLASS = "store-scraper-highlight";

// Keyword classifier, shared with the catalog fetcher (scraper/catalog.ts).
export function classifyType(text: string): ClothingType | null {
  const lower = text.toLowerCase();
  for (const [type, values] of Object.entries(TYPE_MAP)) {
    // keyword contained IN the page text (e.g. "tina crop top" matches "crop").
    if (values.some(k => lower.includes(k))) return type as ClothingType;
  }
  return null;
}
const HIGHLIGHT_STYLE = `
.${HIGHLIGHT_CLASS} {
  outline: 3px solid #00c853 !important;
  outline-offset: 2px !important;
  cursor: pointer !important;
}
.${HIGHLIGHT_CLASS}:hover { outline-color: #ff3b30 !important; }
.store-scraper-parent { position: relative !important; }
/* Host span: site CSS may still out-specify us even with !important, so the
   button itself lives in a shadow root where page styles can't reach it.
   The host only needs pinning to the image container's top-right corner. */
.store-scraper-save-host {
  position: absolute !important;
  top: 6px !important;
  right: 6px !important;
  left: auto !important;
  bottom: auto !important;
  width: auto !important;
  height: auto !important;
  min-width: 0 !important;
  min-height: 0 !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
  display: block !important;
  z-index: 2147483647 !important;
}
`;

/* Styles for the button INSIDE the shadow root — site stylesheets have zero
   effect in here, so no !important wars. */
const SAVE_BUTTON_STYLE = `
button {
  display: inline-block;
  width: auto;
  height: auto;
  padding: 3px 8px;
  background: #f4eee0;
  color: #3f3830;
  border: 1px solid #3f3830;
  border-radius: 0;
  font: 600 10px/1.2 InterVariable, Inter, system-ui, sans-serif;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
}
button:hover {
  background: #3f3830;
  color: #f4eee0;
}
`;

export class StoreScraper {
  private doc: Document;
  private config: SiteConfig;
  // Where the "page" really lives. On a proxied page (/p?u=<store-url>) the
  // store URL is in the query string, not location — inject-entry passes a
  // getter that unwraps it; plain iframes use the location.href default.
  private getHref: () => string;
  // The window the document belongs to. Set in init(); lets init/destroy
  // talk about "the window" without ?? and ! everywhere.
  private view: Window | null = null;
  private navObserver: MutationObserver | null = null;
  private navTimer: ReturnType<typeof setTimeout> | null = null;
  private origPush: typeof history.pushState | null = null;
  private origReplace: typeof history.replaceState | null = null;
  private onNav: () => void;
  private onImageClick: (e: Event) => void;
  private styleEl: HTMLStyleElement | null = null;
  private bannerStyleEl: HTMLStyleElement | null = null;

  constructor(doc: Document, config: SiteConfig, opts: { getHref?: () => string } = {}) {
    this.doc = doc;
    this.config = config;
    this.getHref = opts.getHref ?? (() => location.href);

    this.onNav = () => {
      // Debounce: SPA routes fire several pushState calls mid-transition.
      if (this.navTimer) clearTimeout(this.navTimer);
      this.navTimer = setTimeout(() => this.onPageSettled(), 300);
    };

    this.onImageClick = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      // currentTarget is the element the listener is attached to — we only
      // ever attach this listener to <img> elements, hence the type below.
      this.scrape(e.currentTarget as HTMLImageElement);
    };
  }

  // Scrape the product the clicked/selected image belongs to, preferring that
  // image (it's the variant/thumbnail the user actually chose).
  private scrape(img: HTMLImageElement) {
    const product = this.extractProduct(img.currentSrc || img.src);
    if (product) {
      const message: ScraperMessage = { source: SCRAPER_SOURCE, product };
      (this.doc.defaultView?.parent ?? window).postMessage(message, "*");
    }
  }

  static configForHost(host: string, configs: SiteConfig[]): SiteConfig | null {
    // matchHosts are exact hostnames — require a real match, not substring.
    for (const config of configs) {
      for (const matchHost of config.matchHosts) {
        if (host === matchHost || host.endsWith("." + matchHost)) return config;
      }
    }
    return null;
  }

  // --- Lifecycle ------------------------------------------------------------

  init() {
    const view = this.doc.defaultView;
    if (!view) return; // no window (detached document) — can't hook anything

    this.injectStyles();

    // SPA nav hooking: patch history + watch for re-renders, then re-run
    // detect/extract/highlight after each settled navigation.
    this.view = view;
    const origPush = view.history.pushState.bind(view.history);
    const origReplace = view.history.replaceState.bind(view.history);
    this.origPush = origPush;
    this.origReplace = origReplace;
    view.history.pushState = (...args) => {
      origPush(...args);
      this.onNav();
    };
    view.history.replaceState = (...args) => {
      origReplace(...args);
      this.onNav();
    };
    view.addEventListener("popstate", this.onNav);

    this.navObserver = new MutationObserver(this.onNav);
    this.navObserver.observe(this.doc.body, { childList: true, subtree: true });

    this.onPageSettled();
  }

  destroy() {
    this.clearHighlights();
    this.styleEl?.remove();
    this.styleEl = null;
    this.bannerStyleEl?.remove();
    this.bannerStyleEl = null;
    this.navObserver?.disconnect();
    this.navObserver = null;
    if (this.navTimer) clearTimeout(this.navTimer);
    const view = this.view;
    if (view) {
      if (this.origPush) view.history.pushState = this.origPush;
      if (this.origReplace) view.history.replaceState = this.origReplace;
      view.removeEventListener("popstate", this.onNav);
    }
  }

  private onPageSettled() {
    this.killCookieBanner();
    if (this.detectProductPage()) this.highlightImages();
    else this.clearHighlights();
  }

  // Auto-accept consent banners: click accept buttons, hide banner containers.
  // Runs on every settled page load; the consent cookie itself persists in the
  // proxy jar, so this is usually a no-op after the first visit.
  private killCookieBanner() {
    const hide = [...GENERIC_BANNER_HIDE, ...(this.config.cookieBanner?.hide ?? [])];
    if (!this.bannerStyleEl) {
      this.bannerStyleEl = this.doc.createElement("style");
      this.doc.head.appendChild(this.bannerStyleEl);
    }
    this.bannerStyleEl.textContent = hide.map((s) => `${s}{display:none!important}`).join("\n");
    const accept = [...GENERIC_BANNER_ACCEPT, ...(this.config.cookieBanner?.accept ?? [])];
    for (const sel of accept) {
      for (const el of this.doc.querySelectorAll<HTMLElement>(sel)) el.click();
    }
  }

  detectProductPage(): boolean {
    // URL pattern alone false-positives on 404s/redirects — require actual
    // product data (JSON-LD or the name selector) too.
    const pageUrl = new URL(this.getHref());
    if (!pageUrl.pathname.includes(this.config.isProductPage.urlPattern)) return false;
    const nameSelector = this.config.selectors.name;
    if (nameSelector) {
      if (this.doc.querySelector(nameSelector) !== null) return true;
    }
    return this.parseJsonLd() !== null;
  }

  // --- Highlighting ---------------------------------------------------------

  private injectStyles() {
    if (this.styleEl) return;
    this.styleEl = this.doc.createElement("style");
    this.styleEl.textContent = HIGHLIGHT_STYLE;
    this.doc.head.appendChild(this.styleEl);
  }

  highlightImages() {
    this.clearHighlights();
    // Candidates: the config's image selector (matches gallery/thumbnails on
    // product pages). Anything it matches is user-pickable.
    const sel = this.config.selectors.image;
    if (!sel) return;
    for (const img of this.doc.querySelectorAll<HTMLImageElement>(sel)) {
      if (!img.currentSrc && !img.src) continue; // lazy placeholders
      img.classList.add(HIGHLIGHT_CLASS);
      img.addEventListener("click", this.onImageClick);
      // Visible save affordance: a shadow-DOM host span pinned top-right, so
      // the store's own stylesheet can never stretch or restyle the button.
      const parent = img.parentElement;
      if (parent) {
        parent.classList.add("store-scraper-parent");
        this.addSaveButton(parent, img);
      }
    }
  }

  // Build the "+ Save" button that sits on top of one product image.
  // It lives inside a shadow root so the store's own CSS can't touch it.
  private addSaveButton(parent: HTMLElement, img: HTMLImageElement) {
    const host = this.doc.createElement("span");
    host.className = "store-scraper-save-host";
    const shadow = host.attachShadow({ mode: "open" });

    const style = this.doc.createElement("style");
    style.textContent = SAVE_BUTTON_STYLE;
    shadow.appendChild(style);

    const btn = this.doc.createElement("button");
    btn.type = "button";
    btn.textContent = "+ Save";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Immediate in-frame feedback: flip the button label briefly.
      btn.textContent = "✓ Saved";
      setTimeout(() => {
        btn.textContent = "+ Save";
      }, 1500);
      this.scrape(img);
    });
    shadow.appendChild(btn);

    parent.appendChild(host);
  }

  clearHighlights() {
    for (const img of this.doc.querySelectorAll("." + HIGHLIGHT_CLASS)) {
      img.classList.remove(HIGHLIGHT_CLASS);
      img.removeEventListener("click", this.onImageClick);
      img.parentElement?.classList.remove("store-scraper-parent");
    }
    for (const btn of this.doc.querySelectorAll(".store-scraper-save-host")) {
      btn.remove();
    }
  }

  // --- Extraction -----------------------------------------------------------

  extractProduct(pickedImage?: string | null): ScrapedProduct | null {
    // 1. JSON-LD first (most stable, survives redesigns). BM fields: name,
    //    url, image (ARRAY — take [0]), brand.name. No category -> type null.
    const ld = this.parseJsonLd();

    let url: string | null = null;
    if (ld && typeof ld.url === "string") url = ld.url;

    let image: string | null = null;
    if (pickedImage) {
      image = pickedImage;
    } else if (ld) {
      if (typeof ld.image === "string") {
        image = ld.image;
      } else if (Array.isArray(ld.image) && typeof ld.image[0] === "string") {
        image = ld.image[0];
      }
    }

    let name: string | null = null;
    if (ld && typeof ld.name === "string") name = ld.name;

    let brand: string | null = null;
    if (ld) {
      const rawBrand = ld.brand;
      if (typeof rawBrand === "string") {
        brand = rawBrand;
      } else if (rawBrand && typeof rawBrand === "object" && "name" in rawBrand) {
        brand = String((rawBrand as { name: unknown }).name);
      }
    }

    // 2. CSS selectors as fallback for anything JSON-LD missed.
    if (!name) name = this.pick("name", false);
    if (!image) image = this.pick("image", true);
    if (!url) {
      url = this.doc.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? this.getHref();
      // Strip variant query params for a clean product URL.
      try { const u = new URL(url); u.search = ""; url = u.href; } catch { /* keep raw */ }
    }

    // 3. Type: name + breadcrumb text through TYPE_MAP. null = rejected (shoes).
    const texts: string[] = [];
    if (name) texts.push(name);
    const breadcrumb = this.pick("type", false);
    if (breadcrumb) texts.push(breadcrumb);
    const type = this.typeFromText(texts.join(" "));
    if (type === null) return null; // no shoes / unclassifiable -> skip

    // 4. Contract shape; null only if nothing at all was extractable.
    if (!url && !image && !name) return null;
    return { url, image, name, type, brand: brand ?? this.config.brand };
  }

  // Look up a field using the config's selector, then its fallback selector.
  // isImg: return the image src attribute (absolute-ized) instead of the
  // element's text.
  private pick(field: "name" | "image" | "type", isImg: boolean): string | null {
    const sel = this.config.selectors[field];
    if (sel) {
      const v = this.fromSelector(sel, isImg);
      if (v) return v;
    }
    // "type" has no fallback selector — only name/image do.
    if (field === "type") return null;
    const fb = this.config.fallbacks?.[field];
    if (fb) return this.fromSelector(fb, isImg);
    return null;
  }

  // Find the JSON-LD block the config asks for (e.g. "@type": "Product").
  // Pages can have several; malformed ones are skipped, not fatal.
  private parseJsonLd(): Record<string, unknown> | null {
    const scripts = this.doc.querySelectorAll('script[type="application/ld+json"]');
    const want = this.config.jsonLd.type;

    for (const s of scripts) {
      let data: unknown;
      try {
        data = JSON.parse(s.textContent ?? "");
      } catch {
        continue; // malformed block on the page — skip it, don't crash
      }
      if (typeof data !== "object" || data === null) continue;

      const obj = data as Record<string, unknown>;
      // @type can be a single string ("Product") or a list of strings.
      const rawType = obj["@type"];
      const types: unknown[] = Array.isArray(rawType) ? rawType : [rawType];
      if (types.includes(want)) return obj;
    }
    return null;
  }

  // Run a CSS selector and pull out either the image src or the text.
  private fromSelector(selector: string, isImg: boolean): string | null {
    const el = this.doc.querySelector(selector);
    if (!el) return null;

    if (isImg || el.tagName === "IMG") {
      const src = el.getAttribute("src") ?? el.getAttribute("content");
      if (!src) return null;
      return this.absUrl(src);
    }

    const text = el.textContent?.trim();
    return text ? text : null;
  }

  private typeFromText(text: string): ClothingType | null {
    return classifyType(text)
  }

  // Make an image src absolute (e.g. "/media/x.jpg" -> full URL).
  private absUrl(src: string): string {
    if (src.startsWith("//")) return "https:" + src;
    try {
      return new URL(src, this.getHref()).href;
    } catch {
      return src;
    }
  }

  // --- Self-check (smallest thing that fails if parsing logic breaks) -------

  selfCheck(): boolean {
    // Trimmed copy of BM's real JSON-LD Product block shape.
    const sample = JSON.stringify({
      "@type": "Product",
      name: "Tina Top",
      url: "https://us.brandymelville.com/products/tina-top",
      image: ["https://us.brandymelville.com/media/tina-top.jpg"],
      brand: { "@type": "Brand", name: "Brandy Melville" },
      offers: [{ price: "13.00", priceCurrency: "USD" }],
    });
    const script = this.doc.createElement("script");
    script.type = "application/ld+json";
    script.textContent = sample;
    this.doc.head.appendChild(script);
    const p = this.extractProduct();
    script.remove();

    const ok =
      p?.name === "Tina Top" &&
      p.image?.startsWith("https://") === true &&
      p.brand === "Brandy Melville" &&
      p.type === "top";
    if (!ok) console.error("scraper selfCheck FAILED", p);
    return ok;
  }
}

// Parent-side listener: put this in the app once per ExternalIframe mount.
export function onScrapedProduct(
  e: MessageEvent,
  onProduct: (p: ScrapedProduct) => void,
) {
  // MessageEvent.data is untyped, so this cast states the shape we expect.
  // The source check below is what actually proves it's our message.
  const d = e.data as ScraperMessage;
  if (d?.source === SCRAPER_SOURCE) onProduct(d.product);
}
