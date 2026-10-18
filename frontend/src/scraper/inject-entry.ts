// inject-entry.ts — bundled as an IIFE and injected by the Cloudflare proxy
// worker into proxied store pages. Runs in the page's own context, so the
// scraper has full same-origin DOM access (the thing cross-origin iframes
// can never have).
import { SITE_CONFIGS } from "./catalog";
import { StoreScraper } from "./scraper";

// Proxied pages live at https://<worker>/p?u=<store-url> — unwrap the real
// store URL so the scraper sees the store's own paths.
function storeHref(): string {
  if (location.pathname === "/p") {
    const u = new URL(location.href).searchParams.get("u");
    if (u) return u;
  }
  return location.href;
}

// The store's own SPA calls history.pushState("/products/x") — on the worker
// origin that would blow the URL out of the proxy. Rewrite same-origin
// navigations into /p?u= form BEFORE the scraper wraps pushState, so the two
// patches compose (scraper calls the wrapper we install here).
const origPush = history.pushState.bind(history);
const origReplace = history.replaceState.bind(history);

// Turn a store URL into a proxied /p?u=... URL when it points at this same
// origin (i.e. it's a store page served by the worker). Other URLs pass
// through untouched.
function proxied(u: string | URL | null | undefined): string | URL | undefined {
  if (u == null) return undefined;
  try {
    const abs = new URL(String(u), storeHref());
    if (abs.origin === location.origin && abs.pathname !== "/p") {
      // Absolute proxy URL — relative /p?u= would resolve against whatever
      // host served this document, which in dev is not the worker.
      return `${location.origin}/p?u=${encodeURIComponent(abs.href)}`;
    }
    return String(u);
  } catch {
    return u;
  }
}

// Same arguments as the real pushState/replaceState; only the url argument
// is rewritten first. `data` and `unused` are just passed through.
function proxiedPush(data: unknown, unused: string, url?: string | URL | null): void {
  origPush(data, unused, proxied(url));
}
function proxiedReplace(data: unknown, unused: string, url?: string | URL | null): void {
  origReplace(data, unused, proxied(url));
}
history.pushState = proxiedPush;
history.replaceState = proxiedReplace;

const config = StoreScraper.configForHost(new URL(storeHref()).host, SITE_CONFIGS);
if (config) {
  new StoreScraper(document, config, { getHref: storeHref }).init();
  // Tell the parent the scraper is alive and whether this is a product page —
  // without this the parent can't tell "no highlights by design" from
  // "the iframe escaped the proxy and nothing is injected".
  const status = {
    source: "scraper-status",
    page: storeHref(),
    productPage: new URL(storeHref()).pathname.includes(config.isProductPage.urlPattern),
  };
  window.parent.postMessage(status, "*");
} else {
  const status = { source: "scraper-status", page: storeHref(), productPage: false, noConfig: true };
  window.parent.postMessage(status, "*");
}

// Parent acks a successful save so the clicked image can flash blue.
window.addEventListener("message", (e) => {
  const d = e.data as { source?: string; image?: string };
  if (d?.source !== "scrape-saved" || !d.image) return;

  // Find the <img> on the page whose src matches the saved product image.
  let target: HTMLImageElement | null = null;
  for (const img of document.querySelectorAll<HTMLImageElement>("img")) {
    if ((img.currentSrc || img.src) === d.image) {
      target = img;
      break;
    }
  }
  if (!target) return;

  const prev = target.style.outlineColor;
  target.style.outlineColor = "#1e90ff";
  setTimeout(() => {
    target.style.outlineColor = prev;
  }, 600);
});
