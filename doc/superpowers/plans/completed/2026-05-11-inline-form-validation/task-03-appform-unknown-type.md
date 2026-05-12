# Task 03 — AppForm: render "unrecognized field" for unknown types

**Files:**
- Modify: `src/components/AppForm.svelte`
- Modify: `src/components/AppForm.css`
- Modify: `src/test/AppForm.test.ts` (add one test)

---

- [ ] **Step 1: Write the failing test**

Add this test to `src/test/AppForm.test.ts` (alongside the existing rendering tests):

```ts
test("renders 'unrecognized field' label for unknown field type", () => {
  const fields: FormField[] = [
    { id: "bad", type: "inline_form" as FormFieldType, label: "Bad Field" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(
    screen.getByText("unrecognized field 'bad'"),
  ).toBeInTheDocument();
});
```

Add `FormFieldType` to the import at the top of the test file:

```ts
import type { FormField, FormFieldType } from "../types/data";
```

- [ ] **Step 2: Run the failing test**

```
npm run test -- --reporter=verbose AppForm
```

Expected: FAIL — the current template renders the field label but not the
"unrecognized field" message.

- [ ] **Step 3: Update `AppForm.svelte` template**

In `src/components/AppForm.svelte`, replace the opening of the `{#each}` block
(currently starting with `{#if field.type === "section"}`) with a new first branch
that catches unknown types. The full `{#each}` block becomes:

```svelte
  {#each fields as field (field.id ?? field.label)}
    {#if !VALID_TYPES.includes(field.type)}
      <div class="af-field af-field--unknown">
        unrecognized field '{field.id ?? field.label}'
      </div>
    {:else if field.type === "section"}
      <div class="af-section-heading">{field.label}</div>
    {:else}
      {@const id = field.id!}
      {@const err = errors[id]}
      <div class="af-field">
        {#if field.type === "photo"}
          <div class="af-photo-wrap">
            <button
              class="af-photo-btn"
              onclick={() => fileInput?.click()}
              disabled={uploadState === "uploading"}
            >
              <Camera size={16} aria-hidden="true" />
              {uploadState === "success"
                ? "Photo uploaded ✓"
                : uploadState === "uploading"
                  ? "Uploading…"
                  : field.label}
            </button>
            <input
              {id}
              type="file"
              accept="image/*"
              capture="environment"
              class="af-photo-input"
              bind:this={fileInput}
              onchange={handleFileChange}
            />
            {#if uploadState === "error"}
              <p class="af-photo-error">Upload failed. Try again.</p>
            {/if}
          </div>
        {:else if field.type === "boolean"}
          <label class="af-label--checkbox">
            {field.label}
            <input
              {id}
              type="checkbox"
              class="af-checkbox"
              bind:checked={values[id] as boolean}
            />
          </label>
        {:else}
          <label class="af-label" for={id}>{field.label}</label>
          {#if err}<p class="af-error-msg">{err}</p>{/if}
          {#if field.type === "string"}
            <input
              {id}
              type="text"
              class="af-input"
              class:af-input--error={err}
              bind:value={values[id] as string}
            />
          {:else if field.type === "textarea"}
            <textarea
              {id}
              class="af-textarea"
              class:af-textarea--error={err}
              bind:value={values[id] as string}
            ></textarea>
          {:else if field.type === "number"}
            <input
              {id}
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              class="af-input"
              class:af-input--error={err}
              bind:value={values[id] as number}
              oninput={(e) => {
                const inputEl = e.target as HTMLInputElement;
                inputEl.value = inputEl.value.replace(/[^0-9]/g, "");
              }}
            />
          {:else if field.type === "radio"}
            <div class="af-radio-group">
              {#each field.options ?? [] as opt (opt)}
                <label class="af-label--radio">
                  <input
                    type="radio"
                    name={id}
                    value={opt}
                    bind:group={values[id] as string}
                  />
                  {opt}
                </label>
              {/each}
            </div>
          {:else if field.type === "multiple"}
            {#if maxWarningKeys[id]}
              {#key maxWarningKeys[id]}
                <p class="af-max-warning">You can only select {field.max}</p>
              {/key}
            {/if}
            <div class="af-radio-group">
              {#each field.options ?? [] as opt (opt)}
                <label class="af-label--radio">
                  <input
                    type="checkbox"
                    value={opt}
                    checked={((values[id] as string[]) ?? []).includes(opt)}
                    onchange={(evt) => {
                      const target = evt.target as HTMLInputElement;
                      const cur = (values[id] as string[]) ?? [];
                      if (
                        target.checked &&
                        field.max !== undefined &&
                        cur.length >= field.max
                      ) {
                        target.checked = false;
                        maxWarningKeys = {
                          ...maxWarningKeys,
                          [id]: (maxWarningKeys[id] ?? 0) + 1,
                        };
                      } else {
                        values[id] = target.checked
                          ? [...cur, opt]
                          : cur.filter((v) => v !== opt);
                      }
                    }}
                  />
                  {opt}
                </label>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  {/each}
```

The only change from the original is: the new `{#if !VALID_TYPES.includes(field.type)}` branch at the top, and the original `{#if field.type === "section"}` is now `{:else if field.type === "section"}`. Everything else is identical.

- [ ] **Step 4: Add the CSS rule**

Append to `src/components/AppForm.css`:

```css
.af-field--unknown {
  font-family: monospace;
  font-size: var(--font-size-sm);
  color: var(--color-error);
  padding: 6px 8px;
  border: 1px dashed var(--color-error);
  border-radius: 4px;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```
npm run test -- --reporter=verbose AppForm
```

Expected: PASS — all existing AppForm tests still pass, and the new test passes.

- [ ] **Step 6: Run the full test suite and lint**

```
npm run test:run
npm run lint
```

Expected: all tests pass, 0 lint errors.

- [ ] **Step 7: Commit**

```
git add src/components/AppForm.svelte src/components/AppForm.css src/test/AppForm.test.ts
git commit -m "feat: render 'unrecognized field' for unknown types in AppForm"
```
