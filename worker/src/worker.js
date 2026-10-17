// Document proxy for the minibrowser: serves store pages from this origin so
// the app can iframe them (stores send X-Frame-Options) and so the injected
// scraper bundle runs same-origin with full DOM access. One request to this
// worker per page view — assets load direct from the store.
//
// The scraper bundle (scraper.inject.txt) is built from
// frontend/src/scraper/ by `npm run build:inject` — rebuild it after editing
// scraper.ts or the site configs.
import SCRAPER_JS from "./scraper.inject.txt";

// matchHosts from frontend/src/scraper/configs/*.json
const ALLOWED_HOSTS = [
  "us.brandymelville.com",
  "brandymelvilleusa.com",
  "us.subdued.com",
];

export default {
  async fetch(request) {
    const reqUrl = new URL(request.url);
    // Absolute base for rewritten links. Relative /p?u= links would resolve
    // against whatever host served the document (in dev, the Vite dev server,
    // whose SPA fallback would load the whole app inside the iframe) — always
    // emit the origin the request actually arrived at.
    const proxyBase = `${reqUrl.origin}/p?u=`;

    if (reqUrl.pathname === "/") {
      return html(`<!doctype html><p>Proxy up. Use /p?u=https://…</p>`);
    }

    if (reqUrl.pathname !== "/p") {
      return new Response("Not found", { status: 404 });
    }

    let target;
    try {
      target = new URL(reqUrl.searchParams.get("u"));
    } catch {
      return new Response("Bad ?u= URL", { status: 400 });
    }

    if (!ALLOWED_HOSTS.includes(target.hostname)) {
      return new Response("Host not allowed", { status: 403 });
    }

    // Cookies live in the browser's jar for the proxy origin (the "local user")
    // — the worker holds no state. Forward them back to the store each request.
    const res = await fetch(target, {
      headers: {
        "user-agent":
          request.headers.get("user-agent") ||
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        accept: "text/html,application/xhtml+xml",
        cookie: request.headers.get("cookie") || "",
      },
      redirect: "follow",
    });

    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("text/html")) {
      // Not a page (redirect landed on a PDF, image, etc.) — pass through raw
      return new Response(res.body, { headers: { "content-type": ctype } });
    }

    let htmlText = await res.text();

    // <base> at the store origin: runtime JS fetches (Shopify's
    // /cdn/shopifycloud/wpm etc.) resolve against the document origin — the
    // worker — unless we repoint the base. With this they load direct from
    // the store's CDN and the worker sees zero asset traffic. Static
    // attributes are already absolutized below, so <a> links stay proxied.
    const baseTag = `<base href="${target.origin}/">`;
    if (/<head[^>]*>/i.test(htmlText)) {
      htmlText = htmlText.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`);
    } else {
      htmlText = baseTag + htmlText;
    }

    // Strip CSP meta tags so the inline injected script is allowed to run.
    htmlText = htmlText.replace(
      /<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi,
      "",
    );

    // Absolutize every href to the direct store URL (covers relative and
// protocol-relative //host/… forms). Nothing is proxied yet.
    htmlText = htmlText.replace(
      /\bhref="(?!https?:|data:|#|mailto:|tel:)([^"]*)"/g,
      (_, p) => `href="${new URL(p, target).href}"`
    );

    // Only <a> navigation goes through the proxy — keeps the scraper alive
    // after clicks while stylesheets/fonts/icons load direct from the store's
    // CDN (1 worker request per page view instead of ~15+).
    // ponytail: <a[^>]*> match assumes no ">" inside attributes; Shopify
    // themes hold. If a store ever trips it, switch to a real HTML parser.
    htmlText = htmlText.replace(
      /(<a\b[^>]*?\bhref=")(https?:\/\/[^"]+)(")/g,
      (m, pre, abs, post) => {
        try {
          const u = new URL(abs);
          if (ALLOWED_HOSTS.includes(u.hostname)) {
            return `${pre}${proxyBase}${encodeURIComponent(u.href)}${post}`;
          }
        } catch { /* keep raw */ }
        return m;
      },
    );

    // Assets load direct from the site — no proxy request
    htmlText = htmlText.replace(
      /\b(src|action|poster)="(?!https?:|data:|#|\/\/)([^"]*)"/g,
      (_, a, p) => `${a}="${new URL(p, target).href}"`
    );

    // Inject the scraper (config-driven highlight + click-to-save postMessage)
    htmlText = htmlText.replace("</body>", `<script>${SCRAPER_JS}</script></body>`);

    const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
    // Pass the store's Set-Cookie through so the browser jar keeps session/
    // region/consent state and re-sends it automatically next request.
    // Rewrite to the proxy origin — a Domain= attr for the store's domain
    // would be rejected by the browser.
    // The worker origin sits in a CROSS-origin iframe (inside the app), so
    // cookies here are third-party: SameSite=Lax/Strict ones are dropped by
    // the browser entirely — which is why banners kept re-appearing. Rewrite
    // to SameSite=None; Secure so they're eligible in that context.
    // ponytail: one shared jar for all allowed hosts; name collisions between
    // stores are unlikely — per-store jars via KV only if a store ever breaks.
    for (const c of res.headers.getSetCookie()) {
      let cookie = c.replace(/;\s*domain=[^;]*/gi, "");
      cookie = cookie.replace(/;\s*samesite=(lax|strict)/gi, "; SameSite=None");
      if (!/;\s*secure/i.test(cookie)) {
        cookie += "; Secure";
      }
      headers.append("set-cookie", cookie);
    }
    // The worker owns these responses — CSP would block the injected script.
    headers.delete("content-security-policy");
    headers.delete("x-frame-options");
    return new Response(htmlText, { headers });
  },
};

function html(body) {
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
}
