<script lang="ts">
  import { untrack } from "svelte";
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../../stores/titleBarStore";
  import {
    addPending,
    getDraft,
    saveDraft,
    clearDraft,
    getPending,
    findPendingByFilename,
    getPendingDraftKey,
  } from "./editorStorage";
  import type { FormField } from "../../types/data";
  import {
    createLocationFilename,
    locationFilenameToString,
    tryParseLocationName,
  } from "./editorUtils";
  import {
    fetchEditorLocation,
    saveEditorLocation,
    fetchPrStatuses,
  } from "../../utils/api";
  import { flattenValues } from "../../utils/formValues";
  import { loadText } from "../../utils/loadText";
  import AppForm from "../../components/AppForm.svelte";
  import "./EditorLocationForm.css";

  let {
    params,
  }: {
    params: {
      project: string;
      city: string;
      filename?: string;
      newId: number;
    };
  } = $props();

  const isEdit = $derived(!!params.filename);
  const namespace = $derived(`${params.project}/${params.city}/locations`);

  function getDraftKey(): string {
    return `editor_draft_${namespace}_${params.filename ?? "new"}`;
  }

  const draftKey = $derived(getDraftKey());

  let fields = $state<FormField[]>([]);
  let serverValues = $state<Record<string, unknown>>({});
  let initialValues = $state<Record<string, unknown>>(
    untrack(() => (!params.filename ? (getDraft(draftKey) ?? {}) : {})),
  );
  let existingSha = $state<string | null>(null);
  let locLoading = $state(untrack(() => Boolean(params.filename)));
  let submitSuccess = $state(false);
  let prUrl = $state<string | null>(null);
  let submitError = $state<string | null>(null);
  let checkingDraft = $state(false);

  $effect(() => {
    titleBarStore.set({
      title: isEdit ? "Edit location" : "Add location",
      progress: null,
      backPath: `/editor/locations/${params.project}/${params.city}`,
    });
  });

  $effect(() => {
    loadText<FormField[]>("en", "editor/location_form").then((data) => {
      if (data) { fields = data; }
    });
  });

  async function checkDraftStaleness(): Promise<boolean> {
    const filename = params.filename ?? "new";
    const pending = findPendingByFilename(namespace, filename);
    if (!pending?.prUrl) return false;

    const match = (pending.prUrl as string).match(/\/pull\/(\d+)/);
    if (!match) return false;

    try {
      const data = await fetchPrStatuses([match[1]]);
      if (data.ok && data.statuses && data.statuses[match[1]] === "closed") {
        clearDraft(draftKey);
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  async function reloadData(): Promise<void> {
    checkingDraft = true;
    const wasStale = await checkDraftStaleness();
    if (isEdit && params.filename) {
      locLoading = true;
      try {
        const data = await fetchEditorLocation(params.project, params.city, params.filename);
        if (data.ok && data.location) {
          const flat = flattenValues(data.location as Record<string, unknown>);
          flat["identity"] = tryParseLocationName(params.filename)?.title ?? "";
          serverValues = flat;
          existingSha = data.sha ?? null;
          if (wasStale) {
            initialValues = flat;
          } else {
            const draft = getDraft(draftKey);
            initialValues = draft ?? flat;
          }
        }
      } catch { /* ignore */ }
      locLoading = false;
    } else if (wasStale) {
      initialValues = {};
    }
    checkingDraft = false;
  }

  $effect(() => {
    if (isEdit && params.filename) {
      reloadData();
    } else {
      checkDraftStaleness();
    }
  });

  async function handleSubmit(nested: Record<string, unknown>) {
    submitError = null;

    const resolvedFilename =
      isEdit && params.filename
        ? params.filename
        : locationFilenameToString(
            createLocationFilename(
              params.newId ?? 0,
              (nested["identity"] as string) ?? "",
            ),
          );

    const coords = (nested["coordinates"] ?? {}) as {
      latitude?: string;
      longitude?: string;
    };
    const location = {
      ...nested,
      coordinates: {
        latitude: parseFloat(coords.latitude ?? "0") || 0,
        longitude: parseFloat(coords.longitude ?? "0") || 0,
      },
    };

    const data = await saveEditorLocation({
      project: params.project,
      city: params.city,
      filename: resolvedFilename,
      existingSha,
      location,
    });

    if (data.ok) {
      addPending(namespace, {
        filename: resolvedFilename!,
        locationTitle: (nested["title"] as string) ?? "",
        prUrl: data.prUrl,
        prTitle: `${isEdit ? "Edit" : "Add"} location: ${(nested["title"] as string) ?? ""}`,
        submittedAt: new Date().toISOString(),
      });
      prUrl = data.prUrl ?? null;
    } else {
      submitError = data.error ?? "Submission failed";
      throw new Error(submitError);
    }
  }

  function handleSuccess() {
    submitSuccess = true;
  }
</script>

{#if locLoading || fields.length === 0}
  <div class="loc-form__loading">Loading…</div>
{:else if submitSuccess}
  <div class="loc-form">
    <div class="loc-form__success">
      ✓ Changes submitted for review.
      {#if prUrl}
        <a
          href={prUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="loc-form__pr-link"
        >
          View pull request →
        </a>
      {/if}
    </div>
    <div class="loc-form__actions" style="margin-top: 20px">
      <button
        class="loc-form__cancel"
        onclick={() =>
          push(`/editor/locations/${params.project}/${params.city}`)}
      >
        Back to list
      </button>
    </div>
  </div>
{:else}
  <div class="loc-form">
    {#if submitError}
      <div class="loc-form__error">✕ {submitError}</div>
    {/if}

    <AppForm
      {fields}
      {initialValues}
      baseValues={isEdit ? serverValues : undefined}
      onSubmit={handleSubmit}
      onValuesChange={(vals) => saveDraft(draftKey, vals)}
      onSuccess={handleSuccess}
      submitLabel="Submit for review"
    />

    <div class="loc-form__actions">
      <button
        class="loc-form__cancel"
        onclick={() =>
          push(`/editor/locations/${params.project}/${params.city}`)}
      >
        Cancel
      </button>
      <button
        class="loc-form__refresh"
        onclick={reloadData}
        disabled={checkingDraft}
      >
        {checkingDraft ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  </div>
{/if}