# Architecture

Two flows to understand: how wardrobe data moves through the app, and how store pages get proxied + scraped.

## 1. Data flow: a click to the database

Everything runs in the browser. There is no server. SQLite (via wa-sqlite) runs inside a dedicated Web Worker and persists to OPFS (Origin-Private File System), which survives reloads and works offline.

```
Component (App.tsx, Shop.tsx, TryOn.tsx, Settings.tsx, Minibrowser.tsx)
    │  calls wardrobe.addClothing(...) etc.
    ▼
useWardrobe (hooks/useWardrobe.ts)
    │  plain async functions: write via db, then refresh() to reload all tables
    ▼
DBManager (db/DBManager.ts)  — exported singleton `db`
    │  concrete typed methods (addClothing, getAllOutfits, ...)
    │  each one does send(method, params) → a postMessage to the worker
    ▼
db/worker.ts  (Web Worker)
    │  listens for messages, dispatches through the `handlers` table
    │  to a function per method
    ▼
wa-sqlite + AccessHandlePoolVFS
    │  real SQL against one .sqlite file in OPFS
    ▼
the database file (OPFS)
```

Key details:

- **Single writer.** OPFS allows only one open handle pool, so all SQL lives in the one worker. The DBManager singleton (`db`) is pinned to `globalThis` so Vite hot reloads reuse the same worker connection instead of opening a second pool (which would throw `handle contention` — worker.ts retries briefly for this reason).
- **Protocol.** `db/protocol.ts` describes the message shape: `{ id, method, params }` down, `{ id, result?, error? }` up. The id lets DBManager match a response to the pending promise.
- **Migrations.** The worker reads `PRAGMA user_version` on boot and runs numbered migrations up to `DB_VERSION`. To add one: bump `DB_VERSION`, append a `case` that writes the new schema and sets `user_version`.
- **refresh() after every write.** `useWardrobe` never merges partial state; after any write it re-reads all five tables (clothing, outfits, cart, photos, tryons). Simple and always correct; the cost is a few extra reads per action, negligible locally.
- **Outfit rows.** Each outfit is one row with fixed columns per slot (top_id, bottom_id, hat_id, dress_id, jacket_id). The worker's `getAllOutfits` runs a 5-way LEFT JOIN against clothing and slices the flat row into `CLOTHING_WIDTH = 8`-column chunks starting at `OUTFIT_FIRST_SLOT_START = 2`.

## 2. Proxy + scraper flow (the Shop tab)

Store sites send `X-Frame-Options`/CSP headers that block iframing, so their pages are served through the Cloudflare worker (`worker/src/worker.js`):

```
Minibrowser.tsx
    │  <iframe src="{PROXY_URL}/p?u=https://store.example/...">
    ▼
Cloudflare worker (worker/src/worker.js)
    │  1. checks ?u= host against ALLOWED_HOSTS
    │  2. fetches the store page (forwarding your cookies + user-agent)
    │  3. rewrites the HTML (see below)
    │  4. injects <script>{SCRAPER_JS}</script> before </body>
    ▼
Store page running inside the iframe, same-origin with the worker
    │  scraper.inject.txt (built from frontend/src/scraper/ by build:inject)
    │  inject-entry.ts boots StoreScraper (scraper.ts):
    │    - finds the site config (SITE_CONFIGS from catalog.ts)
    │    - patches history.pushState/replaceState so navigation is tracked
    │    - highlights images matching the config's selectors
    │    - on click: extracts product info (JSON-LD first, DOM fallback)
    │    - classifies the item type (classifyType → TYPE_MAP)
    │    - postMessages the product to the parent window
    ▼
Minibrowser.tsx (message listener)
    │  handleProduct() → saveProduct (scraper/save.ts)
    │    1. dedupe check (scraper/dupe.ts — same URL, or same name+brand)
    │    2. download the image (proxy fallback via catalog.ts if direct fetch fails)
    │    3. wardrobe.addClothing(...)
    ▼
useWardrobe → DBManager → worker → SQLite   (same flow as section 1)
```

The worker's HTML rewrites, in order:

1. **`<base href="store-origin">`** injected at `<head>` — so the store's own runtime fetches (Shopify analytics etc.) load direct from the store's CDN, not through the proxy.
2. **CSP meta tags stripped** — otherwise the injected script would be blocked.
3. **All `href` values absolutized** to store-URLs.
4. **`<a>` navigations rewritten** to `/p?u=...` — only navigation is proxied, so one worker request per page view instead of one per asset.
5. **`src`/`action`/`poster` absolutized** — assets load direct.
6. **Set-Cookie rewrite** — `Domain=` stripped, `SameSite=Lax/Strict` forced to `SameSite=None; Secure`, because the worker origin is a cross-origin iframe context and those cookies would otherwise be dropped (that's why consent banners kept re-appearing).
7. **Response headers**: the worker deletes CSP and X-Frame-Options on its own responses, or the iframe would be blocked again.

## 3. Try-on flow

```
TryOn.tsx
    │  picks target body photo + item/outfit, resolves every image to a
    │  data URL (toDataUrl from scraper/catalog.ts) — the image API won't
    │  follow redirects for remote URLs
    ▼
OutfitImaginator (ai/api.ts) — class holding model + key + target image
    │  requestClothingImage(item) / requestImage(outfit)
    │  builds a prompt, calls OpenRouter's images endpoint
    ▼
result image → preview → "Set as my photo" (wardrobe.addPhoto) or Discard
```

The API key never leaves the device except in the OpenRouter request itself; it's stored in localStorage (`API_KEY_STORE`), not in SQLite.
