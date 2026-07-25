# Coordinate Picker — Design Spec

**Date:** 2026-05-12
**Status:** Approved

## Problem

Editor users must type latitude and longitude by hand, which is error-prone. City coordinates added to `cities.yaml` can serve as sensible defaults, and the existing Leaflet map (already used in `ChallengeCard`) can be reused to let users click-to-pick a precise location.

## Goals

1. When adding a new location, pre-fill coordinates from the selected city.
2. Show a Leaflet map inline in the coordinates section of the editor form.
3. Allow the user to click the map to set coordinates (updates the number inputs).
4. Keep manual text entry working alongside the map.

## Non-Goals

- Changing the stored YAML format for location files — `coordinates: { latitude, longitude }` remains unchanged.
- Adding map interaction to `ChallengeCard` (read-only, stays as-is).
- Supporting multiple cities' coordinate pickers simultaneously.

---

## Changes

### 1. Type changes (`src/types/data.ts`)

Add `coordinates?: Coordinates` to the `City` interface:

```ts
export interface City {
  id: string;
  name: string;
  image?: string;
  country: string;
  description?: string;
  coordinates?: Coordinates;   // ← new
}
```

Add `"coord-picker"` to the `FormFieldType` union:

```ts
export type FormFieldType =
  | "boolean" | "string" | "number" | "radio" | "multiple"
  | "photo" | "textarea" | "section" | "image-picker"
  | "coord-picker";   // ← new
```

### 2. Editor form field definition (`src/data/text/en/editor/location_form.yaml`)

Replace the two separate coordinate fields:

```yaml
# BEFORE
- id: coordinates.latitude
  type: number
  label: Latitude
  isRequired: true

- id: coordinates.longitude
  type: number
  label: Longitude
  isRequired: true

# AFTER
- id: coordinates
  type: coord-picker
  label: Coordinates
  isRequired: true
```

### 3. `AppForm` internal type (`src/components/AppForm.svelte`)

Widen the `FieldValues` type to accommodate the compound coordinate object:

```ts
type FieldValues = Record<string, string | number | boolean | string[] | { latitude: number; longitude: number }>;
```

### 4. `leafletMap` action (`src/actions/leafletMap.ts`)

Extend `LeafletMapParams` with two optional fields:

```ts
export interface LeafletMapParams {
  center: [number, number];
  zoom: number;
  scrollWheelZoom?: boolean;   // default false (existing behaviour unchanged)
  onClick?: (lat: number, lng: number) => void;  // only wired when provided
}
```

In the action body:
- Pass `scrollWheelZoom: params.scrollWheelZoom ?? false` to `leaflet.map(...)`.
- If `params.onClick` is provided, attach a `map.on("click", ...)` handler once at mount. Store the callback in a mutable local variable (`let clickCallback = params.onClick`) so the listener closure always calls the latest reference. `update()` refreshes `clickCallback` alongside `center` and `zoom`. This avoids the stale-closure problem when Svelte 5 recreates prop callbacks across renders.
- Add `node.style.cursor = "crosshair"` when `params.onClick` is provided at mount.
- Existing consumers (`ChallengeCard`) pass neither new field — behaviour is identical.

### 5. `CoordinatePicker` component (new)

**Files:** `src/components/CoordinatePicker.svelte`, `src/components/CoordinatePicker.css`

**Props:**

```ts
let {
  value = { latitude: 0, longitude: 0 },
  onchange,
}: {
  value?: { latitude: number; longitude: number };
  onchange: (coords: { latitude: number; longitude: number }) => void;
} = $props();
```

**Renders:**

- Two `<input type="number" step="any">` side by side — one for latitude, one for longitude. Each has a `<label>`. On `oninput`, call `onchange` with the updated compound object.
- A Leaflet map below the inputs (~220 px tall, same border-radius and border style as `ChallengeCard`). Uses `use:leafletMap` with:
  - `center`: derived from `value`
  - `zoom`: 15
  - `scrollWheelZoom`: true
  - `onClick`: calls `onchange({ latitude: lat, longitude: lng })`
- When `value` changes (e.g. after a map click updates the parent and re-flows into this component), the map updates via the `update()` path of the action.

**CSS:** BEM class names under `coord-picker` prefix. No inline styles except for dynamic values.

### 6. `AppForm` changes (`src/components/AppForm.svelte`)

- Add `"coord-picker"` to `VALID_TYPES` and a `STR_COORD_PICKER` constant.
- Import `CoordinatePicker` at the top of the script block.
- In the field rendering loop, add a `{:else if field.type === "coord-picker"}` branch:

```svelte
<CoordinatePicker
  value={values[id] as { latitude: number; longitude: number }}
  onchange={(coords) => { values[id] = coords; }}
/>
```

**`validateValues` — add coord-picker branch:**

```ts
} else if (field.type === STR_COORD_PICKER) {
  const v = values[field.id] as { latitude: number; longitude: number } | undefined;
  if (!v || (v.latitude === 0 && v.longitude === 0)) {
    errs[field.id] = MSG_REQUIRED;
  }
}
```

A value of `{ 0, 0 }` is treated as unset — coordinates at the exact origin (Gulf of Guinea) are not a valid hunt location.

