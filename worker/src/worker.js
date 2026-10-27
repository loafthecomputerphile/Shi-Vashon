// Document proxy for the minibrowser: serves store pages from this origin so
// the app can iframe them (stores send X-Frame-Options) and so the injected
// scraper bundle runs same-origin with full DOM access. One request to this
// worker per page view — assets load direct from the store.
//
// The scraper bundle (scraper.inject.txt) is built from
// frontend/src/scraper/ by `npm run build:inject` — rebuild it after editing
// scraper.ts or the site configs.
import SCRAPER_JS from "./scraper.inject.txt";
import { norm, hashPassword, verifyPassword, makeToken, verifyToken } from "./auth.js";
import {
  getUser, putUser, deleteUser, getRequest, putRequest, deleteRequest,
  listRequests, listUsers, bumpLoginFail, clearLoginFails, bumpRequestCount,
  getUsage, bumpUsage,
} from "./kv.js";
import { sendOwnerEmail } from "./mail.js";

// matchHosts from frontend/src/scraper/configs/*.json
const ALLOWED_HOSTS = [
  "us.brandymelville.com",
  "brandymelvilleusa.com",
  "us.subdued.com",
];

// Session cookie name + lifetime (must match TOKEN_TTL_DAYS).
const COOKIE = "session";
const SESSION_TTL_DAYS = 7;

