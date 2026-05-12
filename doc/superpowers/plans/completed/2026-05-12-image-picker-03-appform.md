# Task 03 — AppForm integration

**Files:**
- Modify: `src/components/AppForm.svelte`
- Modify: `src/components/AppForm.css`
- Modify: `src/test/AppForm.test.ts`

**Context:**
This task wires the `image-picker` field type into `AppForm.svelte`. Key changes:

1. Add `STR_IMAGE_PICKER` constant and include it in `VALID_TYPES`
2. Import `getAvailableImages` and `ImagePickerDialog`
3. Add state to track which field's dialog is open and the trigger element reference
4. Add an `image-picker` branch in `validateValues()` (not in `canSkipValidation` — we want required fields validated)
5. Add a rendering branch in the template showing three states: no image selected, image selected (with thumbnail), unknown image filename (with warning)
6. The dialog is rendered via `use:portal` (already defined in `AppForm`)

The spec notes `image-picker` should be added to `canSkipValidation`, but that would prevent required fields from being validated. The correct implementation is an explicit branch in `validateValues()`, which achieves the same effect (not validated as a string) while supporting required field validation.

In tests, mock `../utils/images` so no real glob is called.

---

- [ ] **Step 1: Add mock and failing tests to `src/test/AppForm.test.ts`**

At the top of `src/test/AppForm.test.ts`, after the existing imports, add the mock:

```ts
vi.mock("../utils/images", () => ({
  getAvailableImages: () => [
    { filename: "logo.jpg", url: "/assets/logo.jpg" },
    { filename: "photo.png", url: "/assets/photo.png" },
  ],
}));
```

Then append these tests at the end of the file:

```ts
// ---------------------------------------------------------------------------
// image-picker field
// ---------------------------------------------------------------------------

test("image-picker renders 'Choose image' button when value is empty", () => {
  const fields: FormField[] = [
    { id: "image", type: "image-picker" as FormFieldType, label: "Image" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(
    screen.getByRole("button", { name: /choose image/i }),
  ).toBeInTheDocument();
});

test("image-picker opens dialog and selects image on tile click", async () => {
  const fields: FormField[] = [
    { id: "image", type: "image-picker" as FormFieldType, label: "Image" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  await fireEvent.click(screen.getByRole("button", { name: /choose image/i }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await fireEvent.click(screen.getByRole("button", { name: "logo.jpg" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: "logo.jpg" })).toBeInTheDocument();
  expect(screen.getByText("logo.jpg")).toBeInTheDocument();
});

test("image-picker shows warning for unknown filename in initialValues", () => {
  const fields: FormField[] = [
    { id: "image", type: "image-picker" as FormFieldType, label: "Image" },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { image: "missing.jpg" },
      onSubmit: vi.fn(),
    },
  });
  expect(
    screen.getByText("⚠ file missing.jpg not found in project"),
  ).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

test("required image-picker shows Required error when empty on submit", async () => {
  const fields: FormField[] = [
    {
      id: "image",
      type: "image-picker" as FormFieldType,
      label: "Image",
      isRequired: true,
    },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { image: "logo.jpg" },
      onSubmit: vi.fn(),
    },
  });
  // Open dialog and select None to set value to ""
  await fireEvent.click(screen.getByRole("button", { name: /change/i }));
  await fireEvent.click(screen.getByRole("button", { name: /none/i }));
  // hasChanges is now true ("" !== "logo.jpg"), submit is enabled
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.getByText("Required")).toBeInTheDocument();
});

test("optional image-picker with empty value passes validation", async () => {
  const fields: FormField[] = [
    {
      id: "image",
      type: "image-picker" as FormFieldType,
      label: "Image",
      isRequired: false,
    },
  ];
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(AppForm, {
    props: {
      fields,
      initialValues: { image: "logo.jpg" },
      onSubmit,
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: /change/i }));
  await fireEvent.click(screen.getByRole("button", { name: /none/i }));
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.queryByText("Required")).not.toBeInTheDocument();
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
});
```

- [ ] **Step 2: Run tests to confirm new tests fail**

```
npm test -- src/test/AppForm.test.ts
```

Expected: all existing tests pass; the 5 new tests fail (field type not recognised yet).

- [ ] **Step 3: Add image-picker CSS to `src/components/AppForm.css`**

Append to the end of `src/components/AppForm.css`:

```css
.af-image-picker {
  margin-top: 4px;
}

.af-image-picker__choose,
.af-image-picker__change {
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
}

.af-image-picker__selected {
  display: flex;
  align-items: center;
  gap: 10px;
}

.af-image-picker__thumb {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.af-image-picker__name {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  word-break: break-all;
}

.af-image-picker__unknown {
  display: flex;
  align-items: center;
  gap: 10px;
}

.af-image-picker__warning {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-error);
}
```

- [ ] **Step 4: Add imports and constants to `src/components/AppForm.svelte`**

In the `<script lang="ts">` block, after the existing `import "./AppForm.css";` line, add:

