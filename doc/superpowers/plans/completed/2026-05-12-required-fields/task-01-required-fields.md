# Task 01 – Required field validation + asterisk

**Files:**
- Modify: `src/components/AppForm.svelte` — `validateValues()` + label template
- Modify: `src/components/AppForm.css` — add `.af-label--required::after`
- Modify: `src/test/AppForm.test.ts` — update 2 existing tests, add 2 new tests

---

- [ ] **Step 1: Update the two existing required-error tests to add `isRequired: true`**

In `src/test/AppForm.test.ts`, find the test `"shows required error for empty string field on submit"` (around line 116) and add `isRequired: true` to the field:

```typescript
test("shows required error for empty string field on submit", async () => {
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Your note", isRequired: true },
  ];
  // rest of test unchanged
```

Find the test `"shows required error for empty textarea on submit"` (around line 132) and add `isRequired: true`:

```typescript
test("shows required error for empty textarea on submit", async () => {
  const fields: FormField[] = [
    { id: "story", type: "textarea", label: "Your story", isRequired: true },
  ];
  // rest of test unchanged
```

- [ ] **Step 2: Add two new tests**

Append these two tests to the `// Validation` section of `src/test/AppForm.test.ts`:

```typescript
test("does not show required error for non-required empty string on submit", async () => {
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Your note", isRequired: false },
  ];
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(AppForm, { props: { fields, onSubmit } });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "x" },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.queryByText("Required")).not.toBeInTheDocument();
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
});

test("required field label has af-label--required class, non-required does not", () => {
  const fields: FormField[] = [
    { id: "title", type: "string", label: "Title", isRequired: true },
    { id: "note", type: "string", label: "Note" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  const titleLabel = screen.getByLabelText("Title").closest(".af-field")?.querySelector("label");
  const noteLabel = screen.getByLabelText("Note").closest(".af-field")?.querySelector("label");
  expect(titleLabel).toHaveClass("af-label--required");
  expect(noteLabel).not.toHaveClass("af-label--required");
});
```

- [ ] **Step 3: Run the tests to verify the new tests fail**

```
npm run test -- --reporter=verbose src/test/AppForm.test.ts
```

Expected: the two updated existing tests now fail (field has no `isRequired` in the implementation yet), and the two new tests also fail. Other tests pass.

- [ ] **Step 4: Gate `validateValues()` on `isRequired`**

In `src/components/AppForm.svelte`, find `validateValues()` (around line 149) and add `|| !field.isRequired` to the skip condition:

```typescript
function validateValues(): Record<string, string> {
  const errs: Record<string, string> = {};
  for (const field of fields) {
    if (!field.id || canSkipValidation(field) || !field.isRequired) {
      // skip validation
    } else if (field.type === STR_STRING || field.type === STR_TEXTAREA) {
      const v = values[field.id] as string | undefined;
      if (!v || v.trim() === "") {
        errs[field.id] = MSG_REQUIRED;
      }
    } else if (field.type === STR_NUMBER) {
      const v = values[field.id];
      if (v === undefined || v === null || (typeof v === "number" && isNaN(v))) {
        errs[field.id] = MSG_REQUIRED;
      }
    } else if (field.type === STR_RADIO) {
      if (!values[field.id]) { errs[field.id] = MSG_SELECT_OPTION; }
    } else if (field.type === STR_MULTIPLE) {
      const selected = (values[field.id] as string[]) ?? [];
      const min = field.min ?? 1;
      if (selected.length < min) {
        errs[field.id] = MSG_SELECT_MIN(min);
      }
    }
  }
  return errs;
}
```

- [ ] **Step 5: Add the `af-label--required` modifier class to the label in the template**

In `src/components/AppForm.svelte`, find the label line inside the `{:else}` block (around line 264):

```svelte
<label class="af-label" for={id}>{field.label}</label>
```

Change it to:

```svelte
<label class="af-label" class:af-label--required={field.isRequired} for={id}>{field.label}</label>
```

- [ ] **Step 6: Add the CSS rule for the asterisk**

In `src/components/AppForm.css`, append at the end of the `.af-label` block (after line 24):

```css
.af-label--required::after {
  content: " *";
  color: var(--color-error);
}
```

- [ ] **Step 7: Run the full AppForm test suite**

```
npm run test -- --reporter=verbose src/test/AppForm.test.ts
```

Expected: all tests pass, including the two updated and two new tests.

- [ ] **Step 8: Run the full test suite**

```
npm test
```

Expected: all tests pass, 0 failures.

- [ ] **Step 9: Commit**

```
git add src/components/AppForm.svelte src/components/AppForm.css src/test/AppForm.test.ts
git commit -m "feat: gate AppForm validation on isRequired, show asterisk on required labels"
```
