# Task 04: Create `AppForm.svelte` + `AppForm.css`

**Files:**
- Create: `src/components/AppForm.svelte`
- Create: `src/components/AppForm.css`

Generic form component. Renders all `FormField` types including the new `textarea` and `section`. Calls `onSubmit` with nested values (built from dotted-path IDs). Optionally shows a confirmation dialog before submit. Calls `onSuccess` after a successful submit so wrappers can switch to their own success UI.

No hard-coded endpoints. No `authStore` dependency.

---

- [ ] **Step 1: Create `src/components/AppForm.css`**

```css
/* src/components/AppForm.css */

.af-field {
  margin-bottom: 12px;
}

.af-section-heading {
  font-size: var(--font-size-sm);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-secondary);
  margin-top: 20px;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--color-border);
}

.af-label {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text);
  display: block;
}

.af-label--checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
}

.af-label--radio {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: var(--font-size-base);
  font-weight: 400;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.af-checkbox {
  width: 16px;
  height: 16px;
}

.af-radio-group {
  margin-top: 6px;
}

.af-max-warning {
  font-size: var(--font-size-sm);
  color: var(--color-error);
  margin-top: 4px;
  animation: af-fade-out 1.5s ease forwards;
}

@keyframes af-fade-out {
  0%,
  60% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.af-input,
.af-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: var(--font-size-base);
  margin-top: 4px;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
}

.af-input:focus,
.af-textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.af-textarea {
  resize: vertical;
  min-height: 80px;
}

.af-input--error,
.af-textarea--error {
  border-color: var(--color-error);
}

.af-error-msg {
  font-size: var(--font-size-sm);
  color: var(--color-error);
  margin-top: 2px;
}

.af-photo-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.af-photo-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
}

.af-photo-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.af-photo-input {
  display: none;
}

.af-photo-error {
  font-size: var(--font-size-sm);
  color: var(--color-error);
}

.af-submit-btn {
  width: 100%;
  padding: 10px 0;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  margin-top: 4px;
}

.af-submit-btn--submitting {
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.af-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.af-confirm-dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 24px 20px 18px;
  width: min(320px, 90vw);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.af-confirm-msg {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text);
  text-align: center;
}

.af-confirm-actions {
  display: flex;
  gap: 10px;
}

.af-confirm-cancel {
  flex: 1;
  padding: 10px 0;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
}

.af-confirm-ok {
  flex: 1;
  padding: 10px 0;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
}
```

- [ ] **Step 2: Create `src/components/AppForm.svelte`**

