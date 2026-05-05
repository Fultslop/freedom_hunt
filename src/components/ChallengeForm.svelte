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
  let maxWarningKeys = $state<Record<string, number>>({});

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

  function validateValues(): Record<string, string> {
    const errs: Record<string, string> = {};
    for (const field of form) {
      if (field.type === "boolean" || field.type === "photo") continue;
      if (field.type === "string") {
        const v = values[field.id] as string | undefined;
        if (!v || v.trim() === "") errs[field.id] = "Required";
      } else if (field.type === "number") {
        const v = values[field.id];
        if (v === undefined || v === null || (typeof v === "number" && isNaN(v))) {
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
    const newErrors: Record<string, string> = {};
    for (const field of form) {
      const def = checkDefinition(field);
      if (def) newErrors[field.id] = def;
    }
    errors = { ...validateValues(), ...newErrors };
    if (Object.keys(errors).length === 0) showConfirm = true;
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

</script>

<div class="challenge-form">
  {#if submitState === "success"}
    <p class="cf-success">Submitted! ✓</p>
  {:else}
    <div class="cf-divider" aria-hidden="true">
      <span class="cf-divider__line"></span>
      <Flag size={12} aria-hidden="true" />
      <span class="cf-divider__line"></span>
    </div>

    {#each form as field (field.id)}
      {@const err = errors[field.id]}
      <div class="cf-field">
        {#if field.type === "photo"}
          <div class="cf-photo-wrap">
            <button
              class="cf-photo-btn"
              onclick={() => fileInput?.click()}
              disabled={uploadState === "uploading"}
            >
              <Camera size={16} aria-hidden="true" />
              {uploadState === "success" ? "Photo uploaded ✓" : uploadState === "uploading" ? "Uploading…" : field.label}
            </button>
            <input
              id={field.id}
              type="file"
              accept="image/*"
              capture="environment"
              class="cf-photo-input"
              bind:this={fileInput}
              onchange={handleFileChange}
            />
            {#if uploadState === "error"}
              <p class="cf-photo-error">Upload failed. Try again.</p>
            {/if}
          </div>
        {:else if field.type === "boolean"}
          <label class="cf-label--checkbox">
            {field.label}
            <input
              id={field.id}
              type="checkbox"
              class="cf-checkbox"
              bind:checked={values[field.id] as boolean}
            />
          </label>
        {:else}
          <label class="cf-label" for={field.id}>{field.label}</label>
          {#if err}<p class="cf-error-msg">{err}</p>{/if}
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
              inputmode="numeric"
              min="0"
              step="1"
              class="cf-input"
              class:cf-input--error={err}
              bind:value={values[field.id] as number}
              oninput={(e) => {
                const t = e.target as HTMLInputElement;
                t.value = t.value.replace(/[^0-9]/g, "");
              }}
            />
          {:else if field.type === "radio"}
            <div class="cf-radio-group">
              {#each field.options ?? [] as opt (opt)}
                <label class="cf-label--radio">
                  <input
                    type="radio"
                    name={field.id}
                    value={opt}
                    bind:group={values[field.id] as string}
                  />
                  {opt}
                </label>
              {/each}
            </div>
          {:else if field.type === "multiple"}
            {#if maxWarningKeys[field.id]}
              {#key maxWarningKeys[field.id]}
                <p class="cf-max-warning">You can only select {field.max}</p>
              {/key}
            {/if}
            <div class="cf-radio-group">
              {#each field.options ?? [] as opt (opt)}
                <label class="cf-label--radio">
                  <input
                    type="checkbox"
                    value={opt}
                    checked={(values[field.id] as string[] ?? []).includes(opt)}
                    onchange={(evt) => {
                      const target = evt.target as HTMLInputElement;
                      const cur = (values[field.id] as string[]) ?? [];
                      if (target.checked && field.max !== undefined && cur.length >= field.max) {
                        target.checked = false;
                        maxWarningKeys = { ...maxWarningKeys, [field.id]: (maxWarningKeys[field.id] ?? 0) + 1 };
                      } else {
                        values[field.id] = target.checked
                          ? [...cur, opt]
                          : cur.filter((val) => val !== opt);
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
    {/each}

    <div class="cf-divider" aria-hidden="true">
      <span class="cf-divider__line"></span>
      <Flag size={12} aria-hidden="true" />
      <span class="cf-divider__line"></span>
    </div>

    {#if showConfirm}
      <div class="cf-confirm-overlay">
        <div class="cf-confirm-dialog">
          <p class="cf-confirm-msg">Submit your answers?</p>
          <div class="cf-confirm-actions">
            <button class="cf-confirm-cancel" onclick={() => (showConfirm = false)}>
              Cancel
            </button>
            <button class="cf-confirm-ok" onclick={handleConfirm}>Confirm</button>
          </div>
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