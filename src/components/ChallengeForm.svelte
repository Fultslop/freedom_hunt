<script lang="ts">
  import { Camera, Flag } from "lucide-svelte";
  import { authStore } from "../stores/authStore";
  import type { FormField, FormFieldType } from "../types/data";
  import "./ChallengeForm.css";

  const VALID_TYPES: FormFieldType[] = [
    "string",
    "number",
    "boolean",
    "radio",
    "multiple",
    "photo",
  ];

  type SubmitState = "idle" | "submitting" | "success" | "error";
  type UploadState = "idle" | "uploading" | "success" | "error";
  type FieldValues = Record<string, string | number | boolean | string[]>;

  let {
    form,
    locationId,
    routeId = undefined,
  }: { form: FormField[]; locationId: number; routeId?: string } = $props();

  let values = $state<FieldValues>({});
  let errors = $state<Record<string, string>>({});
  let submitState = $state<SubmitState>("idle");
  let uploadState = $state<UploadState>("idle");
  let showConfirm = $state(false);
  let fileInput: HTMLInputElement | undefined = $state();

  function checkDefinition(field: FormField): string | null {
    if (!VALID_TYPES.includes(field.type)) return `unknown type "${field.type}"`;
    if (field.type === "radio" && (!field.options || field.options.length === 0)) {
      return "radio field missing options";
    }
    if (field.type === "multiple" && (!field.options || field.options.length === 0)) {
      return "multiple field missing options";
    }
    if (field.type === "multiple" && (field.min == null || field.max == null)) {
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
    const file = (evt.target as HTMLInputElement).files?.[0];
    if (!file) {
      return undefined;
    }
    uploadState = "uploading";
    const body = new FormData();
    body.append("photo", file);
    body.append("locationId", String(locationId));
    try {
      const res = await fetch("/upload", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean };
      uploadState = data.ok ? "success" : "error";
    } catch {
      uploadState = "error";
    }
  }

  function handleSubmit() {
    const newErrors: Record<string, string> = {};
    for (const field of form) {
      const def = checkDefinition(field);
      if (def) newErrors[field.id] = def;
    }
    errors = newErrors;
    if (Object.keys(newErrors).length === 0) showConfirm = true;
  }

  async function handleConfirm() {
    showConfirm = false;
    submitState = "submitting";
    try {
      const payload = {
        locationId,
        routeId,
        teamName: $authStore.activeAuth?.teamName ?? "",
        contact: $authStore.activeAuth?.contact ?? "",
        answers: values,
      };
      const res = await fetch("/form-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean };
      submitState = data.ok ? "success" : "error";
    } catch {
      submitState = "error";
    }
  }

  function hasPhotoField(): boolean {
    return form.some((fld) => fld.type === "photo");
  }
</script>

<div class="challenge-form">
  {#if submitState === "success"}
    <p class="cf-success">Submitted! ✓</p>
  {:else}
    {#if hasPhotoField()}
      <div class="cf-photo-wrap">
        <button
          class="cf-photo-btn"
          onclick={() => fileInput?.click()}
          disabled={uploadState === "uploading"}
        >
          <Camera size={16} aria-hidden="true" />
          {uploadState === "success" ? "Photo uploaded ✓" : uploadState === "uploading" ? "Uploading…" : "Add photo"}
        </button>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          class="cf-photo-input"
          bind:this={fileInput}
          onchange={handleFileChange}
        />
        {#if uploadState === "error"}
          <p class="cf-upload-error">Upload failed. Try again.</p>
        {/if}
      </div>
    {/if}

    <div class="cf-divider" aria-hidden="true">
      <span class="cf-divider__line"></span>
      <Flag size={12} aria-hidden="true" />
      <span class="cf-divider__line"></span>
    </div>

    {#each form as field (field.id)}
      {#if field.type !== "photo"}
        {@const err = errors[field.id]}
        <div class="cf-field">
          <label class="cf-label" for={field.id}>{field.label}</label>
          {#if field.type === "string"}
            <input
              id={field.id}
              type="text"
              class="cf-input"
              class:cf-input--error={err}
              bind:value={values[field.id] as string}
            />
          {:else if field.type === "number"}
            <input
              id={field.id}
              type="number"
              class="cf-input"
              class:cf-input--error={err}
              bind:value={values[field.id] as number}
            />
          {:else if field.type === "boolean"}
            <input
              id={field.id}
              type="checkbox"
              class="cf-checkbox"
              bind:checked={values[field.id] as boolean}
            />
          {:else if field.type === "radio"}
            {#each field.options ?? [] as opt (opt)}
              <label class="cf-radio-label">
                <input
                  type="radio"
                  name={field.id}
                  value={opt}
                  bind:group={values[field.id] as string}
                />
                {opt}
              </label>
            {/each}
          {:else if field.type === "multiple"}
            {#each field.options ?? [] as opt (opt)}
              <label class="cf-checkbox-label">
                <input
                  type="checkbox"
                  value={opt}
                  checked={(values[field.id] as string[] ?? []).includes(opt)}
                  onchange={(evt) => {
                    const checked = (evt.target as HTMLInputElement).checked;
                    const cur = (values[field.id] as string[]) ?? [];
                    values[field.id] = checked
                      ? [...cur, opt]
                      : cur.filter((val) => val !== opt);
                  }}
                />
                {opt}
              </label>
            {/each}
          {/if}
          {#if err}
            <p class="cf-error-msg">{err}</p>
          {/if}
        </div>
      {/if}
    {/each}

    <div class="cf-divider" aria-hidden="true">
      <span class="cf-divider__line"></span>
      <Flag size={12} aria-hidden="true" />
      <span class="cf-divider__line"></span>
    </div>

    {#if showConfirm}
      <div class="cf-confirm-overlay">
        <p class="cf-confirm-msg">Submit your answers?</p>
        <div class="cf-confirm-btns">
          <button class="cf-cancel-btn" onclick={() => (showConfirm = false)}>
            Cancel
          </button>
          <button class="cf-confirm-btn" onclick={handleConfirm}>Confirm</button>
        </div>
      </div>
    {:else}
      <button
        class="cf-submit-btn"
        class:cf-submit-btn--submitting={submitState === "submitting"}
        onclick={handleSubmit}
        disabled={submitState === "submitting"}
      >
        {submitState === "submitting" ? "Submitting…" : submitState === "error" ? "Try again" : "Submit"}
      </button>
    {/if}
  {/if}
</div>