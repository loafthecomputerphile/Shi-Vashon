// inject-entry.ts — bundled as an IIFE and injected by the Cloudflare proxy
// worker into proxied store pages. Runs in the page's own context, so the
// scraper has full same-origin DOM access (the thing cross-origin iframes
// can never have).
import { SITE_CONFIGS } from "./catalog";
import { StoreScraper, type SiteConfig } from "./scraper";

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
history.pushState = ((s: unknown, t: string, u: string | URL | null | undefined) =>
  origPush(s as never, t, proxied(u))) as typeof history.pushState;
history.replaceState = ((s: unknown, t: string, u: string | URL | null | undefined) =>
  origReplace(s as never, t, proxied(u))) as typeof history.replaceState;

const config = StoreScraper.configForHost(
  new URL(storeHref()).host,
  SITE_CONFIGS as unknown as SiteConfig[],
);
if (config) {
  new StoreScraper(document, config, { getHref: storeHref }).init();
  // Tell the parent the scraper is alive and whether this is a product page —
  // without this the parent can't tell "no highlights by design" from
  // "the iframe escaped the proxy and nothing is injected".
  (window.parent ?? window).postMessage(
    {
      source: "scraper-status",
      page: storeHref(),
      productPage: new URL(storeHref()).pathname.includes(config.isProductPage.urlPattern),
    },
    "*",
  );
} else {
  (window.parent ?? window).postMessage(
    { source: "scraper-status", page: storeHref(), productPage: false, noConfig: true },
    "*",
  );
}

// Parent acks a successful save so the clicked image can flash blue.
window.addEventListener("message", (e) => {
  const d = e.data as { source?: string; image?: string };
  if (d?.source !== "scrape-saved" || !d.image) return;
  const target = [...document.querySelectorAll<HTMLImageElement>("img")].find(
    (i) => (i.currentSrc || i.src) === d.image,
  );
  if (!target) return;
  const prev = target.style.outlineColor;
  target.style.outlineColor = "#1e90ff";
  setTimeout(() => {
    target.style.outlineColor = prev;
  }, 600);
});