**`hasChanges` — add object comparison:**

The current check uses `curr !== baseline` for non-arrays, which compares object references and always returns `true` for a coord-picker. Extend the condition to stringify objects:

```ts
if (Array.isArray(curr) || Array.isArray(baseline)) {
  return JSON.stringify(curr ?? []) !== JSON.stringify(baseline ?? []);
} else if (typeof curr === "object" || typeof baseline === "object") {
  return JSON.stringify(curr ?? {}) !== JSON.stringify(baseline ?? {});
}
return curr !== baseline;
```

No changes to `buildNestedValues` — the compound value flows through unchanged.

### 7. `EditorLocationForm` changes (`src/pages/editor/EditorLocationForm.svelte`)

**Loading city coordinates for new locations:**

Add a `cityCoords` state variable (`$state<Coordinates | null>(null)`) and a `citiesLoading` boolean flag (`$state(true)`). Load `cities.yaml` for the current project in a `$effect`, find the city matching `params.city`, set `cityCoords`, then set `citiesLoading = false`. `citiesLoading` is separate from `locLoading` (which is only for edit-mode location data fetch).

Update the loading guard in the template:

```svelte
{#if locLoading || citiesLoading || fields.length === 0}
  <div class="loc-form__loading">Loading…</div>
```

For new locations, `initialValues` is built as:

```ts
const draft = getDraft(draftKey);
initialValues = draft ?? (cityCoords ? { coordinates: cityCoords } : {});
```

If a draft exists it takes precedence; otherwise the city coordinates seed the form.

**`initialValues` reconstruction for edit mode:**

After `flattenValues(data.location)` in `reloadData`, post-process to recombine the coordinate fields:

```ts
const flat = flattenValues(data.location);
flat["identity"] = tryParseLocationName(params.filename)?.title ?? "";

// Recombine for coord-picker
const lat = flat["coordinates.latitude"] as number | undefined;
const lng = flat["coordinates.longitude"] as number | undefined;
if (lat !== undefined || lng !== undefined) {
  flat["coordinates"] = { latitude: lat ?? 0, longitude: lng ?? 0 };
  delete flat["coordinates.latitude"];
  delete flat["coordinates.longitude"];
}
```

**`handleSubmit` simplification:**

Replace the `parseFloat` coordinate parsing with direct numeric extraction. Use `Number()` as a defensive guard since Svelte's `bind:value` on `<input type="number">` returns a number, but coercion costs nothing and guards against edge cases:

```ts
const coords = (nested["coordinates"] ?? { latitude: 0, longitude: 0 }) as Coordinates;
const location = {
  ...nested,
  coordinates: {
    latitude: Number(coords.latitude) || 0,
    longitude: Number(coords.longitude) || 0,
  },
};
```

---

## Component Boundaries

| Unit | Purpose | Interface |
|------|---------|-----------|
| `leafletMap` action | Renders a Leaflet map on a DOM node | `LeafletMapParams` in, `update()`/`destroy()` lifecycle |
| `CoordinatePicker` | Compound field: two inputs + clickable map | `value` prop in, `onchange` callback out |
| `AppForm` | Generic field renderer | Passes `value`/`onchange` into `CoordinatePicker` for `coord-picker` fields |
| `EditorLocationForm` | Editor page | Loads city defaults; reconstructs coordinates from flat values; reads compound coordinates on submit |

---

## Testing

### `CoordinatePicker.test.ts`

- Renders latitude and longitude inputs with the given initial values.
- Manual change to latitude input fires `onchange` with updated `{ latitude, longitude }`.
- Manual change to longitude input fires `onchange` with updated `{ latitude, longitude }`.
- Map click fires `onchange` with the clicked coordinates (mock `leafletMap` action).

### `AppForm.test.ts` (additions)

- A `coord-picker` field renders a `CoordinatePicker`.
- Changing the `CoordinatePicker` value propagates through to the `onSubmit` output as a nested `coordinates` object.

### `EditorLocationForm.test.ts` (additions)

- New location with no draft: `initialValues.coordinates` is seeded from city data.
- New location with an existing draft: draft takes precedence over city coordinates.
- Edit mode: `initialValues.coordinates` is a compound object, not dotted-path keys.

---

## File Change Summary

| File | Change |
|------|--------|
| `src/types/data.ts` | Add `coordinates?` to `City`; add `"coord-picker"` to `FormFieldType` |
| `src/data/text/en/editor/location_form.yaml` | Replace two number fields with one `coord-picker` field |
| `src/actions/leafletMap.ts` | Add `scrollWheelZoom?` and `onClick?` to `LeafletMapParams` |
| `src/components/CoordinatePicker.svelte` | New component |
| `src/components/CoordinatePicker.css` | New styles |
| `src/components/AppForm.svelte` | Widen `FieldValues` type; add `coord-picker` branch; fix `validateValues` and `hasChanges` for object values |
| `src/pages/editor/EditorLocationForm.svelte` | City defaults, initialValues reconstruction, handleSubmit simplification |
| `src/test/CoordinatePicker.test.ts` | New test file |
| `src/test/AppForm.test.ts` | 2 new tests |
| `src/test/EditorLocationForm.test.ts` | 3 new tests |