```ts
import { getAvailableImages, type ImageEntry } from "../utils/images";
import ImagePickerDialog from "./ImagePickerDialog.svelte";
```

After the existing constants block (after `const STR_SECTION = "section";`), add:

```ts
const STR_IMAGE_PICKER = "image-picker";
```

In the `VALID_TYPES` array, add `STR_IMAGE_PICKER`:

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

- [ ] **Step 5: Add image picker state and helpers**

After the existing `let maxWarningKeys = $state<Record<string, number>>({});` line, add:

```ts
const availableImages: ImageEntry[] = getAvailableImages();
let imagePickerOpenId = $state<string | null>(null);
let imagePickerTrigger: HTMLButtonElement | undefined;

function openImagePicker(id: string, trigger: HTMLButtonElement) {
  imagePickerOpenId = id;
  imagePickerTrigger = trigger;
}

function closeImagePicker() {
  imagePickerOpenId = null;
  imagePickerTrigger?.focus();
}
```

- [ ] **Step 6: Add `image-picker` validation branch in `validateValues()`**

In `validateValues()`, after the existing `else if (field.type === STR_MULTIPLE)` block, add:

```ts
} else if (field.type === STR_IMAGE_PICKER) {
  const iv = (values[field.id] as string | undefined) ?? "";
  if (iv === "") { errs[field.id] = MSG_REQUIRED; }
}
```

The complete `validateValues` function after the change:

```ts
function validateValues(): Record<string, string> {
  const errs: Record<string, string> = {};
  for (const field of fields) {
    if (!field.id || canSkipValidation(field) || !field.isRequired) {
      // skip validation for these types
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
    } else if (field.type === STR_IMAGE_PICKER) {
      const iv = (values[field.id] as string | undefined) ?? "";
      if (iv === "") { errs[field.id] = MSG_REQUIRED; }
    }
  }
  return errs;
}
```

- [ ] **Step 7: Add `image-picker` rendering branch in the template**

In the `<div class="app-form">` template, inside the `{:else}` block (the one that renders labels), after the closing `{/if}` of the `{:else if field.type === "multiple"}` branch, add a new branch before the outer `{/if}`:

```svelte
{:else if field.type === "image-picker"}
  {@const currentImg = (values[id] as string | undefined) ?? ""}
  {@const matchedImg = availableImages.find((img) => img.filename === currentImg)}
  <div class="af-image-picker" {id}>
    {#if currentImg === ""}
      <button
        type="button"
        class="af-image-picker__choose"
        onclick={(e) => openImagePicker(id, e.currentTarget as HTMLButtonElement)}
      >
        Choose image
      </button>
    {:else if matchedImg}
      <div class="af-image-picker__selected">
        <img
          src={matchedImg.url}
          alt={currentImg}
          class="af-image-picker__thumb"
        />
        <span class="af-image-picker__name">{currentImg}</span>
        <button
          type="button"
          class="af-image-picker__change"
          onclick={(e) => openImagePicker(id, e.currentTarget as HTMLButtonElement)}
        >
          Change
        </button>
      </div>
    {:else}
      <div class="af-image-picker__unknown">
        <span class="af-image-picker__warning"
          >⚠ file {currentImg} not found in project</span
        >
        <button
          type="button"
          class="af-image-picker__change"
          onclick={(e) => openImagePicker(id, e.currentTarget as HTMLButtonElement)}
        >
          Change
        </button>
      </div>
    {/if}
    {#if imagePickerOpenId === id}
      <div use:portal>
        <ImagePickerDialog
          currentValue={currentImg}
          images={availableImages}
          onSelect={(filename) => {
            values[id] = filename;
            closeImagePicker();
          }}
          onCancel={closeImagePicker}
        />
      </div>
    {/if}
  </div>
```

The full structure of the inner `{:else}` block after all changes:

```svelte
{:else}
  <label class="af-label" class:af-label--required={field.isRequired} for={id}>{field.label}</label>
  {#if err}<p class="af-error-msg">{err}</p>{/if}
  {#if field.type === "string"}
    <input ... />
  {:else if field.type === "textarea"}
    <textarea ...></textarea>
  {:else if field.type === "number"}
    <input ... />
  {:else if field.type === "radio"}
    <div class="af-radio-group">...</div>
  {:else if field.type === "multiple"}
    ...
    <div class="af-radio-group">...</div>
  {:else if field.type === "image-picker"}
    ... (the block from above)
  {/if}
{/if}
```

- [ ] **Step 8: Run tests to confirm all pass**

```
npm test -- src/test/AppForm.test.ts
```

Expected: all tests including the 5 new ones pass.

- [ ] **Step 9: Run the full test suite and linter**

```
npm test
npm run lint
```

Expected: all tests pass, no lint errors.

- [ ] **Step 10: Commit**

```
git add src/components/AppForm.svelte src/components/AppForm.css src/test/AppForm.test.ts
git commit -m "feat: add image-picker field type to AppForm"
```
