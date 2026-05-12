# Task 03 — EditorLocationForm Wiring

**Goal:** Wire subtitle computation, dirty tracking, and the new Cancel confirm-and-discard flow into `EditorLocationForm`.

**Depends on:** Task 01 (titleBarStore has `subtitle`/`isDirty`) and Task 02 (AppForm has `onHasChangesChange`).

**Files:**
- Modify: `src/pages/editor/EditorLocationForm.svelte`
- Test: `src/test/EditorLocationForm.test.ts`

---

- [ ] **Step 1: Write failing tests**

Open `src/test/EditorLocationForm.test.ts`. Add the following imports at the top of the file (after the existing imports):

```ts
import { get } from "svelte/store";
import { push } from "svelte-spa-router";
import { titleBarStore } from "../stores/titleBarStore";
```

Add `vi.mocked(push).mockClear()` to the existing `beforeEach`, and add an `afterEach` to restore any `window.confirm` spies:

```ts
beforeEach(() => {
  localStorage.clear();
  vi.mocked(saveEditorLocation).mockClear();
  vi.mocked(fetchEditorLocation).mockClear();
  vi.mocked(fetchPrStatuses).mockClear();
  vi.mocked(push).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

Then add these six tests after the existing tests:

```ts
test("sets titleBar subtitle to 'new' in new-location mode", async () => {
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByRole("button", { name: /no changes/i });
  expect(get(titleBarStore).subtitle).toBe("new");
});

test("sets titleBar subtitle to formatted title in edit mode", async () => {
  render(EditorLocationForm, {
    props: {
      params: {
        project: "democrats_abroad",
        city: "den_haag",
        filename: "001_loc_dam_square.yaml",
        newId: 0,
      },
    },
  });
  // fetchEditorLocation mock returns { ok: false }, so serverValues = {} and
  // hasChanges is false — the submit button shows "No changes" on load.
  await screen.findByRole("button", { name: /no changes/i });
  expect(get(titleBarStore).subtitle).toBe("Dam Square");
});

test("cancel with no changes navigates without confirm dialog", async () => {
  const confirmSpy = vi.spyOn(window, "confirm");
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByRole("button", { name: /no changes/i });
  await fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
  expect(confirmSpy).not.toHaveBeenCalled();
  expect(vi.mocked(push)).toHaveBeenCalledWith(
    "/editor/locations/democrats_abroad/den_haag",
  );
});

test("cancel with changes shows confirm dialog", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(false);
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByLabelText(/^Id$/i);
  await fireEvent.input(screen.getByLabelText(/^Id$/i), {
    target: { value: "binnenhof" },
  });
  await waitFor(() => {
    expect(get(titleBarStore).isDirty).toBe(true);
  });
  await fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
  expect(window.confirm).toHaveBeenCalledWith("Discard changes?");
});

test("cancel confirmed clears draft and navigates", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByLabelText(/^Id$/i);
  await fireEvent.input(screen.getByLabelText(/^Id$/i), {
    target: { value: "binnenhof" },
  });
  await waitFor(() => {
    expect(get(titleBarStore).isDirty).toBe(true);
  });
  await fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
  const draftKey = "editor_draft_democrats_abroad/den_haag/locations_new";
  expect(localStorage.getItem(draftKey)).toBeNull();
  expect(vi.mocked(push)).toHaveBeenCalledWith(
    "/editor/locations/democrats_abroad/den_haag",
  );
});

