# Task 02 — EditorPage: Navigate to Last-Used City

**Files:**
- Modify: `src/pages/editor/EditorPage.svelte`
- Modify: `src/test/EditorPage.test.ts`

**Context:**
`EditorPage` currently hardcodes `/den_haag` in the "Locations" tile's `onclick`. This task replaces that with a helper that reads `localStorage` for the last city the user edited, falling back to `'den_haag'` if nothing is stored. The localStorage key `editor_last_city_${project}` is written by `EditorLocationList` (Task 01).

---

- [ ] **Step 1: Write the two new failing tests**

Open `src/test/EditorPage.test.ts`. The file currently has no `localStorage.clear()` in its `beforeEach` and does not import `push`. Make these additions:

1. Add `push` to the existing `svelte-spa-router` import at the top:

```ts
import { push } from "svelte-spa-router";
```

2. Replace the existing `beforeEach` block:

```ts
beforeEach(() => {
  authStore.login("democrats_abroad", "Admin", "", true);
});
```

With:

```ts
beforeEach(() => {
  authStore.login("democrats_abroad", "Admin", "", true);
  localStorage.clear();
});
```

3. Append the two new tests:

```ts
test("Locations tile navigates to the last-used city from localStorage", async () => {
  localStorage.setItem("editor_last_city_democrats_abroad", "oslo");
  render(EditorPage);
  await fireEvent.click(screen.getByText("Locations"));
  expect(push).toHaveBeenCalledWith(
    "/editor/locations/democrats_abroad/oslo",
  );
});

test("Locations tile falls back to den_haag when no city is stored", async () => {
  render(EditorPage);
  await fireEvent.click(screen.getByText("Locations"));
  expect(push).toHaveBeenCalledWith(
    "/editor/locations/democrats_abroad/den_haag",
  );
});
```

`fireEvent` is not currently imported in this test file. Update the existing Testing Library import at the top of the file:
```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
```

- [ ] **Step 2: Run tests to confirm the two new tests fail**

```
npm test -- src/test/EditorPage.test.ts
```

Expected: the two pre-existing tests pass; both new tests fail. The "last-used city" test should fail because `push` is called with `den_haag` regardless of localStorage.

- [ ] **Step 3: Add the `handleLocationsClick` function to `EditorPage.svelte`**

In `src/pages/editor/EditorPage.svelte`, add this function in the `<script>` block, after the existing `let project = $derived(...)` line:

```ts
function handleLocationsClick() {
  const city =
    localStorage.getItem(`editor_last_city_${project}`) ?? "den_haag";
  push(`/editor/locations/${project}/${city}`);
}
```

- [ ] **Step 4: Wire the function to the Locations button**

In `src/pages/editor/EditorPage.svelte`, replace the Locations button:

```svelte
<button
  class="editor-page__tile"
  onclick={() => push(`/editor/locations/${project}/den_haag`)}
>
```

With:

```svelte
<button
  class="editor-page__tile"
  onclick={handleLocationsClick}
>
```

- [ ] **Step 5: Run tests to confirm all pass**

```
npm test -- src/test/EditorPage.test.ts
```

Expected: all four tests pass.

- [ ] **Step 6: Run the full test suite**

```
npm test
```

Expected: all tests pass. If any pre-existing test fails, do not proceed — investigate and fix before committing.

- [ ] **Step 7: Run the linter**

```
npm run lint
```

Expected: no errors.

- [ ] **Step 8: Commit**

```
git add src/pages/editor/EditorPage.svelte src/test/EditorPage.test.ts
git commit -m "feat: EditorPage navigates to last-used city from localStorage"
```
