<script lang="ts">
  import { untrack } from "svelte";
  import { Camera } from "lucide-svelte";
  import type { FormField, FormFieldType, PhotoUploadStatus, FormValidationStatus } from "../types/data";
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
  interface PhotoFieldState {
    status: UploadState;
    httpCode?: number;
  }

  let {
    fields,
    initialValues = {},
    baseValues = undefined,
    initialUploads = {},
    baseUploads = undefined,
    onSubmit,
    onPhotoUpload = undefined,
    onSuccess = undefined,
    onValuesChange = undefined,
    onHasChangesChange = undefined,
    onStatusChange = undefined,
    onUploadsChange = undefined,
    submitLabel = "Submit",
    confirmMessage = undefined,
  }: {
    fields: FormField[];
    initialValues?: Record<string, unknown>;
    baseValues?: Record<string, unknown>;
    initialUploads?: Record<string, PhotoUploadStatus>;
    baseUploads?: Record<string, PhotoUploadStatus>;
    onSubmit: (values: Record<string, unknown>) => Promise<void>;
    onPhotoUpload?: (file: File) => Promise<{ ok: boolean; httpCode?: number }>;
    onSuccess?: () => void;
    onValuesChange?: (values: FieldValues) => void;
    onHasChangesChange?: (hasChanges: boolean) => void;
    onStatusChange?: (status: FormValidationStatus) => void;
    onUploadsChange?: (uploads: Record<string, PhotoUploadStatus>) => void;
    submitLabel?: string;
    confirmMessage?: string;
  } = $props();

  // RoutePage's carousel/peek swipe strip keeps the prev/current/next cards
  // all mounted in the DOM at once, and every location's form fields reuse
  // the same YAML-authored ids (nearly every photo field is literally
  // `id: photo`). DOM ids/names must be unique per document, so without this
  // prefix, `document.getElementById(id)` in the photo button below can
  // resolve to a DIFFERENT, off-screen card's hidden file input, silently
  // uploading to (and updating the state of) the wrong location — with no
  // error, since nothing actually throws. This instance-scoped prefix is used
  // for every DOM id/for/name in the template; `field.id` itself stays the
  // key for values/uploadStates/errors, since that's what the server and
  // buildNestedValues expect.
  const instanceId = crypto.randomUUID();

  let values = $state<FieldValues>(untrack(() => ({ ...(initialValues as FieldValues) })));
  let uploadStates = $state<Record<string, PhotoFieldState>>(
    untrack(() => {
      const result: Record<string, PhotoFieldState> = {};
      for (const [id, upload] of Object.entries(initialUploads)) {
        result[id] = { status: upload.status, httpCode: upload.httpCode };
      }
      return result;
    }),
  );
  const hasChanges = $derived(
    fields
      .filter((f) => f.id && f.type !== STR_SECTION)
      .some((f) => {
        const id = f.id!;
        if (f.type === STR_PHOTO) {
          const currentStatus = uploadStates[id]?.status;
          const baselineStatus = (baseUploads ?? initialUploads)[id]?.status;
          return currentStatus !== undefined && currentStatus !== baselineStatus;
        }
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
  $effect(() => {
    onHasChangesChange?.(hasChanges);
  });
  const liveErrors = $derived(validateValues());
  const missingLabels = $derived(
    fields.filter((f) => f.id && liveErrors[f.id]).map((f) => f.label),
  );
  $effect(() => {
    onStatusChange?.({ missingLabels });
  });
  $effect(() => {
    const settled: Record<string, PhotoUploadStatus> = {};
    for (const [id, state] of Object.entries(uploadStates)) {
      if (state.status === "success" || state.status === "error") {
        settled[id] = { status: state.status, httpCode: state.httpCode ?? 0 };
      }
    }
    onUploadsChange?.(settled);
  });
  let errors = $state<Record<string, string>>({});
  let submitState = $state<SubmitState>("idle");
  let showConfirm = $state(false);
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

  async function handleFileChange(evt: Event, fieldId: string) {
    if (onPhotoUpload) {
      const file = (evt.target as HTMLInputElement).files?.[0];
      if (file) {
        uploadStates = { ...uploadStates, [fieldId]: { status: "uploading" } };
        try {
          const data = await onPhotoUpload(file);
          uploadStates = {
            ...uploadStates,
            [fieldId]: { status: data.ok ? "success" : "error", httpCode: data.httpCode },
          };
        } catch {
          uploadStates = { ...uploadStates, [fieldId]: { status: "error", httpCode: 0 } };
        }
      }
    }
  }

  function canSkipValidation(field: FormField): boolean {
    return field.type === STR_SECTION || field.type === STR_BOOLEAN;
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
      } else if (field.type === STR_PHOTO) {
        if (uploadStates[field.id]?.status !== "success") {
          errs[field.id] = MSG_REQUIRED;
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

  // A form made up only of photo field(s) (e.g. 001_form_nieuwe_kerk.yaml) has
  // nothing left for the participant to fill in once the upload succeeds —
  // the photo is already linked to this location server-side at upload time
  // (see uploadRoute.ts), so Submit only exists to record the location as
  // "done" for the progress gate. Tapping it is a redundant extra step, so we
  // fire it automatically and hide the button entirely (see the template's
  // `isPhotoOnlyForm` check on the submit button), surfacing it again only if
  // submitState becomes "error" — the participant's one manual fallback.
  // autoSubmitGuard prevents re-firing while a submit is in flight or has
  // already failed once (a failed auto-submit relies on that visible
  // "Try again" button for a manual retry rather than hammering the server in
  // a retry loop); it's released again once the parent's baseline catches up
  // (hasChanges goes false) so a later re-upload (allowResubmit) can
  // auto-submit too.
  const isPhotoOnlyForm = $derived(
    fields.some((f) => f.type === STR_PHOTO) &&
      fields.every((f) => f.type === STR_PHOTO || f.type === STR_SECTION),
  );
  const anyUploadInFlight = $derived(
    Object.values(uploadStates).some((upload) => upload.status === "uploading"),
  );
  let autoSubmitGuard = $state(false);

  $effect(() => {
    if (!hasChanges) {
      autoSubmitGuard = false;
    }
  });

  $effect(() => {
    if (
      isPhotoOnlyForm &&
      hasChanges &&
      !anyUploadInFlight &&
      !autoSubmitGuard &&
      Object.keys(liveErrors).length === 0
    ) {
      autoSubmitGuard = true;
      void doSubmit();
    }
  });
</script>

<div class="app-form">
  {#each fields as field (field.id ?? field.label)}
    {#if !VALID_TYPES.includes(field.type)}
      <div class="af-field af-field--unknown">
        {field.label}
      </div>
    {:else if field.type === "section"}
      <div class="af-section-heading">{field.label}</div>
      {#if field.subtext}<p class="af-subtext">{field.subtext}</p>{/if}
    {:else}
      {@const id = field.id!}
      {@const domId = `f-${instanceId}-${id}`}
      {@const err = errors[id]}
      <div class="af-field">
        {#if field.type === "photo"}
          {@const upload = uploadStates[id]}
          <div class="af-photo-wrap">
            <button
              class="af-photo-btn"
              onclick={() => (document.getElementById(domId) as HTMLInputElement | null)?.click()}
              disabled={upload?.status === "uploading"}
            >
              <Camera size={16} aria-hidden="true" />
              {upload?.status === "success"
                ? "Photo uploaded ✓"
                : upload?.status === "uploading"
                  ? "Uploading…"
                  : field.label}
            </button>
            {#if field.subtext}<p class="af-subtext">{field.subtext}</p>{/if}
            <input
              id={domId}
              type="file"
              accept="image/*"
              capture="environment"
              class="af-photo-input"
              onchange={(evt) => handleFileChange(evt, id)}
            />
            {#if upload?.status === "error"}
              <p class="af-photo-error">Upload failed. Try again.</p>
            {/if}
          </div>
        {:else if field.type === "boolean"}
          <label class="af-label--checkbox">
            {field.label}
            <input
              id={domId}
              type="checkbox"
              class="af-checkbox"
              bind:checked={values[id] as boolean}
            />
          </label>
          {#if field.subtext}<p class="af-subtext">{field.subtext}</p>{/if}
        {:else}
          <label class="af-label" class:af-label--required={field.isRequired} for={domId}>{field.label}</label>
          {#if field.subtext}<p class="af-subtext">{field.subtext}</p>{/if}
          {#if err}<p class="af-error-msg">{err}</p>{/if}
          {#if field.type === "string"}
            <input
              id={domId}
              type="text"
              class="af-input"
              class:af-input--error={err}
              bind:value={values[id] as string}
            />
          {:else if field.type === "textarea"}
            <textarea
              id={domId}
              class="af-textarea"
              class:af-textarea--error={err}
              bind:value={values[id] as string}
            ></textarea>
          {:else if field.type === "number"}
            <input
              id={domId}
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
                    name={domId}
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
            <div class="af-image-picker" id={domId}>
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
  {:else if !isPhotoOnlyForm || submitState === "error"}
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