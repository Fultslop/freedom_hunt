# Task 01 — Fix filename resolution bug

**Files:**
- Modify: `src/pages/editor/EditorLocationForm.svelte` (around line 78)
- Modify: `src/test/EditorLocationForm.test.ts`

**Context:** In `handleSubmit`, `resolvedFilename` is always computed from `params.newId ?? 0` + the identity slug. For edit routes, `params.newId` is `undefined`, so `params.newId ?? 0 = 0`, producing `000_loc_binnenhof.yaml` instead of `001_loc_binnenhof.yaml`. This makes the backend update the wrong file and `addPending` store the wrong key, so the PR badge never appears in the list.

---

- [ ] **Step 1: Write the failing test**

In `src/test/EditorLocationForm.test.ts`:

1. Add two imports to the existing top-level import section (after the existing `import EditorLocationForm` line):

```ts
import { saveEditorLocation, fetchEditorLocation } from "../utils/api";
```

2. Add the following test at the end of the file:

```ts
test("edit: calls saveEditorLocation with original filename, not a recomputed one", async () => {
  vi.mocked(fetchEditorLocation).mockResolvedValueOnce({
    ok: true,
    sha: "def456",
    location: {
      locationId: 1,
      title: "Binnenhof",
      address: "Binnenhof 1",
      coordinates: { latitude: 52.0799, longitude: 4.3133 },
      storyline: "Story",
      breadcrumb: "",
      name: { label: "", value: "" },
      challenge: { name: "", description: "", notes: "", form: [] },
    },
  });

  render(EditorLocationForm, {
    props: {
      params: {
        project: "democrats_abroad",
        city: "den_haag",
        filename: "001_loc_binnenhof.yaml",
        newId: undefined as unknown as number,
      },
    },
  });

  // Wait for the form to load server data
  await screen.findByLabelText(/^Title$/i);

  // Change the title so the submit button is enabled
  await fireEvent.input(screen.getByLabelText(/^Title$/i), {
    target: { value: "Binnenhof Updated" },
  });

  await fireEvent.click(
    screen.getByRole("button", { name: /submit for review/i }),
  );

  await waitFor(() => {
    expect(vi.mocked(saveEditorLocation)).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "001_loc_binnenhof.yaml" }),
    );
    // Specifically must NOT be the buggy recomputed filename
    expect(vi.mocked(saveEditorLocation)).not.toHaveBeenCalledWith(
      expect.objectContaining({ filename: "000_loc_binnenhof.yaml" }),
    );
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```
npx vitest run src/test/EditorLocationForm.test.ts --reporter=verbose
```

Expected: FAIL — `saveEditorLocation` is called with `"000_loc_binnenhof.yaml"` (the bug).

- [ ] **Step 3: Apply the fix**

In `src/pages/editor/EditorLocationForm.svelte`, replace the `resolvedFilename` line inside `handleSubmit` (around line 78):

**Before:**
```ts
const resolvedFilename = locationFilenameToString(
  createLocationFilename(
    params.newId ?? 0,
    (nested["identity"] as string) ?? "",
  ),
);
```

**After:**
```ts
const resolvedFilename =
  isEdit && params.filename
    ? params.filename
    : locationFilenameToString(
        createLocationFilename(
          params.newId ?? 0,
          (nested["identity"] as string) ?? "",
        ),
      );
```

- [ ] **Step 4: Run the test to confirm it passes**

```
npx vitest run src/test/EditorLocationForm.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 5: Run the full suite to confirm no regressions**

```
npx vitest run --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```
git add src/pages/editor/EditorLocationForm.svelte src/test/EditorLocationForm.test.ts
git commit -m "fix: use original filename for edit submissions in EditorLocationForm"
```
