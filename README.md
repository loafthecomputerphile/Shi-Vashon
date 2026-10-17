# Shiah's Closet

Wardrobe PWA: mini shopping browser, clothing library, outfit builder and AI try-on that runs entirely in the browser.

## Stack

- React 19 + Vite 8 + Tailwind 4 (shadcn, base-vega theme)
- **wa-sqlite + OPFS** — real SQLite in a web worker, persisted to the browser's Origin-Private File System. No server, no backend.
- vite-plugin-pwa — installable, offline-capable app shell

## Develop

```sh
cd frontend
npm install
npm run dev
```

## Build

```sh
cd frontend
npm run build
npm run preview
```

## Worker

`worker/` is a Cloudflare Worker that proxies store pages so the minibrowser can iframe them (stores send `X-Frame-Options`) and the injected scraper runs same-origin.

```sh
cd worker
npm install
npx wrangler dev      # local dev
npx wrangler deploy   # deploy
```

The scraper bundle (`worker/src/scraper.inject.txt`) is built from `frontend/src/scraper/` with `npm run build:inject` — rebuild it after editing the scraper or site configs.

## Browser requirements

Data lives in OPFS, which needs a secure context (https, or localhost in dev) and a Chromium-based browser (Chrome/Edge 102+). Data is per-browser — there is no sync.
