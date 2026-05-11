# Task 13: Update `doc/architecture.md`

**Files:**
- Modify: `doc/architecture.md`

Add `AppForm.svelte` and `api.ts` to the file structure listing, add an **API Layer** section, add a **Unified Form System** section, and update the supported form field types list.

---

- [ ] **Step 1: Add `AppForm.svelte` to the file structure under `components/`**

In the `## File Structure` code block, in the `components/` section, add after the `ChallengeForm.svelte` line:

```
    AppForm.svelte      — Generic data-driven form (renders all field types, calls onSubmit callback)
```

- [ ] **Step 2: Add `api.ts` and `formValues.ts` to the file structure under `utils/`**

In the `utils/` section, add:

```
    api.ts              — All client HTTP functions (challenge, editor, auth)
    formValues.ts       — buildNestedValues (dotted-path → nested object) and flattenValues (inverse)
```

- [ ] **Step 3: Add `src/data/text/en/editor/` to the file structure**

In the `data/text/en/` section, add after `projects/`:

```
        editor/
          location_form.yaml            — Field definitions for the location editor form
```

- [ ] **Step 4: Add `## API Layer` section**

Add this section after `## Image Handling`:

```markdown
## API Layer

All client-side HTTP calls go through `src/utils/api.ts`. No component or store calls `fetch()` directly.

Functions are grouped by domain:

| Group | Functions |
|-------|-----------|
| Challenge | `postFormSubmit(payload)` → `POST /form-submit`; `postPhotoUpload(locationId, file)` → `POST /upload` |
| Editor | `fetchEditorLocations(project, city)`, `fetchEditorLocation(project, city, file)`, `saveEditorLocation(payload)`, `fetchPrStatuses(numbers[])` |
| Auth | `fetchAuthMe()`, `postLogin(payload)`, `postLogout()` |

Each function wraps a single endpoint, handles the request shape, and returns a typed response. Tests mock the function directly rather than mocking `globalThis.fetch`.
```

- [ ] **Step 5: Add `## Unified Form System` section**

Add this section after `## API Layer`:

```markdown
## Unified Form System

`AppForm.svelte` is the single generic form component. It receives a `FormField[]` array and an `onSubmit` callback; it never calls any endpoint directly.

**Props:**
- `fields: FormField[]` — field definitions (from YAML or passed inline)
- `initialValues?: Record<string, unknown>` — pre-populated values for edit mode
- `onSubmit: (values) => Promise<void>` — called with nested output after validation
- `onPhotoUpload?: (file) => Promise<{ ok: boolean }>` — injected photo upload handler
- `onSuccess?: () => void` — called after `onSubmit` resolves without error
- `confirmMessage?: string` — if set, shows a confirm dialog before calling `onSubmit`
- `submitLabel?: string` — button label (default: `"Submit"`)

**Dotted-path IDs:** A field with `id: "coordinates.latitude"` writes into `{ coordinates: { latitude: value } }` in the value passed to `onSubmit`. `flattenValues()` provides the reverse (for seeding `initialValues` from a loaded nested object).

**Field types:** `boolean`, `string`, `number`, `radio`, `multiple`, `photo`, `textarea`, `section`

- `textarea` — long text, renders `<textarea>`
- `section` — pseudo-field, renders a section heading, produces no value

**Consumer pattern:**

| Component | Role |
|-----------|------|
| `ChallengeForm` | Thin wrapper: adds flag dividers, success state; provides `onSubmit` (calls `postFormSubmit`), `onPhotoUpload` (calls `postPhotoUpload`), and `confirmMessage` |
| `EditorLocationForm` | Data-driven wrapper: loads field list from `src/data/text/en/editor/location_form.yaml` via `loadText()`; flattens loaded location data into `initialValues`; `onSubmit` rebuilds nested object, parses coordinates, calls `saveEditorLocation()` |

**Editor form YAML:** `src/data/text/en/editor/location_form.yaml` defines all fields for the location editor. Adding or reordering editor fields requires only editing this file — no TypeScript changes.
```

- [ ] **Step 6: Update the supported form field types list in `## Data Model`**

Find the line:

```
Supported form field types: `boolean`, `string`, `number`, `radio`.
```

Replace it with:

```
Supported form field types: `boolean`, `string`, `number`, `radio`, `multiple`, `photo`, `textarea`, `section`.

`textarea` renders a `<textarea>` for long text. `section` is a pseudo-field that renders a heading in the form with no associated value — used by the editor form for visual grouping.
```

- [ ] **Step 7: Run lint and build**

```
npm run lint
npm run build
```

Expected: both pass cleanly.

- [ ] **Step 8: Run all tests one final time**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```
git add doc/architecture.md
git commit -m "docs: update architecture.md — API layer, unified form system, new field types"
```
