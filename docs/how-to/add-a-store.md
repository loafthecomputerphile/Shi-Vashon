# How to add a store

Adding a store means: write a config JSON, allow its host in the proxy worker, rebuild the scraper bundle.

## 1. Write the config

Create `frontend/src/scraper/configs/<store-name>.json` next to the existing `brandy-melville.json` / `subdued.json`. Shape:

```json
{
  "site": "store-name",
  "brand": "Store Name",
  "matchHosts": ["store.example.com", "www.store.example.com"],
  "imageSelector": "css selector for product images on any page",
  "productPageSelector": "css selector that only exists on a product page",
  "priceSelector": "css selector for the price element"
}
```

Notes:

- `matchHosts` drives two things: the `ALLOWED_HOSTS` check in the worker and which config `StoreScraper` picks for the page (see `configForHost` in `scraper.ts`).
- The image selector should match product images only — the scraper outlines exactly what it matches, so open a category page and check the highlight is not over-broad.
- `productPageSelector` tells the scraper whether the user is on a product page (status chip in the minibrowser shows "product page" vs "not a product page").

## 2. Allow the host in the proxy worker

Add every host from `matchHosts` to `ALLOWED_HOSTS` in `worker/src/worker.js`:

```js
const ALLOWED_HOSTS = [
  "us.brandymelville.com",
  "brandymelvilleusa.com",
  "us.subdued.com",
  "store.example.com",          // new
  "www.store.example.com",      // new
];
```

Without this the worker returns 403 and the minibrowser shows "Scraper not detected".

## 3. Rebuild the scraper bundle

The injected script is a build artifact — the worker never sees your source changes until you rebuild and redeploy:

```sh
cd frontend
npm run build:inject           # rewrites worker/src/scraper.inject.txt

cd ../worker
npm run deploy                 # if you're testing the deployed worker
# or nothing to do — `wrangler dev` serves the file from disk
```

`SITE_CONFIGS` in `frontend/src/scraper/catalog.ts` is loaded from the configs folder at build time, so a new JSON file appears automatically in the Shop tab's store tabs.

## 4. Test

1. `npm run dev` in both `worker/` and `frontend/`.
2. Shop tab → pick the new store tab.
3. Check the status chip says "Scraper live · product page" on a product page.
4. Click a highlighted image → the item should land in the wardrobe with name, brand, price and image.
5. Click the same image again → toast should say "Already in wardrobe" (the dupe check in `scraper/dupe.ts`).

If extraction comes up empty, look at how the store exposes data: `StoreScraper.extractProduct` tries JSON-LD first, then falls back to DOM selectors — a store with neither needs a new branch there.
