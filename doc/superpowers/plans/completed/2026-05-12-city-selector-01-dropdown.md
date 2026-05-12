# Task 01 — EditorLocationList: City Dropdown

**Files:**
- Modify: `src/pages/editor/EditorLocationList.svelte`
- Modify: `src/pages/editor/EditorLocationList.css`
- Modify: `src/test/EditorLocationList.test.ts`

**Context:**
`EditorLocationList` currently fetches locations for a hardcoded city. This task adds a `<select>` dropdown to the toolbar that loads cities from `cities.yaml` and lets the user switch cities. The component already accepts `params.city` from the URL; switching city navigates to the new URL and the existing `$effect` will re-fire because we add an explicit `params.city` read.

---

- [ ] **Step 1: Add `loadText` mock to the test file**

Open `src/test/EditorLocationList.test.ts`. Add the import and mock after the existing `vi.mock("../utils/api", ...)` block:

```ts
import { loadText } from "../utils/loadText";

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({
    items: [
      { id: "den_haag", name: "Den Haag", country: "Netherlands" },
      { id: "oslo", name: "Oslo", country: "Norway" },
    ],
  }),
}));
```

Without this mock, once the component imports `loadText`, tests would hit the real Vite glob loader. Adding the mock now keeps all existing tests green while we implement.

- [ ] **Step 2: Write the four new failing tests**

Append these four tests to `src/test/EditorLocationList.test.ts`:

```ts
test("renders city dropdown with city names from loadText", async () => {
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  const select = await screen.findByRole("combobox");
  expect(select).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Den Haag" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Oslo" })).toBeInTheDocument();
});

test("selecting a city navigates to the new city URL", async () => {
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  const select = await screen.findByRole("combobox");
  await fireEvent.change(select, { target: { value: "oslo" } });
  expect(push).toHaveBeenCalledWith(
    "/editor/locations/democrats_abroad/oslo",
  );
});

test("selecting a city saves it to localStorage", async () => {
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  const select = await screen.findByRole("combobox");
  await fireEvent.change(select, { target: { value: "oslo" } });
  expect(localStorage.getItem("editor_last_city_democrats_abroad")).toBe("oslo");
});

test("on mount, saves the current city to localStorage", async () => {
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  await screen.findByRole("combobox");
  expect(localStorage.getItem("editor_last_city_democrats_abroad")).toBe("den_haag");
});
```

- [ ] **Step 3: Run tests to confirm the four new tests fail**

```
npm test -- src/test/EditorLocationList.test.ts
```

Expected: all pre-existing tests pass; the four new tests fail with messages like `Unable to find role="combobox"`.

- [ ] **Step 4: Update imports in `EditorLocationList.svelte`**

In `src/pages/editor/EditorLocationList.svelte`, find the existing type import from `../../types/data`:

```ts
import type { Location as DataLocation } from "../../types/data";
```

Replace it with:

```ts
import type { Location as DataLocation, City, CitiesText } from "../../types/data";
```

Then add the `loadText` import after the `api` import line:

```ts
import { loadText } from "../../utils/loadText";
```

- [ ] **Step 5: Add new state variables**

In `src/pages/editor/EditorLocationList.svelte`, after the existing state declarations (`let locations`, `let loading`, `let error`, `let pending`), add:

```ts
let cities = $state<City[]>([]);
let selectedCity = $state(params.city);
```

- [ ] **Step 6: Update the `$effect`**

In `src/pages/editor/EditorLocationList.svelte`, replace the existing `$effect`:

```ts
$effect(() => {
  fetchLocations();
  syncPending();
});
```

With:

```ts
$effect(() => {
  params.city; // explicit dependency — ensures effect re-runs when city changes
  selectedCity = params.city;
  localStorage.setItem(`editor_last_city_${params.project}`, params.city);
  loadText<CitiesText>("en", `projects/${params.project}/cities`).then(
    (data) => {
      cities = data?.items ?? [];
    },
  );
  fetchLocations();
  syncPending();
});
```

> **Why the bare `params.city;` read:** Svelte 5 `$effect` only tracks reactive reads that happen synchronously during the effect body. `fetchLocations()` reads `params.city` inside an async function after an `await`, which is outside the synchronous tracking window. The bare expression ensures the effect re-fires on every city change.

- [ ] **Step 7: Add the `handleCityChange` function**

In `src/pages/editor/EditorLocationList.svelte`, add this function after `handleClearCompleted`:

```ts
function handleCityChange(e: Event) {
  const newCity = (e.currentTarget as HTMLSelectElement).value;
  localStorage.setItem(`editor_last_city_${params.project}`, newCity);
  push(`/editor/locations/${params.project}/${newCity}`);
}
```

- [ ] **Step 8: Update the toolbar template**

In `src/pages/editor/EditorLocationList.svelte`, replace the toolbar `<div>`:

```html
<div class="loc-list__toolbar">
  <div style="display:flex;gap:8px">
    {#if hasCompleted}
      <button class="loc-list__clear-btn" onclick={handleClearCompleted}>
        ✕ Clear completed
      </button>
    {/if}
    <button
      class="loc-list__refresh-btn"
      onclick={() => {
        fetchLocations();
        syncPending();
      }}
    >
      ↻ Refresh
    </button>
  </div>
</div>
```

With:

```html
<div class="loc-list__toolbar">
  <select
    class="loc-list__city-select"
    bind:value={selectedCity}
    onchange={handleCityChange}
    disabled={cities.length === 0}
  >
    {#each cities as city (city.id)}
      <option value={city.id}>{city.name}</option>
    {/each}
  </select>
  <div style="display:flex;gap:8px">
    {#if hasCompleted}
      <button class="loc-list__clear-btn" onclick={handleClearCompleted}>
        ✕ Clear completed
      </button>
    {/if}
    <button
      class="loc-list__refresh-btn"
      onclick={() => {
        fetchLocations();
        syncPending();
      }}
    >
      ↻ Refresh
    </button>
  </div>
</div>
```

- [ ] **Step 9: Add CSS for the city select**

Append to `src/pages/editor/EditorLocationList.css`:

```css
.loc-list__city-select {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.loc-list__city-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 10: Run tests to confirm all pass**

```
npm test -- src/test/EditorLocationList.test.ts
```

Expected: all tests pass including the four new ones.

- [ ] **Step 11: Run the linter**

```
npm run lint
```

Expected: no errors. If `id-length` or similar ESLint rules trigger on the new function, rename variables to be at least 2 characters (e.g. use `ev` instead of `e` if needed, or just ensure `e` is acceptable — check the existing codebase; most handlers use `e` so it should be fine).

- [ ] **Step 12: Commit**

```
git add src/pages/editor/EditorLocationList.svelte src/pages/editor/EditorLocationList.css src/test/EditorLocationList.test.ts
git commit -m "feat: add city dropdown to EditorLocationList toolbar"
```
