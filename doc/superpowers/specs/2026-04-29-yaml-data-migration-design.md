# YAML Data Migration Design

**Date:** 2026-04-29
**Branch:** update_data_structure

## Summary

Migrate all data files in `src/data/text/en/` from JSON to YAML, and update the location file schema to a richer structure. Update the Vite build pipeline to load YAML, update both data-loading hooks, update `ChallengeCard.jsx` to read the new field names, and update affected tests.

## Approach

Single migration — all changes in one pass. Scope is small (10 files, 1 component, test fixtures), so a staged approach adds no value.

---

## Section 1: Infrastructure

**New dependency:** `@modyfi/vite-plugin-yaml`

**`vite.config.js`** — add YAML plugin:
```js
import yaml from '@modyfi/vite-plugin-yaml'
// ...
plugins: [react(), yaml()]
```

**`src/hooks/useText.js`** — two changes:
- Glob: `'../data/text/**/*.json'` → `'../data/text/**/*.yaml'`
- Key: `` `.../${path}.json` `` → `` `.../${path}.yaml` ``

**`src/hooks/useLocations.js`** — same two changes as `useText.js`.

Hook API and return shape are unchanged. The YAML plugin makes `.yaml` files behave identically to JSON imports.

---

## Section 2: Data Files

### Non-location files (format-only, 1:1 key mapping)

Each file is rewritten as YAML with identical keys. Original `.json` file is deleted.

| File |
|------|
| `src/data/text/en/application.json` |
| `src/data/text/en/projects/projects.json` |
| `src/data/text/en/projects/democrats_abroad/democrats_abroad.json` |
| `src/data/text/en/projects/democrats_abroad/cities.json` |
| `src/data/text/en/projects/democrats_abroad/den_haag/den_haag.json` |
| `src/data/text/en/projects/democrats_abroad/den_haag/routes.json` |
| `src/data/text/en/test_fixture.json` |

### Location files (new schema)

The 3 location JSON files are replaced with YAML equivalents (originals deleted). Field mapping:

| Old field | New field |
|-----------|-----------|
| `title` | `title` (unchanged) |
| `location.lat` | `coordinates.lattitude` (spelling preserved from spec) |
| `location.long` | `coordinates.longitude` |
| `description` | `storyline` |
| `clue` | `breadcrumb` |
| `challenge` | `challenge.description` |

New fields with placeholders:
- `locationId`: 1, 2, 3 (matching file order)
- `name.label`: `"location details"`
- `name.value`: `""`
- `address`: `""`
- `challenge.name`: `""`
- `challenge.notes`: `""`

**Canonical example (`001_loc_binnenhof.yaml`):**
```yaml
locationId: 1
title: "Binnenhof"
name:
  label: "location details"
  value: ""
address: ""
coordinates:
  longitude: 4.3133
  lattitude: 52.0799
storyline: |
  The Binnenhof is the oldest seat of parliament in the world still in use. Its 13th-century towers have witnessed wars, occupations, liberation, and democratic renewal.
challenge:
  name: ""
  description: |
    Register to vote — or confirm your registration is current — before you leave this courtyard. Photograph the screen showing your completed registration as proof.
  notes: ""
breadcrumb: |
  Find the inner courtyard where a statue of William of Orange keeps watch. What motto is engraved on the plaque at his feet?
```

---

## Section 3: Component + Tests

**`src/components/ChallengeCard.jsx`** — three field references updated:
- `location.description` → `location.storyline`
- `location.clue` → `location.breadcrumb`
- `location.challenge` → `location.challenge.description`

Layout, styling, and label strings ("Clue", "Challenge") are unchanged.

**`src/test/ChallengeCard.test.jsx`** — the mock location object (the `location` const at the top) updates to use new field names: `description` → `storyline`, `clue` → `breadcrumb`, `challenge` → `challenge: { description: '...' }`. Test descriptions and assertions unchanged.

**`src/test/useLocations.test.jsx` / `src/test/useText.test.jsx`** — no code changes needed. Vitest resolves `import.meta.glob` against the real file system, so these tests automatically pick up the migrated YAML files once the hooks (Section 1) and data files (Section 2) are updated.

**`src/data/text/en/test_fixture.yaml`** — replaces `test_fixture.json`; content: `hello: world`. Required for the `useText` and `useLocations` tests to pass.

All 15 existing tests pass after migration. No new tests required — no new behaviour introduced.
