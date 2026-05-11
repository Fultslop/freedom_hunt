<script lang="ts">
  import { untrack } from "svelte";
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../../stores/titleBarStore";
  import { addPending } from "./editorStorage";
  import type { FormField } from "../../types/data";
  import {
    createLocationFilename,
    locationFilenameToString,
    tryParseLocationName,
  } from "./editorUtils";
  import { fetchEditorLocation, saveEditorLocation } from "../../utils/api";
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

  let fields = $state<FormField[]>([]);
  let initialValues = $state<Record<string, unknown>>({});
  let existingSha = $state<string | null>(null);
  let locLoading = $state(untrack(() => Boolean(params.filename)));
  let submitSuccess = $state(false);
  let prUrl = $state<string | null>(null);
  let submitError = $state<string | null>(null);

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

  $effect(() => {
    if (isEdit && params.filename) {
      locLoading = true;
      fetchEditorLocation(params.project, params.city, params.filename)
        .then((data) => {
          if (data.ok && data.location) {
            const flat = flattenValues(
              data.location as Record<string, unknown>,
            );
            flat["identity"] =
              tryParseLocationName(params.filename)?.title ?? "";
            initialValues = flat;
            existingSha = data.sha ?? null;
          }
        })
        .catch(() => {})
        .finally(() => {
          locLoading = false;
        });
    }
  });

  async function handleSubmit(nested: Record<string, unknown>) {
    submitError = null;

    const resolvedFilename = locationFilenameToString(
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
      addPending(params.project, params.city, {
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
      onSubmit={handleSubmit}
      onSuccess={() => (submitSuccess = true)}
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
    </div>
  </div>
{/if}
