# Shiah's Closet

Wardrobe PWA: mini shopping browser, clothing library, outfit builder and AI try-on that runs entirely in the browser. No server, no backend — everything lives on the device.

## Stack

- React 19 + Vite 8 + Tailwind 4 + TypeScript (shadcn vendored in `frontend/src/components/ui/`)
- **wa-sqlite + OPFS** — real SQLite running in a web worker, persisted to the browser's Origin-Private File System
- **Cloudflare Worker** (`worker/`) — proxies store pages so the minibrowser can iframe them and the injected scraper runs same-origin
- **OpenRouter** — image generation for try-on (user supplies their own API key in Settings)
- vite-plugin-pwa — installable, offline-capable app shell

## Develop

```sh
# terminal 1: the proxy worker (optional, only needed for the Shop tab)
cd worker && npm install && npm run dev        # wrangler on :8787

# terminal 2: the app
cd frontend && npm install && npm run dev
```

In dev, the Vite dev server forwards `/p` to the wrangler worker (see `frontend/vite.config.js`), so no env setup is needed. For a deployed frontend, set `VITE_PROXY_URL=https://<your-worker>.workers.dev` in `frontend/.env`.

## Build

The scraper bundle is compiled separately from the app: `npm run build:inject` turns `frontend/src/scraper/` into a single self-contained JS file at `worker/src/scraper.inject.txt`, which the proxy worker injects into store pages. The full build always runs it first:

```sh
cd frontend
npm run build        # = npm run build:inject && vite build
npm run preview
```

**Re-run `build:inject` after editing anything in `frontend/src/scraper/`** — the app build embeds it too, but the worker only picks it up when you redeploy (`cd worker && npm run deploy`).

## Docs

- [`docs/architecture.md`](docs/architecture.md) — how a click travels through the app; the proxy + scraper injection flow
- [`docs/file-guide.md`](docs/file-guide.md) — one-sentence role per file
- [`docs/how-to/add-a-store.md`](docs/how-to/add-a-store.md) — add another store to the Shop tab
- [`docs/how-to/add-a-setting.md`](docs/how-to/add-a-setting.md) — wire up a new setting end to end
