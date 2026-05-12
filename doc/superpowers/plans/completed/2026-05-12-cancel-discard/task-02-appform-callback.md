# Task 02 — AppForm `onHasChangesChange` Callback

**Goal:** Add an optional `onHasChangesChange` prop to `AppForm` that fires whenever the internal `hasChanges` derived state flips, so parent components can track dirty state without duplicating comparison logic.

**Files:**
- Modify: `src/components/AppForm.svelte`
- Test: `src/test/AppForm.test.ts`

---

- [ ] **Step 1: Write failing tests**

Open `src/test/AppForm.test.ts`. Add these two tests after the existing ones:

```ts
test("calls onHasChangesChange(true) when a field value differs from initialValues", async () => {
  const onHasChangesChange = vi.fn();
  const fields: FormField[] = [
    { id: "name", type: "string", label: "Name" },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { name: "Alice" },
      onSubmit: vi.fn(),
      onHasChangesChange,
    },
  });
  await fireEvent.input(screen.getByLabelText("Name"), {
    target: { value: "Bob" },
  });
  await waitFor(() => {
    expect(onHasChangesChange).toHaveBeenCalledWith(true);
  });
});

test("calls onHasChangesChange(false) when value is restored to initialValues", async () => {
  const onHasChangesChange = vi.fn();
  const fields: FormField[] = [
    { id: "name", type: "string", label: "Name" },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { name: "Alice" },
      onSubmit: vi.fn(),
      onHasChangesChange,
    },
  });
  const input = screen.getByLabelText("Name");
  await fireEvent.input(input, { target: { value: "Bob" } });
  await fireEvent.input(input, { target: { value: "Alice" } });
  await waitFor(() => {
    expect(onHasChangesChange).toHaveBeenLastCalledWith(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm run test -- AppForm
```

Expected: 2 failures — `onHasChangesChange is not a function` or callback never called.

- [ ] **Step 3: Add the prop to AppForm**

In `src/components/AppForm.svelte`, find the `$props()` destructuring (around line 50). Add `onHasChangesChange` to the destructuring and its type to the annotation.

Before:
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

After:
```ts
  let {
    fields,
    initialValues = {},
    baseValues = undefined,
    onSubmit,
    onPhotoUpload = undefined,
    onSuccess = undefined,
    onValuesChange = undefined,
    onHasChangesChange = undefined,
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
    onHasChangesChange?: (hasChanges: boolean) => void;
    submitLabel?: string;
    confirmMessage?: string;
  } = $props();
```

- [ ] **Step 4: Add the effect**

In `src/components/AppForm.svelte`, find the existing `$effect` that calls `onValuesChange` (around line 90):

```ts
  $effect(() => {
    onValuesChange?.({ ...values });
  });
```

Add a new `$effect` directly after it:

```ts
  $effect(() => {
    onHasChangesChange?.(hasChanges);
  });
```

- [ ] **Step 5: Run tests to verify they pass**

```
npm run test -- AppForm
```

Expected: all AppForm tests pass (the two new tests plus all pre-existing ones).

- [ ] **Step 6: Run lint**

```
npm run lint
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```
git add src/components/AppForm.svelte src/test/AppForm.test.ts
git commit -m "feat: add onHasChangesChange callback to AppForm"
```
