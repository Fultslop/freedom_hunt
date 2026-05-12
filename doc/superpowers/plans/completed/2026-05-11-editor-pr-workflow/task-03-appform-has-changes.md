# Task 03 — AppForm: `hasChanges`, `baseValues`, `onValuesChange`

**Files:**
- Modify: `src/components/AppForm.svelte`
- Modify: `src/test/AppForm.test.ts`

**Context:** Three additions to `AppForm`:
1. `hasChanges` — derived boolean comparing current values against a baseline. Disables the submit button and relabels it "No changes" when false.
2. `baseValues` — optional prop. When provided, `hasChanges` compares against `baseValues` instead of `initialValues`. This is needed so that a form pre-populated with a draft (which differs from the server data) correctly shows `hasChanges = true`.
3. `onValuesChange` — optional callback fired via `$effect` on every form change. Used by `EditorLocationForm` for draft auto-save.

---

- [ ] **Step 1: Write failing tests**

Add to the end of `src/test/AppForm.test.ts`:

```ts
// ---------------------------------------------------------------------------
// hasChanges
// ---------------------------------------------------------------------------

test("submit button shows 'No changes' and is disabled when values equal initialValues", async () => {
  const fields: FormField[] = [
    { id: "title", type: "string", label: "Title" },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { title: "Binnenhof" },
      onSubmit: vi.fn(),
    },
  });
  const btn = await screen.findByRole("button", { name: /no changes/i });
  expect(btn).toBeDisabled();
});

test("submit button is enabled after user changes a field", async () => {
  const fields: FormField[] = [
    { id: "title", type: "string", label: "Title" },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { title: "Binnenhof" },
      onSubmit: vi.fn(),
    },
  });
  await fireEvent.input(screen.getByLabelText("Title"), {
    target: { value: "Binnenhof Updated" },
  });
  const btn = screen.getByRole("button", { name: /submit/i });
  expect(btn).not.toBeDisabled();
});

test("baseValues overrides initialValues as the hasChanges baseline", async () => {
  const fields: FormField[] = [
    { id: "title", type: "string", label: "Title" },
  ];
  // initialValues = draft (differs from server)
  // baseValues = server data (the committed baseline)
  render(AppForm, {
    props: {
      fields,
      initialValues: { title: "Draft Title" },
      baseValues: { title: "Server Title" },
      onSubmit: vi.fn(),
    },
  });
  // Form pre-populated with "Draft Title", which differs from baseValues "Server Title"
  // → hasChanges = true → submit is enabled (not "No changes")
  const btn = await screen.findByRole("button", { name: /submit/i });
  expect(btn).not.toBeDisabled();
  expect(btn).not.toHaveTextContent(/no changes/i);
});

// ---------------------------------------------------------------------------
// onValuesChange
// ---------------------------------------------------------------------------

test("onValuesChange is called when a field value changes", async () => {
  const fields: FormField[] = [
    { id: "title", type: "string", label: "Title" },
  ];
  const onValuesChange = vi.fn();
  render(AppForm, {
    props: { fields, onSubmit: vi.fn(), onValuesChange },
  });
  await fireEvent.input(screen.getByLabelText("Title"), {
    target: { value: "hello" },
  });
  await waitFor(() => {
    expect(onValuesChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: "hello" }),
    );
  });
});
```

- [ ] **Step 2: Run to confirm they fail**

```
npx vitest run src/test/AppForm.test.ts --reporter=verbose
```

Expected: new tests FAIL.

- [ ] **Step 3: Update `AppForm.svelte` props interface**

In the `$props()` destructure (around line 42), add `baseValues` and `onValuesChange`:

```ts
let {
  fields,
  initialValues = {},
  baseValues = undefined,
  onSubmit,
  onPhotoUpload = undefined,
  onSuccess = undefined,
  onValuesChange = undefined,
  submitLabel = "Submit",
  confirmMessage = undefined,
}: {
  fields: FormField[];
  initialValues?: Record<string, unknown>;
  baseValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onPhotoUpload?: (file: File) => Promise<{ ok: boolean }>;
  onSuccess?: () => void;
  onValuesChange?: (values: FieldValues) => void;
  submitLabel?: string;
  confirmMessage?: string;
} = $props();
```

- [ ] **Step 4: Add `hasChanges` derived and `onValuesChange` effect**

After the `let values = $state<FieldValues>(...)` line (around line 60), add:

```ts
const hasChanges = $derived(
  fields
    .filter((f) => f.id && f.type !== STR_SECTION)
    .some((f) => {
      const id = f.id!;
      const curr = values[id];
      const baseline = baseValues
        ? (baseValues as Record<string, unknown>)[id]
        : (initialValues as Record<string, unknown>)[id];
      if (Array.isArray(curr) || Array.isArray(baseline)) {
        return (
          JSON.stringify(curr ?? []) !== JSON.stringify(baseline ?? [])
        );
      }
      return curr !== baseline;
    }),
);

$effect(() => {
  onValuesChange?.({ ...values });
});
```

- [ ] **Step 5: Update the submit button**

The submit button is rendered in two places in `AppForm.svelte` — inside the `{:else}` block (no `confirmMessage`) and the button that shows when `confirmMessage` is set. Both need the `disabled` and label update.

Replace the `{:else}` button block (around line 332):

```svelte
{:else}
  <button
    class="af-submit-btn"
    class:af-submit-btn--submitting={submitState === "submitting"}
    onclick={handleSubmit}
    disabled={submitState === "submitting" || !hasChanges}
  >
    {submitState === "submitting"
      ? "Submitting…"
      : !hasChanges
        ? "No changes"
        : submitState === "error"
          ? "Try again"
          : submitLabel}
  </button>
{/if}
```

- [ ] **Step 6: Run tests to confirm they pass**

```
npx vitest run src/test/AppForm.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 7: Fix the affected test in `EditorLocationForm.test.ts`**

After Task 03 is applied, the existing test `"renders form in new-location mode"` will fail because the submit button now says "No changes" (no `initialValues`, all fields `undefined`, `hasChanges = false`).

In `src/test/EditorLocationForm.test.ts`, update that test:

```ts
// Before:
expect(
  await screen.findByRole("button", { name: /submit for review/i }),
).toBeInTheDocument();

// After:
expect(
  await screen.findByRole("button", { name: /no changes/i }),
).toBeInTheDocument();
```

- [ ] **Step 8: Run the full suite**

```
npx vitest run --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 9: Commit**

```
git add src/components/AppForm.svelte src/test/AppForm.test.ts src/test/EditorLocationForm.test.ts
git commit -m "feat: add hasChanges, baseValues, onValuesChange to AppForm"
```
