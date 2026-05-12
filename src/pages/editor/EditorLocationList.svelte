<script lang="ts">
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../../stores/titleBarStore";
  import {
    getPending,
    addPending,
    removePending,
    clearDraft,
    prWasClosed,
    clearCompletedPending,
    updatePendingStatus,
    type PendingEntry as BasePendingEntry,
  } from "./editorStorage";
  import type { Location as DataLocation, City, CitiesText } from "../../types/data";
  import "./EditorLocationList.css";
  import { getNextLocationId, getLocationIndex } from "./editorUtils";
  import {
    fetchEditorLocations,
    fetchPrStatuses,
    saveEditorLocation,
    type LocationListEntry,
  } from "../../utils/api";
  import { loadText } from "../../utils/loadText";

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
  let cities = $state<City[]>([]);
  let selectedCity = $state("");

  const pendingNewLocations = $derived(
    pending.filter(
      (p) => !locations.find((location) => location.filename === p.filename),
    ),
  );

  const hasCompleted = $derived(pending.some((p) => p.status === "up_to_date"));

  type ListItem =
    | {
        kind: "live";
        filename: string;
        sha: string;
        location: DataLocation;
        pending?: PendingEntry;
      }
    | { kind: "pending"; filename: string; entry: PendingEntry };

  const allItems = $derived(
    [
      ...locations.map(
        (loc): ListItem => ({
          kind: "live",
          filename: loc.filename,
          sha: loc.sha,
          location: loc.location,
          pending: pendingFor(loc.filename),
        }),
      ),
      ...pendingNewLocations.map(
        (p): ListItem => ({
          kind: "pending",
          filename: p.filename,
          entry: p,
        }),
      ),
    ].sort((a, b) => getLocationIndex(a.filename) - getLocationIndex(b.filename)),
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
        locations = data.locations.sort(
          (a, b) => getLocationIndex(a.filename) - getLocationIndex(b.filename),
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
    const STALE_MS = 5 * 60 * 1000;
    let items = getPending(namespace);

    let staleChanged = false;
    items.forEach((p) => {
      if (p.status === "submitting" && !(p.prUrl as string | undefined)) {
        const age =
          Date.now() - new Date((p.submittedAt as string) ?? 0).getTime();
        if (age > STALE_MS) {
          updatePendingStatus(namespace, p.filename, "failed");
          staleChanged = true;
        }
      }
    });
    if (staleChanged) {
      items = getPending(namespace);
    }
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
                if (n) {
                  const prStatus = data.statuses![n];
                  if (prStatus === "closed") {
                    prWasClosed(namespace, p.filename);
                    changed = true;
                  } else if (prStatus === "open" && p.status === "submitting") {
                    updatePendingStatus(namespace, p.filename, "pending");
                    changed = true;
                  }
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
    params.city;
    selectedCity = params.city;
    localStorage.setItem(`editor_last_city_${params.project}`, params.city);
    loadText<CitiesText>("en", `projects/${params.project}/cities`).then(
      (data) => {
        cities = data?.items ?? [];
      },
    );
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
            status: "pending",
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
      const draftKey = pend?.isNew
        ? `editor_draft_${namespace}_new`
        : `editor_draft_${namespace}_${filename}`;
      clearDraft(draftKey);
      pending = getPending(namespace);
    }
  }

  function handleRetry(pend: PendingEntry) {
    if (pend.isNew) {
      const newId = getNextLocationId(locations.map((loc) => loc.filename));
      push(`/editor/locations/${params.project}/${params.city}/new/${newId}`);
    } else {
      push(
        `/editor/locations/${params.project}/${params.city}/edit/${pend.filename}`,
      );
    }
  }

  function handleClearCompleted() {
    clearCompletedPending(namespace);
    pending = getPending(namespace);
  }

  function handleCityChange(e: Event) {
    const newCity = (e.currentTarget as HTMLSelectElement).value;
    localStorage.setItem(`editor_last_city_${params.project}`, newCity);
    push(`/editor/locations/${params.project}/${newCity}`);
  }
</script>

{#if loading}
  <div class="loc-list__loading">Loading…</div>
{:else if error}
  <div class="loc-list__error">{error}</div>
{:else}
  <div class="loc-list">
    <div class="loc-list__toolbar">
      <select
        class="loc-list__city-select"
        bind:value={selectedCity}
        onchange={handleCityChange}
        disabled={cities.length === 0}
      >
        {#each cities as city (city.id)}
          <option value={city.id}>{city.name}</option>
        {/each}
      </select>
      <div style="display:flex;gap:8px">
        {#if hasCompleted}
          <button class="loc-list__clear-btn" onclick={handleClearCompleted}>
            ✕ Clear completed
          </button>
        {/if}
        <button
          class="loc-list__refresh-btn"
          onclick={() => {
            fetchLocations();
            syncPending();
          }}
        >
          ↻ Refresh
        </button>
      </div>
    </div>

    {#each allItems as item (item.filename)}
      {#if item.kind === "live"}
        {@const pend = item.pending}
        <div class="loc-list__item">
          <div class="loc-list__item-header">
            <div>
              <div class="loc-list__item-title">
                {item.location.title || item.filename}
              </div>
              <div class="loc-list__item-meta">{item.filename}</div>
            </div>
            <div class="loc-list__item-actions">
              <button
                class="loc-list__btn"
                onclick={() =>
                  push(
                    `/editor/locations/${params.project}/${params.city}/edit/${item.filename}`,
                  )}
              >
                Edit
              </button>
              <button
                class="loc-list__btn loc-list__btn--danger"
                onclick={() =>
                  handleHide(
                    { ...item.location, _filename: item.filename },
                    item.sha,
                  )}
              >
                Hide
              </button>
              {#if isNewLocation(item.filename)}
                <button
                  class="loc-list__btn loc-list__btn--danger"
                  onclick={() => handleDelete(item.filename)}
                >
                  Delete
                </button>
              {/if}
            </div>
          </div>
          {#if pend}
            {#if pend.status === "submitting"}
              <span class="loc-list__badge loc-list__badge--submitting"
                >⏱ Submitting…</span
              >
            {:else if pend.status === "failed"}
              <span class="loc-list__badge loc-list__badge--failed">
                ✕ Submission failed
                <button
                  class="loc-list__badge-retry"
                  onclick={() => handleRetry(pend)}
                >
                  ↺ Retry
                </button>
              </span>
            {:else if pend.status === "up_to_date"}
              <span class="loc-list__badge loc-list__badge--up-to-date"
                >✓ Up to date</span
              >
            {:else if pend.prUrl}
              <a
                href={pend.prUrl as string}
                target="_blank"
                rel="noopener noreferrer"
                class="loc-list__badge loc-list__badge--pending"
              >
                ⏳ Pending — view PR
              </a>
            {/if}
          {/if}
        </div>
      {:else}
        {@const p = item.entry}
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
          {#if p.status === "submitting"}
            <span class="loc-list__badge loc-list__badge--submitting"
              >⏱ Submitting…</span
            >
          {:else if p.status === "failed"}
            <span class="loc-list__badge loc-list__badge--failed">
              ✕ Submission failed
              <button
                class="loc-list__badge-retry"
                onclick={() => handleRetry(p)}
              >
                ↺ Retry
              </button>
            </span>
          {:else if p.status === "up_to_date"}
            <span class="loc-list__badge loc-list__badge--up-to-date"
              >✓ Up to date</span
            >
          {:else if p.prUrl}
            <a
              href={p.prUrl as string}
              target="_blank"
              rel="noopener noreferrer"
              class="loc-list__badge loc-list__badge--pending"
            >
              ⏳ Pending — view PR
            </a>
          {/if}
        </div>
      {/if}
    {/each}

    <button
      class="loc-list__item loc-list__item--add"
      onclick={() => {
        const newId = getNextLocationId(allItems.map((i) => i.filename));
        push(`/editor/locations/${params.project}/${params.city}/new/${newId}`);
      }}
    >
      + Add location …
    </button>
  </div>
{/if}