export default {
  async fetch(request, env) {
    const reqUrl = new URL(request.url);

    if (reqUrl.pathname.startsWith("/api/")) {
      // CORS preflight for the cross-origin Pages app.
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
      const res = await handleApi(request, env, reqUrl);
      const out = new Response(res.body, res);
      for (const [k, v] of Object.entries(corsHeaders(request))) out.headers.set(k, v);
      return out;
    }

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

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

// --- API section: accounts, sessions, generation quota ---

// Reads the signed session cookie. Returns the payload {e, a, exp} or null.
async function sessionFrom(request, env) {
  const cookies = request.headers.get("cookie") || "";
  const m = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  return verifyToken(decodeURIComponent(m[1]), env.AUTH_SECRET);
}

// Session cookie: HttpOnly so page JS can't read the token, Secure. The
// deployed app is on a different origin (Pages) than the worker, so the
// cookie must be SameSite=None to travel with cross-origin fetches — None
// requires Secure, which is fine since everything is https. (Dev uses the
// Vite proxy, same-origin, where Lax would also have worked.)
function sessionCookie(token) {
  const maxAge = SESSION_TTL_DAYS * 60 * 60 * 24;
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}; Path=/`;
}

const CLEAR_COOKIE = `${COOKIE}=; HttpOnly; Secure; SameSite=None; Max-Age=0; Path=/`;

// The app lives on Pages, the worker on *.workers.dev — different origins,
// so /api answers CORS. Cookies need an exact origin (not *) AND the cookie
// must be SameSite=None to travel cross-site. Only the deployed app's
// origins are allowed — no origin echo, other sites get nothing.
const APP_ORIGINS = [
  "https://shiahs-closet.pages.dev",
  // Preview deployments get a random subdomain — allow the whole pages.dev
  // family for this project only. ponytail: suffix match, not a full
  // hostnames allowlist; good enough while the project name is unguessable.
];
function corsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  const allowed = APP_ORIGINS.includes(origin) ||
    /^https:\/\/[a-z0-9-]+\.shiahs-closet\.pages\.dev$/.test(origin);
  if (!allowed) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "Content-Type",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    vary: "Origin",
  };
}

// Daily generation limit: admin (owner) is unlimited; per-user override
// otherwise the DAILY_LIMIT var.
function limitFor(env, user) {
  if (user.admin) return null;
  return user.limit ?? Number(env.DAILY_LIMIT || 4);
}

async function handleApi(request, env, reqUrl) {
  const path = reqUrl.pathname;
  const route = `${request.method} ${path}`;

  try {
    // --- public routes ---

    if (route === "POST /api/request") {
      const body = await request.json().catch(() => ({}));
      const email = norm(body.email);
      if (!email.includes("@")) return json({ error: "Enter a valid email." }, 400);
      const counter = await bumpRequestCount(env, email);
      if (counter.lockUntil > Date.now()) {
        return json({ error: "Too many requests — try again later." }, 429);
      }
      await putRequest(env, email, {
        email,
        note: String(body.note || "").slice(0, 500),
        ts: Date.now(),
      });
      await sendOwnerEmail(
        env,
        `Access request: ${email}`,
        `${email} requested access to Shiah's Closet.\n\nNote: ${body.note || "(none)"}\n\nApprove it in the app's Admin tab.`,
      );
      // Always ok — never reveal whether an account already exists.
      return json({ ok: true });
    }

    if (route === "POST /api/login") {
      const body = await request.json().catch(() => ({}));
      const email = norm(body.email);
      const user = await getUser(env, email);

      // One generic 401 for both "no user" and "wrong password" — no
      // account enumeration. The dummy verify keeps timing roughly even.
      const stored = user?.hash || (await hashPassword("dummy-" + email));
      const ok = await verifyPassword(String(body.password || ""), stored);
      if (!user || !ok) {
        const counter = await bumpLoginFail(env, email);
        if (counter.lockUntil > Date.now()) {
          const mins = Math.ceil((counter.lockUntil - Date.now()) / 60_000);
          return json({ error: `Too many failed logins — try again in ${mins} min.` }, 429);
        }
        return json({ error: "Wrong email or password." }, 401);
      }

      await clearLoginFails(env, email);
      const exp = Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
      const token = await makeToken({ e: email, a: user.admin ? 1 : 0, exp }, env.AUTH_SECRET);
      return json(
        { email, admin: !!user.admin },
        200,
        { "set-cookie": sessionCookie(token) },
      );
    }

    if (route === "POST /api/logout") {
      return json({ ok: true }, 200, { "set-cookie": CLEAR_COOKIE });
    }

    // --- authed routes ---

    if (route === "GET /api/me") {
      const session = await sessionFrom(request, env);
      if (!session) return json({ error: "Not logged in." }, 401);
      const user = await getUser(env, session.e);
      if (!user) return json({ error: "Account removed." }, 401);
      const limit = limitFor(env, user);
      return json({
        email: session.e,
        admin: !!user.admin,
        used: await getUsage(env, session.e),
        limit,
      });
    }

    // Model generation: the worker holds the OpenRouter key — the browser
    // never sees it. Body is passed through verbatim; quota is bumped
    // before the upstream call so a failed call still consumes a slot
    // (can't retry for free; ponytail simplification).
    if (route === "POST /api/generate") {
      const session = await sessionFrom(request, env);
      if (!session) return json({ error: "Not logged in." }, 401);
      const user = await getUser(env, session.e);
      if (!user) return json({ error: "Account removed." }, 401);

      const limit = limitFor(env, user);
      if (limit !== null) {
        const used = await bumpUsage(env, session.e);
        if (used > limit) {
          return json(
            { error: `Daily limit reached (${used - 1}/${limit}). Resets at midnight UTC.` },
            429,
          );
        }
      }

      const res = await fetch("https://openrouter.ai/api/v1/images", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_KEY}`,
          "Content-Type": "application/json",
        },
        body: request.body,
      });
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const parsed = await res.json();
          msg = parsed?.error?.message || msg;
        } catch { /* keep statusText */ }
        return json({ error: `Generation failed: ${msg}` }, 502);
      }
      return json(await res.json());
    }

    // --- admin routes (owner only) ---

    async function requireAdmin() {
      const session = await sessionFrom(request, env);
      if (!session) return { error: json({ error: "Not logged in." }, 401) };
      if (!session.a) return { error: json({ error: "Admin only." }, 403) };
      return { session };
    }

    if (route === "GET /api/admin/requests") {
      const gate = await requireAdmin();
      if (gate.error) return gate.error;
      return json({ requests: await listRequests(env) });
    }

    if (route === "GET /api/admin/users") {
      const gate = await requireAdmin();
      if (gate.error) return gate.error;
      // {email, hash, ...} → strip the hash before sending.
      const users = (await listUsers(env)).map(({ hash, ...rest }) => rest);
      return json({ users });
    }

    // Create (or reset) an account: {email, password, admin?, limit?}.
    if (route === "POST /api/admin/users") {
      const gate = await requireAdmin();
      if (gate.error) return gate.error;
      const body = await request.json().catch(() => ({}));
      const email = norm(body.email);
      if (!email.includes("@")) return json({ error: "Enter a valid email." }, 400);
      if (typeof body.password !== "string" || body.password.length < 6) {
        return json({ error: "Password needs at least 6 characters." }, 400);
      }
      const user = { hash: await hashPassword(body.password) };
      if (body.admin) user.admin = true;
      if (typeof body.limit === "number" && body.limit > 0) user.limit = body.limit;
      await putUser(env, email, user);
      await deleteRequest(env, email); // approved → drop the pending request
      return json({ ok: true });
    }

    if (request.method === "DELETE" && path.startsWith("/api/admin/users/")) {
      const gate = await requireAdmin();
      if (gate.error) return gate.error;
      const email = decodeURIComponent(path.slice("/api/admin/users/".length));
      await deleteUser(env, email);
      return json({ ok: true });
    }

    return json({ error: "Not found." }, 404);
  } catch (e) {
    console.error("api error:", e);
    return json({ error: "Something went wrong." }, 500);
  }
}
