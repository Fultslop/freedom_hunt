<script lang="ts">
  import { untrack } from "svelte";
  import { authStore } from "../stores/authStore";
  import type { FormField, PhotoUploadStatus } from "../types/data";
  import { postFormSubmit, postPhotoUpload, postVideoUpload } from "../utils/api";
  import { buildFormStorageKey, loadFormState, saveFormState } from "../utils/formStorage";
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
      : { values: {}, uploads: {}, submitted: false, skipped: false },
  );

  let baseValues = $state<Record<string, unknown>>(stored.values);
  let baseUploads = $state<Record<string, PhotoUploadStatus>>(stored.uploads);
  let latestValues = $state<Record<string, unknown>>(stored.values);
  let latestUploads = $state<Record<string, PhotoUploadStatus>>(stored.uploads);
  let hasSubmittedOnce = $state(stored.submitted);
  let skipped = $state(stored.skipped);

  function persist(
    vals: Record<string, unknown>,
    ups: Record<string, PhotoUploadStatus>,
    submitted: boolean,
    skp: boolean,
  ) {
    if (storeInLocalStorage) {
      saveFormState(storageKey, { values: vals, uploads: ups, submitted, skipped: skp });
    }
  }

  function handleValuesChange(values: Record<string, unknown>) {
    latestValues = values;
    persist(values, untrack(() => latestUploads), untrack(() => hasSubmittedOnce), untrack(() => skipped));
  }

  function handleUploadsChange(uploads: Record<string, PhotoUploadStatus>) {
    latestUploads = uploads;
    persist(untrack(() => latestValues), uploads, untrack(() => hasSubmittedOnce), untrack(() => skipped));
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
    persist(latestValues, latestUploads, true, skipped);
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
        onSubmit={handleSubmit}
        onPhotoUpload={handlePhotoUpload}
        onVideoUpload={handleVideoUpload}
        onSuccess={handleSuccess}
        onValuesChange={handleValuesChange}
        onUploadsChange={handleUploadsChange}
        onStatusChange={handleStatusChange}
        confirmMessage="Submit your answers?"
        submitLabel={hasSubmittedOnce ? "Re-submit" : "Submit"}
      />
    </div>
  {/if}
</div>
