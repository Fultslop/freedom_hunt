<script lang="ts">
  import { untrack } from "svelte";
  import { Camera } from "lucide-svelte";
  import type { FormField, FormFieldType } from "../types/data";
  import { buildNestedValues } from "../utils/formValues";
  import { getAvailableImages, type ImageEntry } from "../utils/images";
  import ImagePickerDialog from "./ImagePickerDialog.svelte";
  import CoordinatePicker from "./CoordinatePicker.svelte";
  import "./AppForm.css";

  const STR_STRING = "string";
  const STR_NUMBER = "number";
  const STR_BOOLEAN = "boolean";
  const STR_RADIO = "radio";
  const STR_MULTIPLE = "multiple";
  const STR_PHOTO = "photo";
  const STR_TEXTAREA = "textarea";
  const STR_SECTION = "section";
  const STR_IMAGE_PICKER = "image-picker";
  const STR_COORD_PICKER = "coord-picker";

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
    STR_COORD_PICKER,
  ];

  const MSG_UNKNOWN_TYPE = (type: FormFieldType) => `unknown type "${type}"`;
  const MSG_RADIO_MISSING = 'radio field missing options';
  const MSG_MULTIPLE_MISSING = 'multiple field missing options';
  const MSG_MIN_MAX_MISSING = 'multiple field missing min/max';
  const MSG_MIN_GT_MAX = 'multiple field: min > max';
  const MSG_REQUIRED = "Required";
  const MSG_SELECT_OPTION = "Please select an option";
  const MSG_SELECT_MIN = (min: number) =>
    `Please select at least ${min} option${min > 1 ? "s" : ""}`;

  type SubmitState = "idle" | "submitting" | "error";
  type UploadState = "idle" | "uploading" | "success" | "error";
  type FieldValues = Record<string, string | number | boolean | string[] | { latitude: number; longitude: number }>;

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

  let values = $state<FieldValues>(untrack(() => ({ ...(initialValues as FieldValues) })));
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
          return JSON.stringify(curr ?? []) !== JSON.stringify(baseline ?? []);
        } else if (typeof curr === "object" || typeof baseline === "object") {
          return JSON.stringify(curr ?? {}) !== JSON.stringify(baseline ?? {});
        }
        return curr !== baseline;
      }),
  );

  $effect(() => {
    onValuesChange?.({ ...values });
  });
  let errors = $state<Record<string, string>>({});
  let submitState = $state<SubmitState>("idle");
  let uploadState = $state<UploadState>("idle");
  let showConfirm = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();
  let maxWarningKeys = $state<Record<string, number>>({});
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
      return MSG_UNKNOWN_TYPE(field.type);
    }
    if (field.type === STR_SECTION) {
      return null;
    }
    if (field.type === STR_RADIO || field.type === STR_MULTIPLE) {
      if (!field.options || field.options.length === 0) {
        return field.type === STR_RADIO ? MSG_RADIO_MISSING : MSG_MULTIPLE_MISSING;
      }
    }
    if (field.type === STR_MULTIPLE) {
      if (field.min == null || field.max == null) {
        return MSG_MIN_MAX_MISSING;
      }
      if (field.min > field.max) {
        return MSG_MIN_GT_MAX;
      }
    }
    return null;
  }

  async function handleFileChange(evt: Event) {
    if (onPhotoUpload) {
      const file = (evt.target as HTMLInputElement).files?.[0];
      if (file) {
        uploadState = "uploading";
        try {
          const data = await onPhotoUpload(file);
          uploadState = data.ok ? "success" : "error";
        } catch {
          uploadState = "error";
        }
      }
    }
  }

  function canSkipValidation(field: FormField): boolean {
    return (
      
      field.type === STR_SECTION ||
      field.type === STR_BOOLEAN ||
      field.type === STR_PHOTO
    );
  }

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
        const imageValue = (values[field.id] as string | undefined) ?? "";
        if (imageValue === "") { errs[field.id] = MSG_REQUIRED; }
      } else if (field.type === STR_COORD_PICKER) {
        const v = values[field.id] as { latitude: number; longitude: number } | undefined;
        if (!v || (v.latitude === 0 && v.longitude === 0)) {
          errs[field.id] = MSG_REQUIRED;
        }
      }
    }
    return errs;
  }

  function handleSubmit() {
    const defErrors: Record<string, string> = {};
    for (const field of fields) {
      if (!field.id || field.type === STR_SECTION) {
        // skip def check for section
      } else {
        const def = checkDefinition(field);
        if (def) {
          defErrors[field.id] = def;
        }
      }
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
    {#if !VALID_TYPES.includes(field.type)}
      <div class="af-field af-field--unknown">
        {field.label}
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
          <label class="af-label" class:af-label--required={field.isRequired} for={id}>{field.label}</label>
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
          {:else if field.type === "coord-picker"}
            <CoordinatePicker
              value={values[id] as { latitude: number; longitude: number }}
              onchange={(coords) => { values[id] = coords; }}
            />
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
</div>