# How to add a setting

A setting is either **device-local** (localStorage, like the API key and accent) or **wardrobe data** (a SQLite column/table, like clothing items). Pick based on whether it should survive a browser-data clear along with the wardrobe, or is fine as a browser preference.

## Device-local setting (localStorage) — like the API key

The existing pattern in `frontend/src/components/Settings.tsx`:

1. Pick a constant key name: `const MY_SETTING_STORE = 'shiah-my-setting'`.
2. Read it lazily into state: `const [value, setValue] = useState(() => localStorage.getItem(MY_SETTING_STORE) ?? '')`.
3. On change, write both: `setValue(v); localStorage.setItem(MY_SETTING_STORE, v)`.
4. Read it wherever it's consumed: `localStorage.getItem(MY_SETTING_STORE)`.

If the setting is a theme-like value applied globally (accent), follow the `applyTheme`/`initTheme` pattern: an exported apply function that mutates `document.documentElement.dataset`, called from App on boot and from the Settings control.

No DB changes needed. Nothing else to wire.

## Wardrobe setting (SQLite) — add a column or table

This crosses three files, in this order:

### 1. Migration in `db/worker.ts`

Bump `DB_VERSION` and add a case to the migration switch:

```ts
case 6: // whatever the next version number is
  await db.exec(`ALTER TABLE clothing ADD COLUMN size TEXT`)
  await db.exec(`PRAGMA user_version = 6`)
  break
```

Existing installs run the new migration on boot; fresh installs run all of them in order.

### 2. Handler in `db/worker.ts`

Add a function + register it in the `handlers` table, and whitelist any new writable column in `updateClothingPiece` (the worker only accepts columns from a fixed list — SQL injection safety):

```ts
async function setMySetting(params: unknown[]) {
  const value = asString(params[0])
  await db.exec(`UPDATE settings SET my_setting = ? WHERE id = 1`)
}
handlers['setMySetting'] = setMySetting
```

### 3. Client method in `db/DBManager.ts`

Mirror the handler so the app side is typed:

```ts
async setMySetting(value: string) {
  return await this.sendReady('setMySetting', [value])
}
```

### 4. Expose it through `useWardrobe`

Add an action function (write → `await refresh()`) and a field to the `Wardrobe` interface in `frontend/src/hooks/useWardrobe.ts`, plus a state field in `WardrobeState` loaded in `refresh()`. If it needs a new read, add a `getMySetting` handler + client method the same way.

### 5. UI in `Settings.tsx`

Render the control and call `wardrobe.yourAction(...)`.

## Checklist

- [ ] `npx tsc --noEmit` passes
- [ ] `node src/scraper/dupe.test.ts` still passes (if you touched scraper/)
- [ ] The setting survives a reload (OPFS persistence or localStorage)
- [ ] Existing installs migrate cleanly: clear OPFS in devtools → fresh install path also works
