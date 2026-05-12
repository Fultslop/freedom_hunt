# Task 01 — Types and YAML

**Depends on:** nothing  
**Next:** [02 — leafletMap action](./02-leaflet-map-action.md)

**Files:**
- Modify: `src/types/data.ts`
- Modify: `src/data/text/en/editor/location_form.yaml`

---

- [ ] **Step 1: Add `"coord-picker"` to `FormFieldType` and `coordinates?` to `City`**

Open `src/types/data.ts`.

Change `FormFieldType` from:
```ts
export type FormFieldType =
  | "boolean"
  | "string"
  | "number"
  | "radio"
  | "multiple"
  | "photo"
  | "textarea"
  | "section"
  | "image-picker";
```
to:
```ts
export type FormFieldType =
  | "boolean"
  | "string"
  | "number"
  | "radio"
  | "multiple"
  | "photo"
  | "textarea"
  | "section"
  | "image-picker"
  | "coord-picker";
```

Change the `City` interface from:
```ts
export interface City {
  id: string;
  name: string;
  image?: string;
  country: string;
  description?: string;
}
```
to:
```ts
export interface City {
  id: string;
  name: string;
  image?: string;
  country: string;
  description?: string;
  coordinates?: Coordinates;
}
```

- [ ] **Step 2: Replace the two coordinate number fields with a single `coord-picker` field**

Open `src/data/text/en/editor/location_form.yaml`.

Replace:
```yaml
- id: coordinates.latitude
  type: number
  label: Latitude
  isRequired: true

- id: coordinates.longitude
  type: number
  label: Longitude
  isRequired: true
```
with:
```yaml
- id: coordinates
  type: coord-picker
  label: Coordinates
  isRequired: true
```

- [ ] **Step 3: Verify typecheck passes**

Run:
```
npm run typecheck
```
Expected: no errors. (`coord-picker` is now a valid `FormFieldType`; `City.coordinates` matches the existing `Coordinates` interface.)

- [ ] **Step 4: Commit**

```
git add src/types/data.ts src/data/text/en/editor/location_form.yaml
git commit -m "feat: add coord-picker FormFieldType and City.coordinates"
```
