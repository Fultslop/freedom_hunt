<script lang="ts">
  import { untrack } from "svelte";
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../../stores/titleBarStore";
  import {
    addPending,
    clearDraft,
    getDraft,
    saveDraft,
    updatePendingStatus,
    prWasClosed,
    findPendingByFilename,
  } from "./editorStorage";
  import type { FormField, Coordinates, CitiesText } from "../../types/data";
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
  import SubmitModal from "./SubmitModal.svelte";
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
  let initialValues = $state<Record<string, unknown>>({});
  let existingSha = $state<string | null>(null);
  let locLoading = $state(untrack(() => Boolean(params.filename)));
  let checkingDraft = $state(false);
  let cityCoords = $state<Coordinates | null>(null);
  let citiesLoading = $state(true);

  // Modal state
  let showModal = $state(false);
  let modalState = $state<"submitting" | "success" | "failed">("submitting");
  let modalPrTitle = $state("");
  let modalIsNewPr = $state(true);
  let modalExistingPrUrl = $state<string | undefined>(undefined);
  let modalNewPrUrl = $state<string | undefined>(undefined);
  let modalError = $state<string | undefined>(undefined);
  let lastSubmittedNested = $state<Record<string, unknown>>({});
  let isDirty = $state(false);

  function getSubtitle(): string {
    if (!params.filename) { return "new"; }
    const parsed = tryParseLocationName(params.filename);
    if (!parsed) { return params.filename; }
    return parsed.title
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  $effect(() => {
    titleBarStore.set({
      title: isEdit ? "Edit location" : "Add location",
      subtitle: getSubtitle(),
      progress: null,
      backPath: `/editor/locations/${params.project}/${params.city}`,
    });
  });

  $effect(() => {
    titleBarStore.update((state) => ({ ...state, isDirty }));
  });

  $effect(() => {
    loadText<FormField[]>("en", "editor/location_form").then((data) => {
      if (data) { fields = data; }
    });
  });

  $effect(() => {
    loadText<CitiesText>("en", `projects/${params.project}/cities`).then((data) => {
      const city = data?.items?.find((c) => c.id === params.city);
      cityCoords = city?.coordinates ?? null;
      if (!isEdit) {
        const draft = getDraft(draftKey);
        initialValues = draft ?? (cityCoords ? { coordinates: cityCoords } : {});
      }
      citiesLoading = false;
    });
  });

  async function checkDraftStaleness(): Promise<boolean> {
    const filename = params.filename ?? "new";
    const pending = findPendingByFilename(namespace, filename);
    if (!pending?.prUrl) { return false; }

    const match = (pending.prUrl as string).match(/\/pull\/(\d+)/);
    if (!match) { return false; }

    try {
      const data = await fetchPrStatuses([match[1]]);
      if (data.ok && data.statuses && data.statuses[match[1]] === "closed") {
        prWasClosed(namespace, filename);
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
          const lat = flat["coordinates.latitude"] as number | undefined;
          const lng = flat["coordinates.longitude"] as number | undefined;
          if (lat !== undefined || lng !== undefined) {
            flat["coordinates"] = { latitude: lat ?? 0, longitude: lng ?? 0 };
            delete flat["coordinates.latitude"];
            delete flat["coordinates.longitude"];
          }
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

  function handleCancel() {
    const backPath = `/editor/locations/${params.project}/${params.city}`;
    if (!isDirty || window.confirm("Discard changes?")) {
      if (isDirty) { clearDraft(draftKey); }
      push(backPath);
    }
  }

  async function handleSubmit(nested: Record<string, unknown>) {
    lastSubmittedNested = nested;

    const resolvedFilename =
      isEdit && params.filename
        ? params.filename
        : locationFilenameToString(
            createLocationFilename(
              params.newId ?? 0,
              (nested["identity"] as string) ?? "",
            ),
          );

    const existingEntry = findPendingByFilename(namespace, resolvedFilename);
    const isNewPr =
      !existingEntry ||
      (existingEntry.status === "failed" &&
        !(existingEntry.prUrl as string | undefined));
    const existingPrUrl = isNewPr
      ? undefined
      : (existingEntry?.prUrl as string | undefined);
    const locationTitle = (nested["title"] as string) ?? "";
    const prTitle = `${isEdit ? "Edit" : "Add"} location: ${locationTitle}`;

    addPending(namespace, {
      filename: resolvedFilename,
      locationTitle,
      prUrl: existingPrUrl,
      prTitle,
      submittedAt: new Date().toISOString(),
      status: "submitting",
      isNew: !isEdit,
    });

    modalPrTitle = prTitle;
    modalIsNewPr = isNewPr;
    modalExistingPrUrl = existingPrUrl;
    modalNewPrUrl = undefined;
    modalError = undefined;
    modalState = "submitting";
    showModal = true;

    const coords = (nested["coordinates"] ?? { latitude: 0, longitude: 0 }) as Coordinates;
    const location = {
      ...nested,
      coordinates: {
        latitude: Number(coords.latitude) || 0,
        longitude: Number(coords.longitude) || 0,
      },
    };

    const TIMEOUT_MS = 30_000;
    const timeoutPromise = new Promise<never>((_resolve, reject) =>
      setTimeout(
        () => reject(new Error("Request timed out after 30s")),
        TIMEOUT_MS,
      ),
    );

    let data: { ok: boolean; prUrl?: string; error?: string };
    try {
      data = await Promise.race([
        saveEditorLocation({
          project: params.project,
          city: params.city,
          filename: resolvedFilename,
          existingSha,
          location,
        }),
        timeoutPromise,
      ]);
    } catch (err) {
      updatePendingStatus(namespace, resolvedFilename, "failed");
      modalError = err instanceof Error ? err.message : "Request failed";
      modalState = "failed";
      throw err;
    }

    if (data.ok) {
      addPending(namespace, {
        filename: resolvedFilename,
        locationTitle,
        prUrl: data.prUrl,
        prTitle,
        submittedAt: new Date().toISOString(),
        status: "pending",
        isNew: !isEdit,
      });
      modalNewPrUrl = data.prUrl ?? undefined;
    } else {
      updatePendingStatus(namespace, resolvedFilename, "failed");
      modalError = data.error ?? "Submission failed";
      modalState = "failed";
      throw new Error(modalError);
    }
  }

  function handleSuccess() {
    modalState = "success";
  }

  async function retrySubmit() {
    modalState = "submitting";
    try {
      await handleSubmit(lastSubmittedNested);
      handleSuccess();
    } catch {
      // modalState already set to "failed" inside handleSubmit
    }
  }
</script>

{#if locLoading || citiesLoading || fields.length === 0}
  <div class="loc-form__loading">Loading…</div>
{:else}
  <div class="loc-form">
    <AppForm
      {fields}
      {initialValues}
      baseValues={isEdit ? serverValues : undefined}
      onSubmit={handleSubmit}
      onValuesChange={(vals) => saveDraft(draftKey, vals)}
      onHasChangesChange={(changed) => { isDirty = changed; }}
      onSuccess={handleSuccess}
      submitLabel="Submit for review"
    />

    <div class="loc-form__actions">
      <button
        class="loc-form__cancel"
        onclick={handleCancel}
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

  {#if showModal}
    <SubmitModal
      state={modalState}
      prTitle={modalPrTitle}
      isNewPr={modalIsNewPr}
      existingPrUrl={modalExistingPrUrl}
      newPrUrl={modalNewPrUrl}
      error={modalError}
      onBack={() => push(`/editor/locations/${params.project}/${params.city}`)}
      onRetry={retrySubmit}
    />
  {/if}
{/if}