test("cancel dismissed stays on page", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(false);
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByLabelText(/^Id$/i);
  await fireEvent.input(screen.getByLabelText(/^Id$/i), {
    target: { value: "binnenhof" },
  });
  await waitFor(() => {
    expect(get(titleBarStore).isDirty).toBe(true);
  });
  await fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
  expect(vi.mocked(push)).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm run test -- EditorLocationForm
```

Expected: 6 failures. The subtitle tests will fail because `get(titleBarStore).subtitle` is undefined. The cancel tests will fail because the cancel button navigates without any confirm.

- [ ] **Step 3: Add `clearDraft` to the editorStorage import**

In `src/pages/editor/EditorLocationForm.svelte`, find the import from `"./editorStorage"`:

```ts
import {
  addPending,
  getDraft,
  saveDraft,
  updatePendingStatus,
  prWasClosed,
  findPendingByFilename,
} from "./editorStorage";
```

Replace with:

```ts
import {
  addPending,
  clearDraft,
  getDraft,
  saveDraft,
  updatePendingStatus,
  prWasClosed,
  findPendingByFilename,
} from "./editorStorage";
```

- [ ] **Step 4: Add `isDirty` state and `getSubtitle` helper**

In `src/pages/editor/EditorLocationForm.svelte`, find the line that declares `lastSubmittedNested` (around line 67):

```ts
  let lastSubmittedNested = $state<Record<string, unknown>>({});
```

Add after it:

```ts
  let isDirty = $state(false);

  function getSubtitle(): string {
    if (!params.filename) { return "new"; }
    const parsed = tryParseLocationName(params.filename);
    if (!parsed) { return params.filename; }
    return parsed.title
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
```

- [ ] **Step 5: Add subtitle to the titleBarStore effect**

Find the existing `$effect` that sets the title bar (around line 69):

```ts
  $effect(() => {
    titleBarStore.set({
      title: isEdit ? "Edit location" : "Add location",
      progress: null,
      backPath: `/editor/locations/${params.project}/${params.city}`,
    });
  });
```

Replace with:

```ts
  $effect(() => {
    titleBarStore.set({
      title: isEdit ? "Edit location" : "Add location",
      subtitle: getSubtitle(),
      progress: null,
      backPath: `/editor/locations/${params.project}/${params.city}`,
    });
  });
```

- [ ] **Step 6: Add `isDirty` sync effect**

Directly after the titleBarStore effect from Step 5, add a new effect:

```ts
  $effect(() => {
    titleBarStore.update((s) => ({ ...s, isDirty }));
  });
```

This uses `update` (not `set`) so it only touches `isDirty` without overwriting the title, subtitle, and backPath set by the previous effect.

- [ ] **Step 7: Add `handleCancel` function**

Find `async function handleSubmit` in the file. Add `handleCancel` just before it:

```ts
  function handleCancel() {
    const backPath = `/editor/locations/${params.project}/${params.city}`;
    if (!isDirty || window.confirm("Discard changes?")) {
      if (isDirty) { clearDraft(draftKey); }
      push(backPath);
    }
  }
```

Logic trace:
- `isDirty = false`: `!isDirty` is true → skip confirm → push ✓
- `isDirty = true, confirm = true`: `!isDirty` is false, confirm returns true → clearDraft → push ✓
- `isDirty = true, confirm = false`: `!isDirty` is false, confirm returns false → nothing ✓

Note: no bare `return` statement — matches the no-naked-return ESLint rule.

- [ ] **Step 8: Wire `onHasChangesChange` into AppForm**

In the template, find the `<AppForm ...>` usage (around line 271):

```svelte
    <AppForm
      {fields}
      {initialValues}
      baseValues={isEdit ? serverValues : undefined}
      onSubmit={handleSubmit}
      onValuesChange={(vals) => saveDraft(draftKey, vals)}
      onSuccess={handleSuccess}
      submitLabel="Submit for review"
    />
```

Replace with:

```svelte
    <AppForm
      {fields}
      {initialValues}
      baseValues={isEdit ? serverValues : undefined}
      onSubmit={handleSubmit}
      onValuesChange={(vals) => saveDraft(draftKey, vals)}
      onHasChangesChange={(changed) => { isDirty = changed; }}
      onSuccess={handleSuccess}
      submitLabel="Submit for review"
    />
```

- [ ] **Step 9: Rewire the Cancel button**

Find the Cancel button in the template:

```svelte
      <button
        class="loc-form__cancel"
        onclick={() =>
          push(`/editor/locations/${params.project}/${params.city}`)}
      >
        Cancel
      </button>
```

Replace with:

```svelte
      <button
        class="loc-form__cancel"
        onclick={handleCancel}
      >
        Cancel
      </button>
```

- [ ] **Step 10: Run tests to verify they pass**

```
npm run test -- EditorLocationForm
```

Expected: all EditorLocationForm tests pass (the 6 new tests plus all pre-existing ones).

- [ ] **Step 11: Run the full test suite**

```
npm run test
```

Expected: all tests pass, 0 failures.

- [ ] **Step 12: Run lint**

```
npm run lint
```

Expected: 0 errors.

- [ ] **Step 13: Commit**

```
git add src/pages/editor/EditorLocationForm.svelte src/test/EditorLocationForm.test.ts
git commit -m "feat: cancel confirms and discards draft; title bar shows dirty state"
```
