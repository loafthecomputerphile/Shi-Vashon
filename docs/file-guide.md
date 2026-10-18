# File guide

One line per file. Paths are relative to the repo root.

## Frontend — app shell & screens

| File | Role |
|---|---|
| `frontend/src/main.jsx` | Vite entry: mounts React, registers the PWA service worker. |
| `frontend/src/App.tsx` | Top-level layout: sidebar navigation, which tab is shown, undo toasts, brand/market filter values. |
| `frontend/src/components/Shop.tsx` | Shop tab: store tabs + the embedded Minibrowser. |
| `frontend/src/components/Minibrowser.tsx` | Iframes a store through the proxy, listens for scraper product messages, runs the save flow. |
| `frontend/src/components/TryOn.tsx` | Try-on screen: target photo picker, item/outfit picker, AI generation + result preview. |
| `frontend/src/components/Settings.tsx` | Settings: accent theme swatches, OpenRouter API key, body photo manager, clear-all-data. Exports `API_KEY_STORE`, `initTheme`, `applyTheme`. |

## Frontend — reusable kit (`components/kit/`)

| File | Role |
|---|---|
| `kit/buttons.tsx` | IconButton, LoadingButton, ConfirmButton (two-step delete button). |
| `kit/feedback.tsx` | useToast + Toast, EmptyState, SpinnerOverlay, StatusChip, count badge. |
| `kit/fields.tsx` | FieldLabel, PasswordField, FilePickButton (hidden input + cloned trigger), SwatchPicker. |
| `kit/layout.tsx` | Layout helpers (containers/dividers). |
| `kit/tabs.tsx` | UnderlineTabs and pill style classes. |
| `kit/tiles.tsx` | Image tiles: ImageTile, TileCaption, CollageTile, DeletableImageThumb, Heading. |

## Frontend — vendored UI primitives (`components/ui/`)

shadcn/ui components + two project-specific ones. Header-commented `vendored shadcn/ui — edit carefully`; regenerate rather than hand-edit where possible.

`badge, button, command (cmdk wrapper used by filterBar), dialog, input, input-group, popover, separator, sheet, sidebar, skeleton, textarea, tooltip` — vendored shadcn/ui.
`clothingGrid.tsx` — the item grid shared by wardrobe and pickers.
`filterBar.tsx` — search + filter pills panel built on command/popover.

## Frontend — data layer (`db/`)

| File | Role |
|---|---|
| `db/protocol.ts` | Message types shared by DBManager and the worker (`DbRequest`/`DbResponse`, method names). |
| `db/DBManager.ts` | Browser-side client: one method per DB operation; sends a message to the worker and awaits the matching response. Exported singleton `db` (pinned to globalThis for HMR). |
| `db/worker.ts` | The web worker: opens wa-sqlite + OPFS, runs migrations, dispatches each message method to a handler, maps SQL rows to app types. |

## Frontend — scraper (runs inside store pages)

| File | Role |
|---|---|
| `scraper/scraper.ts` | `StoreScraper` class: config-driven image highlighting, history patching, JSON-LD/DOM product extraction, type classification, Shadow-DOM save button. |
| `scraper/inject-entry.ts` | Bundle entry for the injected script: patches history API, boots the scraper, wires postMessage. |
| `scraper/catalog.ts` | `SITE_CONFIGS` loader (per-store JSON configs) + `toDataUrl`/proxy image fetch helpers. |
| `scraper/configs/*.json` | Per-store config: matchHosts, brand, image/price/product-page selectors. |
| `scraper/save.ts` | `saveProduct`: dedupe → image download → add to wardrobe; `SaveDeps`/`SaveResult` types. |
| `scraper/dupe.ts` | `findDupe`: match an incoming product against saved items (URL, or name+brand). |
| `scraper/dupe.test.ts` | Standalone assert self-check: `node src/scraper/dupe.test.ts`. |

## Frontend — AI, hooks, libs

| File | Role |
|---|---|
| `ai/api.ts` | `OutfitImaginator` class: prompt builders + OpenRouter image requests. |
| `hooks/useWardrobe.ts` | Single source of wardrobe state; every action writes to db then refreshes. Exports the shared `Wardrobe` type all screens take as a prop. |
| `hooks/use-mobile.ts` | `useIsMobile` media-query hook. |
| `lib/filters.tsx` | Filters type, name search, marketplace helper, FilterPillRow. |
| `lib/shareOutfit.ts` | Renders an outfit collage to PNG and shares/downloads it. |
| `lib/file.ts` | `fileToDataUrl` helper. |
| `lib/utils.ts` | `cn` (className merge). |
| `types.ts` | Shared app types: Clothing, Outfit, OutfitSlot, BodyPhoto, TryOnResult, NewClothing. |
| `index.css` | Tailwind + theme variables (accents, fonts). |
| `wa-sqlite.d.ts` | Type declarations for the wa-sqlite package. |

## Worker (Cloudflare)

| File | Role |
|---|---|
| `worker/src/worker.js` | The proxy: validates host, fetches the store page, rewrites HTML, injects the scraper bundle, rewrites cookies. Heavily commented inline. |
| `worker/src/scraper.inject.txt` | Build artifact of `npm run build:inject` — do not edit by hand. |
| `worker/src/*.png/ico` | Favicon/PWA icons served as fallback. |