```svelte
<script lang="ts">
  import { Camera } from "lucide-svelte";
  import type { FormField, FormFieldType } from "../types/data";
  import { buildNestedValues } from "../utils/formValues";
  import "./AppForm.css";

  const VALID_TYPES: FormFieldType[] = [
    "string",
    "number",
    "boolean",
    "radio",
    "multiple",
    "photo",
    "textarea",
    "section",
  ];

  type SubmitState = "idle" | "submitting" | "error";
  type UploadState = "idle" | "uploading" | "success" | "error";
  type FieldValues = Record<string, string | number | boolean | string[]>;

  let {
    fields,
    initialValues = {},
    onSubmit,
    onPhotoUpload = undefined,
    onSuccess = undefined,
    submitLabel = "Submit",
    confirmMessage = undefined,
  }: {
    fields: FormField[];
    initialValues?: Record<string, unknown>;
    onSubmit: (values: Record<string, unknown>) => Promise<void>;
    onPhotoUpload?: (file: File) => Promise<{ ok: boolean }>;
    onSuccess?: () => void;
    submitLabel?: string;
    confirmMessage?: string;
  } = $props();

  let values = $state<FieldValues>({ ...(initialValues as FieldValues) });
  let errors = $state<Record<string, string>>({});
  let submitState = $state<SubmitState>("idle");
  let uploadState = $state<UploadState>("idle");
  let showConfirm = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();
  let maxWarningKeys = $state<Record<string, number>>({});

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  function checkDefinition(field: FormField): string | null {
    if (!VALID_TYPES.includes(field.type)) {
      return `unknown type "${field.type}"`;
    }
    if (field.type === "section") return null;
    if (
      (field.type === "radio" || field.type === "multiple") &&
      (!field.options || field.options.length === 0)
    ) {
      return `${field.type} field missing options`;
    }
    if (
      field.type === "multiple" &&
      (field.min == null || field.max == null)
    ) {
      return "multiple field missing min/max";
    }
    if (
      field.type === "multiple" &&
      field.min !== undefined &&
      field.max !== undefined &&
      field.min > field.max
    ) {
      return "multiple field: min > max";
    }
    return null;
  }

  async function handleFileChange(evt: Event) {
    if (!onPhotoUpload) return;
    const file = (evt.target as HTMLInputElement).files?.[0];
    if (!file) return;
    uploadState = "uploading";
    try {
      const data = await onPhotoUpload(file);
      uploadState = data.ok ? "success" : "error";
    } catch {
      uploadState = "error";
    }
  }

  function validateValues(): Record<string, string> {
    const errs: Record<string, string> = {};
    for (const field of fields) {
      if (
        !field.id ||
        field.type === "section" ||
        field.type === "boolean" ||
        field.type === "photo"
      )
        continue;
      if (field.type === "string" || field.type === "textarea") {
        const v = values[field.id] as string | undefined;
        if (!v || v.trim() === "") errs[field.id] = "Required";
      } else if (field.type === "number") {
        const v = values[field.id];
        if (
          v === undefined ||
          v === null ||
          (typeof v === "number" && isNaN(v))
        ) {
          errs[field.id] = "Required";
        }
      } else if (field.type === "radio") {
        if (!values[field.id]) errs[field.id] = "Please select an option";
      } else if (field.type === "multiple") {
        const selected = (values[field.id] as string[]) ?? [];
        const min = field.min ?? 1;
        if (selected.length < min) {
          errs[field.id] = `Please select at least ${min} option${min > 1 ? "s" : ""}`;
        }
      }
    }
    return errs;
  }

  function handleSubmit() {
    const defErrors: Record<string, string> = {};
    for (const field of fields) {
      if (!field.id || field.type === "section") continue;
      const def = checkDefinition(field);
      if (def) defErrors[field.id] = def;
    }
    errors = { ...validateValues(), ...defErrors };
    if (Object.keys(errors).length === 0) {
      if (confirmMessage) {
        showConfirm = true;
      } else {
        void doSubmit();
      }
    }
  }

  async function doSubmit() {
    showConfirm = false;
    submitState = "submitting";
    try {
      await onSubmit(
        buildNestedValues(fields, values as Record<string, unknown>),
      );
      submitState = "idle";
      onSuccess?.();
    } catch {
      submitState = "error";
    }
  }
</script>

<div class="app-form">
  {#each fields as field (field.id ?? field.label)}
    {#if field.type === "section"}
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
                const t = e.target as HTMLInputElement;
                t.value = t.value.replace(/[^0-9]/g, "");
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

  {#if showConfirm}
    <div class="af-confirm-overlay" use:portal>
      <div class="af-confirm-dialog">
        <p class="af-confirm-msg">{confirmMessage}</p>
        <div class="af-confirm-actions">
          <button
            class="af-confirm-cancel"
            onclick={() => (showConfirm = false)}
          >
            Cancel
          </button>
          <button class="af-confirm-ok" onclick={doSubmit}>Confirm</button>
        </div>
      </div>
    </div>
  {:else}
    <button
      class="af-submit-btn"
      class:af-submit-btn--submitting={submitState === "submitting"}
      onclick={handleSubmit}
      disabled={submitState === "submitting"}
    >
      {submitState === "submitting"
        ? "Submitting…"
        : submitState === "error"
          ? "Try again"
          : submitLabel}
    </button>
  {/if}
</div>
```

- [ ] **Step 3: Run lint**

```
npm run lint
```

Expected: passes cleanly.

- [ ] **Step 4: Commit**

```
git add src/components/AppForm.svelte src/components/AppForm.css
git commit -m "feat: add AppForm.svelte — generic data-driven form component"
```
