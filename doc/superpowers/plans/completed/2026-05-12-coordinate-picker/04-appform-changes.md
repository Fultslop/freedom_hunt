# Task 04 — `AppForm` changes

**Depends on:** [03 — CoordinatePicker component](./03-coordinate-picker-component.md)  
**Next:** [05 — EditorLocationForm changes](./05-editor-location-form-changes.md)

**Files:**
- Modify: `src/components/AppForm.svelte`
- Modify: `src/test/AppForm.test.ts`

---

- [ ] **Step 1: Add 2 failing tests to `AppForm.test.ts`**

At the top of `src/test/AppForm.test.ts`, add these two lines after the existing `vi.mock("../utils/images", ...)` block:

```ts
import { leafletMap } from "../actions/leafletMap";
import type { LeafletMapParams } from "../actions/leafletMap";

vi.mock("../actions/leafletMap", () => ({
  leafletMap: vi.fn(() => ({ update: vi.fn(), destroy: vi.fn() })),
}));
```

Then append these two tests at the bottom of the file:

```ts
// ---------------------------------------------------------------------------
// coord-picker field type
// ---------------------------------------------------------------------------

test("renders coord-picker field as latitude and longitude inputs", () => {
  const fields: FormField[] = [
    { id: "coordinates", type: "coord-picker" as FormFieldType, label: "Coordinates" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByLabelText(/latitude/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/longitude/i)).toBeInTheDocument();
});

test("coord-picker value change propagates to onSubmit as coordinates object", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const fields: FormField[] = [
    {
      id: "coordinates",
      type: "coord-picker" as FormFieldType,
      label: "Coordinates",
      isRequired: true,
    },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { coordinates: { latitude: 52.0799, longitude: 4.3133 } },
      onSubmit,
    },
  });
  // Simulate map click by calling the onClick param that was passed to the leafletMap action
  const actionParams = vi.mocked(leafletMap).mock.calls[0][1] as LeafletMapParams;
  actionParams.onClick!(53.0, 5.0);
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ coordinates: { latitude: 53.0, longitude: 5.0 } }),
    );
  });
});
```

- [ ] **Step 2: Run new tests — verify they fail**

```
npx vitest run src/test/AppForm.test.ts
```
Expected: the 2 new tests fail. All pre-existing tests still pass.

- [ ] **Step 3: Make the 5 changes to `AppForm.svelte`**

Open `src/components/AppForm.svelte`.

**3a — Add the import and constant.** After the existing `import ImagePickerDialog` line, add:
```ts
import CoordinatePicker from "./CoordinatePicker.svelte";
```
After `const STR_IMAGE_PICKER = "image-picker";`, add:
```ts
const STR_COORD_PICKER = "coord-picker";
```

**3b — Widen `FieldValues` type.** Change:
```ts
type FieldValues = Record<string, string | number | boolean | string[]>;
```
to:
```ts
type FieldValues = Record<string, string | number | boolean | string[] | { latitude: number; longitude: number }>;
```

**3c — Add `STR_COORD_PICKER` to `VALID_TYPES`.** Change:
```ts
const VALID_TYPES: FormFieldType[] = [
  STR_STRING,
  STR_NUMBER,
  STR_BOOLEAN,
  STR_RADIO,
  STR_MULTIPLE,
  STR_PHOTO,
  STR_TEXTAREA,
  STR_SECTION,
  STR_IMAGE_PICKER,
];
```
to:
```ts
const VALID_TYPES: FormFieldType[] = [
  STR_STRING,
  STR_NUMBER,
  STR_BOOLEAN,
  STR_RADIO,
  STR_MULTIPLE,
  STR_PHOTO,
  STR_TEXTAREA,
  STR_SECTION,
  STR_IMAGE_PICKER,
  STR_COORD_PICKER,
];
```

**3d — Fix `hasChanges` object comparison.** In the `$derived` block for `hasChanges`, change the final return from:
```ts
      if (Array.isArray(curr) || Array.isArray(baseline)) {
        return (
          JSON.stringify(curr ?? []) !== JSON.stringify(baseline ?? [])
        );
      }
      return curr !== baseline;
```
to:
```ts
      if (Array.isArray(curr) || Array.isArray(baseline)) {
        return JSON.stringify(curr ?? []) !== JSON.stringify(baseline ?? []);
      } else if (typeof curr === "object" || typeof baseline === "object") {
        return JSON.stringify(curr ?? {}) !== JSON.stringify(baseline ?? {});
      }
      return curr !== baseline;
```

**3e — Add `validateValues` branch.** Inside `validateValues()`, after the `} else if (field.type === STR_IMAGE_PICKER) {` block and before the closing `}` of the `for` loop, add:
```ts
      } else if (field.type === STR_COORD_PICKER) {
        const v = values[field.id] as { latitude: number; longitude: number } | undefined;
        if (!v || (v.latitude === 0 && v.longitude === 0)) {
          errs[field.id] = MSG_REQUIRED;
        }
```

**3f — Add `coord-picker` branch in the template.** In the `{#each fields as field}` block, the outer conditional ends with the `image-picker` branch followed by `{/if}`. Insert a new `{:else if}` between them — so the structure becomes:
```
{:else if field.type === "image-picker"}
  ... image picker markup ...
{:else if field.type === "coord-picker"}   ← INSERT THIS BRANCH
  <CoordinatePicker .../>
{/if}
```
The code to insert:
```svelte
          {:else if field.type === "coord-picker"}
            <CoordinatePicker
              value={values[id] as { latitude: number; longitude: number }}
              onchange={(coords) => { values[id] = coords; }}
            />
```

- [ ] **Step 4: Run new tests — verify all pass**

```
npx vitest run src/test/AppForm.test.ts
```
Expected: all tests pass including the 2 new ones.

- [ ] **Step 5: Run full test suite, lint, and typecheck**

```
npm run test:run
npm run lint
npm run typecheck
```
Expected: all tests pass, 0 lint errors, 0 type errors.

- [ ] **Step 6: Commit**

```
git add src/components/AppForm.svelte src/test/AppForm.test.ts
git commit -m "feat: add coord-picker field type to AppForm"
```
