<script lang="ts">
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../../stores/titleBarStore";
  import {
    getPending,
    addPending,
    removePending,
    type PendingEntry as BasePendingEntry,
  } from "./editorStorage";
  import type { Location } from "../../types/data";
  import "./EditorLocationList.css";

  let { params }: { params: { project: string; city: string } } = $props();

  interface LocationEntry {
    filename: string;
    sha: string;
    location: Location;
  }

  interface PendingEntry extends BasePendingEntry {
    prUrl?: string;
    prTitle?: string;
    locationTitle?: string;
    submittedAt?: string;
  }

  let locations = $state<LocationEntry[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let pending = $state<PendingEntry[]>([]);

  titleBarStore.set({
    title: "Locations",
    progress: null,
    backPath: "/editor",
  });

  async function fetchLocations() {
    loading = true;
    error = null;
    try {
      const res = await fetch(
        `/editor/locations?project=${params.project}&city=${params.city}`,
      );
      const data = (await res.json()) as {
        ok: boolean;
        locations?: LocationEntry[];
        error?: string;
      };
      if (data.ok && data.locations) {
        locations = data.locations.sort(
          (a, b) => a.filename.localeCompare(b.filename),
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
    const items = getPending(params.project, params.city);
    pending = items;
    if (items.length > 0) {
      const numbers = items
        .map(
          (p) => (p.prUrl as string | undefined)?.match(/\/pull\/(\d+)/)?.[1],
        )
        .filter(Boolean);
      if (numbers.length > 0) {
        fetch(`/editor/pr-status?numbers=${numbers.join(",")}`)
          .then((r) => r.json())
          .then((data) => {
            const typed = data as {
              ok?: boolean;
              statuses?: Record<string, string>;
            };
            if (typed.ok && typed.statuses) {
              let changed = false;
              items.forEach((p) => {
                const n = (p.prUrl as string | undefined)?.match(
                  /\/pull\/(\d+)/,
                )?.[1];
                if (n && typed.statuses![n] === "closed") {
                  removePending(params.project, params.city, p.filename);
                  changed = true;
                }
              });
              if (changed) {
                pending = getPending(params.project, params.city);
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
    loc: Location & { _filename?: string },
    sha: string,
  ) {
    if (
      window.confirm(
        `Hide "${loc.title}"? This will open a PR setting hidden: true.`,
      )
    ) {
      const { _filename, ...cleanLoc } = loc;
      try {
        const res = await fetch("/editor/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: params.project,
            city: params.city,
            filename: _filename,
            existingSha: sha,
            location: { ...cleanLoc, hidden: true },
          }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          prUrl?: string;
          error?: string;
        };
        if (data.ok) {
          addPending(params.project, params.city, {
            filename: _filename!,
            locationTitle: loc.title,
            prUrl: data.prUrl,
            prTitle: `Hide location: ${loc.title}`,
            submittedAt: new Date().toISOString(),
          });
          pending = getPending(params.project, params.city);
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
      removePending(params.project, params.city, filename);
      pending = getPending(params.project, params.city);
    }
  }
</script>

{#if loading}
  <div class="loc-list__loading">Loading…</div>
{:else if error}
  <div class="loc-list__error">{error}</div>
{:else}
  <div class="loc-list">
    <div class="loc-list__toolbar">
      <button
        class="loc-list__add-btn"
        onclick={() => {
          const newId = 0;
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
              {location.address || `ID: ${filename}`}
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
