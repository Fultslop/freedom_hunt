<script lang="ts">
  import { untrack } from "svelte";
  import { authStore } from "../stores/authStore";
  import type { FormField, PhotoUploadStatus } from "../types/data";
  import { postFormSubmit, postPhotoUpload, postVideoUpload } from "../utils/api";
  import { buildFormStorageKey, loadFormState, saveFormState } from "../utils/formStorage";
  import { parseSourceRef, getLocationFormValue } from "../utils/locationFormLookup";
  import AppForm from "./AppForm.svelte";
  import "./ChallengeForm.css";

  let {
    form,
    locationId,
    routeId = undefined,
    project = "",
    cityId = "",
    taskTitle = "",
    storeInLocalStorage = true,
    allowResubmit = true,
    onFormStatusChange = undefined,
  }: {
    form: FormField[];
    locationId: string;
    routeId?: string;
    project?: string;
    cityId?: string;
    taskTitle?: string;
    storeInLocalStorage?: boolean;
    allowResubmit?: boolean;
    onFormStatusChange?: (status: { submitted: boolean; missingLabels: string[] }) => void;
  } = $props();

  const storageKey = untrack(() => buildFormStorageKey(project, cityId, routeId, locationId));
  const stored = untrack(() =>
    storeInLocalStorage
      ? loadFormState(storageKey)
      : { values: {}, uploads: {}, submitted: false, skipped: false, touchedFields: [] },
  );

  let baseValues = $state<Record<string, unknown>>(stored.values);
  let baseUploads = $state<Record<string, PhotoUploadStatus>>(stored.uploads);
  let latestValues = $state<Record<string, unknown>>(stored.values);
  let latestUploads = $state<Record<string, PhotoUploadStatus>>(stored.uploads);
  let hasSubmittedOnce = $state(stored.submitted);
  let skipped = $state(stored.skipped);
  let touchedFields = $state<string[]>(stored.touchedFields);
  let submittedAt = $state<number | undefined>(stored.submittedAt);

  const sourceValues = untrack(() => {
    const result: Record<string, string> = {};
    for (const field of form) {
      if (field.type === "textarea" && field.source && field.id) {
        const ref = parseSourceRef(field.source);
        if (ref) {
          const value = getLocationFormValue(project, cityId, routeId, ref.locationId, ref.fieldId);
          if (typeof value === "string") {
            result[field.id] = value;
          }
        }
      }
    }
    return result;
  });

  function persist(
    vals: Record<string, unknown>,
    ups: Record<string, PhotoUploadStatus>,
    submitted: boolean,
    skp: boolean,
    touched: string[],
    stampedAt: number | undefined,
  ) {
    if (storeInLocalStorage) {
      saveFormState(storageKey, {
        values: vals,
        uploads: ups,
        submitted,
        skipped: skp,
        touchedFields: touched,
        submittedAt: stampedAt,
      });
    }
  }

  function handleValuesChange(values: Record<string, unknown>) {
    latestValues = values;
    persist(
      values,
      untrack(() => latestUploads),
      untrack(() => hasSubmittedOnce),
      untrack(() => skipped),
      untrack(() => touchedFields),
      untrack(() => submittedAt),
    );
  }

  function handleUploadsChange(uploads: Record<string, PhotoUploadStatus>) {
    latestUploads = uploads;
    persist(
      untrack(() => latestValues),
      uploads,
      untrack(() => hasSubmittedOnce),
      untrack(() => skipped),
      untrack(() => touchedFields),
      untrack(() => submittedAt),
    );
  }

  function handleTouchedFieldsChange(fields: string[]) {
    touchedFields = fields;
    persist(
      untrack(() => latestValues),
      untrack(() => latestUploads),
      untrack(() => hasSubmittedOnce),
      untrack(() => skipped),
      fields,
      untrack(() => submittedAt),
    );
  }

  function handleStatusChange(status: { missingLabels: string[] }) {
    onFormStatusChange?.({ submitted: hasSubmittedOnce, missingLabels: status.missingLabels });
  }

  async function handleSubmit(values: Record<string, unknown>) {
    const auth = $authStore.activeAuth;
    const data = await postFormSubmit({
      locationId,
      routeId,
      cityId,
      teamName: auth?.kind === "participant" ? auth.teamName : "",
      contact: auth?.kind === "participant" ? (auth.contact ?? "") : "",
      answers: values,
    });
    if (!data.ok) { throw new Error("Submission failed"); }
  }

  function handleSuccess() {
    hasSubmittedOnce = true;
    baseValues = latestValues;
    baseUploads = latestUploads;
    if (submittedAt === undefined) {
      submittedAt = Date.now();
    }
    persist(latestValues, latestUploads, true, skipped, untrack(() => touchedFields), submittedAt);
    onFormStatusChange?.({ submitted: true, missingLabels: [] });
  }

  async function handlePhotoUpload(file: File): Promise<{ ok: boolean; httpCode?: number }> {
    return postPhotoUpload({ locationId, cityId, routeId, taskTitle, file });
  }

  async function handleVideoUpload(
    video: File,
    poster: File,
  ): Promise<{ ok: boolean; httpCode?: number }> {
    return postVideoUpload({ locationId, cityId, routeId, taskTitle, video, poster });
  }
</script>

<div class="challenge-form">
  {#if hasSubmittedOnce && !allowResubmit}
    <p class="cf-success">Submitted! ✓</p>
  {:else}
    <div class="cf-form-wrap">
      <AppForm
        fields={form}
        initialValues={baseValues}
        {baseValues}
        initialUploads={baseUploads}
        {baseUploads}
        {touchedFields}
        {sourceValues}
        formContext={{ project, city: cityId, route: routeId }}
        onSubmit={handleSubmit}
        onPhotoUpload={handlePhotoUpload}
        onVideoUpload={handleVideoUpload}
        onSuccess={handleSuccess}
        onValuesChange={handleValuesChange}
        onUploadsChange={handleUploadsChange}
        onTouchedFieldsChange={handleTouchedFieldsChange}
        onStatusChange={handleStatusChange}
        confirmMessage="Submit your answers?"
        submitLabel={hasSubmittedOnce ? "Re-submit" : "Submit"}
      />
    </div>
  {/if}
</div>
