<script lang="ts">
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../../stores/titleBarStore";
  import {
    getPending,
    addPending,
    removePending,
    clearDraft,
    type PendingEntry as BasePendingEntry,
  } from "./editorStorage";
  import type { Location as DataLocation } from "../../types/data";
  import "./EditorLocationList.css";
  import { getNextLocationId } from "./editorUtils";
  import {
    fetchEditorLocations,
    fetchPrStatuses,
    saveEditorLocation,
    type LocationListEntry,
  } from "../../utils/api";

  let { params }: { params: { project: string; city: string } } = $props();

  const namespace = $derived(`${params.project}/${params.city}/locations`);

  interface PendingEntry extends BasePendingEntry {
    prUrl?: string;
    prTitle?: string;
    locationTitle?: string;
    submittedAt?: string;
  }

  let locations = $state<LocationListEntry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let pending = $state<PendingEntry[]>([]);

  const pendingNewLocations = $derived(
    pending.filter(
      (p) => !locations.find((location) => location.filename === p.filename),
    ),
  );

  titleBarStore.set({
    title: "Locations",
    progress: null,
    backPath: "/editor",
  });

  async function fetchLocations() {
    loading = true;
    error = null;
    try {
      const data = await fetchEditorLocations(params.project, params.city);
      if (data.ok && data.locations) {
        locations = data.locations.sort((a, b) =>
          a.filename.localeCompare(b.filename),
        );
      } else {
        error = data.error ?? "Failed to load locations";
      }
    } catch {
      error = "Failed to load locations";
    } finally {
      loading = false;
    }
  }

  function syncPending() {
    const items = getPending(namespace);
    pending = items;
    if (items.length > 0) {
      const numbers = items
        .map(
          (p) => (p.prUrl as string | undefined)?.match(/\/pull\/(\d+)/)?.[1],
        )
        .filter((n): n is string => Boolean(n));
      if (numbers.length > 0) {
        fetchPrStatuses(numbers)
          .then((data) => {
            if (data.ok && data.statuses) {
              let changed = false;
              items.forEach((p) => {
                const n = (p.prUrl as string | undefined)?.match(
                  /\/pull\/(\d+)/,
                )?.[1];
                if (n && data.statuses![n] === "closed") {
                  removePending(namespace, p.filename);
                  clearDraft(`editor_draft_${namespace}_${p.filename}`);
                  changed = true;
                }
              });
              if (changed) {
                pending = getPending(namespace);
              }
            }
          })
          .catch(() => {});
      }
    }
  }

  $effect(() => {
    fetchLocations();
    syncPending();
  });

  async function handleHide(
    loc: DataLocation & { _filename?: string },
    sha: string,
  ) {
    if (
      window.confirm(
        `Hide "${loc.title}"? This will open a PR setting hidden: true.`,
      )
    ) {
      const { _filename, ...cleanLoc } = loc;
      try {
        const data = await saveEditorLocation({
          project: params.project,
          city: params.city,
          filename: _filename!,
          existingSha: sha,
          location: { ...cleanLoc, hidden: true },
        });
        if (data.ok) {
          addPending(namespace, {
            filename: _filename!,
            locationTitle: loc.title,
            prUrl: data.prUrl,
            prTitle: `Hide location: ${loc.title}`,
            submittedAt: new Date().toISOString(),
          });
          pending = getPending(namespace);
        } else {
          alert(`Failed: ${data.error}`);
        }
      } catch {
        alert("Request failed.");
      }
    }
  }

  function pendingFor(filename: string): PendingEntry | undefined {
    return pending.find((p) => p.filename === filename);
  }

  // pendingNewLocations (derived) shows entries not yet in the GitHub list — unmerged.
  // isNewLocation checks by prTitle prefix for entries that ARE in the list but still have an open "Add" PR.
  function isNewLocation(filename: string): boolean {
    return pending.some(
      (p) => p.filename === filename && p.prTitle?.startsWith("Add location:"),
    );
  }

  function handleDelete(filename: string) {
    const pend = pendingFor(filename);
    if (
      window.confirm(
        `Remove this new location? You will need to close the PR on GitHub manually.\n\n${pend?.prUrl ?? ""}`,
      )
    ) {
      removePending(namespace, filename);
      clearDraft(`editor_draft_${namespace}_${filename}`);
      pending = getPending(namespace);
    }
  }


</script>

{#if loading}
  <div class="loc-list__loading">Loading…</div>
{:else if error}
  <div class="loc-list__error">{error}</div>
{:else}
  <div class="loc-list">
    {#if pendingNewLocations.length > 0}
      <div class="loc-list__section-heading">Pending additions</div>
      {#each pendingNewLocations as p (p.filename)}
        <div class="loc-list__item loc-list__item--pending">
          <div class="loc-list__item-header">
            <div>
              <div class="loc-list__item-title">
                {p.locationTitle ?? p.filename}
              </div>
              <div class="loc-list__item-meta">{p.filename}</div>
            </div>
            <div class="loc-list__item-actions">
              <button
                class="loc-list__btn loc-list__btn--danger"
                onclick={() => handleDelete(p.filename)}
              >
                Remove
              </button>
            </div>
          </div>
          {#if p.prUrl}
            <a
              href={p.prUrl as string}
              target="_blank"
              rel="noopener noreferrer"
              class="loc-list__pending"
            >
              ⏳ Pending — view PR
            </a>
          {/if}
        </div>
      {/each}
    {/if}
    <div class="loc-list__toolbar">
      <button
        class="loc-list__add-btn"
        onclick={() => {
          const newId = getNextLocationId(locations.map((loc) => loc.filename));
          push(`/editor/locations/${params.project}/${params.city}/new/${newId}`);
        }}
      >
        + Add location
      </button>
      <button
        class="loc-list__refresh-btn"
        onclick={() => {
          fetchLocations();
          syncPending();
        }}
      >
        Refresh
      </button>
    </div>

    {#each locations as { filename, sha, location } (filename)}
      {@const pend = pendingFor(filename)}
      <div class="loc-list__item">
        <div class="loc-list__item-header">
          <div>
            <div class="loc-list__item-title">{location.title || filename}</div>
            <div class="loc-list__item-meta">
              {`${filename}`}
            </div>
          </div>
          <div class="loc-list__item-actions">
            <button
              class="loc-list__btn"
              onclick={() =>
                push(
                  `/editor/locations/${params.project}/${params.city}/edit/${filename}`,
                )}
            >
              Edit
            </button>
            <button
              class="loc-list__btn loc-list__btn--danger"
              onclick={() =>
                handleHide({ ...location, _filename: filename }, sha)}
            >
              Hide
            </button>
            {#if isNewLocation(filename)}
              <button
                class="loc-list__btn loc-list__btn--danger"
                onclick={() => handleDelete(filename)}
              >
                Delete
              </button>
            {/if}
          </div>
        </div>
        {#if pend}
          <a
            href={pend.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="loc-list__pending"
          >
            ⏳ Pending edit — view PR
          </a>
        {/if}
      </div>
    {/each}
  </div>
{/if}
