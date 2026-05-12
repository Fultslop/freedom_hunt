# Task 05 — `EditorLocationForm` changes

**Depends on:** [01 — Types and YAML](./01-types-and-yaml.md), [04 — AppForm changes](./04-appform-changes.md)  
**Next:** nothing — this is the final task.

**Files:**
- Modify: `src/pages/editor/EditorLocationForm.svelte`
- Modify: `src/test/EditorLocationForm.test.ts`

---

- [ ] **Step 1: Add 3 failing tests to `EditorLocationForm.test.ts`**

**1a — Add the `leafletMap` mock at the top** of `src/test/EditorLocationForm.test.ts`, after the existing `vi.mock("../utils/api", ...)` block:

```ts
vi.mock("../actions/leafletMap", () => ({
  leafletMap: vi.fn(() => ({ update: vi.fn(), destroy: vi.fn() })),
}));
```

Also add `loadText` to the existing import:
```ts
import { loadText } from "../utils/loadText";
```

**1b — Append these 3 tests** at the bottom of the file:

```ts
// ---------------------------------------------------------------------------
// City coordinate defaults and initialValues reconstruction
// ---------------------------------------------------------------------------

test("new location with no draft: coordinates seeded from city data", async () => {
  vi.mocked(loadText)
    .mockResolvedValueOnce([
      { id: "coordinates", type: "coord-picker", label: "Coordinates", isRequired: true },
    ])
    .mockResolvedValueOnce({
      items: [
        {
          id: "den_haag",
          name: "Den Haag",
          country: "Netherlands",
          coordinates: { latitude: 52.0799, longitude: 4.3133 },
        },
      ],
    });

  render(EditorLocationForm, {
    props: { params: { project: "democrats_abroad", city: "den_haag", newId: 1 } },
  });

  await waitFor(() => {
    expect(
      (screen.getByLabelText(/latitude/i) as HTMLInputElement).value,
    ).toBe("52.0799");
  });
  expect(
    (screen.getByLabelText(/longitude/i) as HTMLInputElement).value,
  ).toBe("4.3133");
});

test("new location with existing draft: draft takes precedence over city coords", async () => {
  // Pre-seed a draft with different coordinates
  const draftKey = "editor_draft_democrats_abroad/den_haag/locations_new";
  localStorage.setItem(
    draftKey,
    JSON.stringify({ coordinates: { latitude: 51.0, longitude: 3.0 } }),
  );

  vi.mocked(loadText)
    .mockResolvedValueOnce([
      { id: "coordinates", type: "coord-picker", label: "Coordinates", isRequired: true },
    ])
    .mockResolvedValueOnce({
      items: [
        {
          id: "den_haag",
          name: "Den Haag",
          country: "Netherlands",
          coordinates: { latitude: 52.0799, longitude: 4.3133 },
        },
      ],
    });

  render(EditorLocationForm, {
    props: { params: { project: "democrats_abroad", city: "den_haag", newId: 1 } },
  });

  await waitFor(() => {
    expect(
      (screen.getByLabelText(/latitude/i) as HTMLInputElement).value,
    ).toBe("51");
  });
  expect(
    (screen.getByLabelText(/longitude/i) as HTMLInputElement).value,
  ).toBe("3");
});

test("edit mode: initialValues.coordinates is a compound object, not dotted-path keys", async () => {
  vi.mocked(fetchEditorLocation).mockResolvedValueOnce({
    ok: true,
    sha: "abc123",
    location: {
      locationId: 1,
      title: "Binnenhof",
      coordinates: { latitude: 52.0799, longitude: 4.3133 },
      storyline: "A historic place.",
      breadcrumb: "Look for the gate.",
      name: { label: "", value: "Binnenhof" },
      challenge: { name: "", description: "Find it.", notes: "", form: [] },
    },
  });

  vi.mocked(loadText)
    .mockResolvedValueOnce([
      { id: "coordinates", type: "coord-picker", label: "Coordinates", isRequired: true },
    ])
    .mockResolvedValueOnce({
      items: [
        {
          id: "den_haag",
          name: "Den Haag",
          country: "Netherlands",
          coordinates: { latitude: 52.0799, longitude: 4.3133 },
        },
      ],
    });

  render(EditorLocationForm, {
    props: {
      params: {
        project: "democrats_abroad",
        city: "den_haag",
        filename: "001_loc_binnenhof.yaml",
        newId: 0,
      },
    },
  });

  await waitFor(() => {
    expect(
      (screen.getByLabelText(/latitude/i) as HTMLInputElement).value,
    ).toBe("52.0799");
  });
  expect(
    (screen.getByLabelText(/longitude/i) as HTMLInputElement).value,
  ).toBe("4.3133");
});
```

- [ ] **Step 2: Run new tests — verify they fail**

```
npx vitest run src/test/EditorLocationForm.test.ts
```
Expected: the 3 new tests fail. All pre-existing tests still pass.

- [ ] **Step 3: Apply changes to `EditorLocationForm.svelte`**

Open `src/pages/editor/EditorLocationForm.svelte`.

**3a — Extend the existing type import.** `EditorLocationForm.svelte` already has:
```ts
import type { FormField } from "../../types/data";
```
Change it to:
```ts
import type { FormField, Coordinates, CitiesText } from "../../types/data";
```

**3b — Add state variables.** After `let checkingDraft = $state(false);`, add:
```ts
let cityCoords = $state<Coordinates | null>(null);
let citiesLoading = $state(true);
```

**3c — Add city-loading effect.** After the existing `$effect` that loads fields, add:
```ts
$effect(() => {
  loadText<CitiesText>("en", `projects/${params.project}/cities`).then((data) => {
    const city = data?.items?.find((c) => c.id === params.city);
    cityCoords = city?.coordinates ?? null;
    if (!isEdit) {
      const draft = getDraft(draftKey);
      initialValues = draft ?? (cityCoords ? { coordinates: cityCoords } : {});
    }
    citiesLoading = false;
  });
});
```

**3d — Update the loading guard in the template.** Change:
```svelte
{#if locLoading || fields.length === 0}
```
to:
```svelte
{#if locLoading || citiesLoading || fields.length === 0}
```

**3e — Remove the draft initialisation from the `$state` declaration for new locations.** The draft is now loaded inside the cities effect, so the `untrack` init for new locations no longer needs to read the draft. Change:
```ts
let initialValues = $state<Record<string, unknown>>(
  untrack(() => (!params.filename ? (getDraft(draftKey) ?? {}) : {})),
);
```
to:
```ts
let initialValues = $state<Record<string, unknown>>({});
```

**3f — Fix `reloadData` to reconstruct the `coordinates` compound object.** Inside `reloadData`, after the line:
```ts
flat["identity"] = tryParseLocationName(params.filename)?.title ?? "";
```
add:
```ts
const lat = flat["coordinates.latitude"] as number | undefined;
const lng = flat["coordinates.longitude"] as number | undefined;
if (lat !== undefined || lng !== undefined) {
  flat["coordinates"] = { latitude: lat ?? 0, longitude: lng ?? 0 };
  delete flat["coordinates.latitude"];
  delete flat["coordinates.longitude"];
}
```

**3g — Simplify `handleSubmit` coordinate parsing.** Change:
```ts
const coords = (nested["coordinates"] ?? {}) as {
  latitude?: string;
  longitude?: string;
};
const location = {
  ...nested,
  coordinates: {
    latitude: parseFloat(coords.latitude ?? "0") || 0,
    longitude: parseFloat(coords.longitude ?? "0") || 0,
  },
};
```
to:
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

- [ ] **Step 4: Run new tests — verify all pass**

```
npx vitest run src/test/EditorLocationForm.test.ts
```
Expected: all tests pass including the 3 new ones.

- [ ] **Step 5: Run full test suite, lint, and typecheck**

```
npm run test:run
npm run lint
npm run typecheck
```
Expected: all tests pass, 0 lint errors, 0 type errors.

- [ ] **Step 6: Commit**

```
git add src/pages/editor/EditorLocationForm.svelte src/test/EditorLocationForm.test.ts
git commit -m "feat: seed new location coordinates from city defaults, support coord-picker in editor"
```
