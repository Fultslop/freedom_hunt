# Task 04 — EditorLocationList: badge variants + stale handling

**Files:**
- Modify: `src/pages/editor/EditorLocationList.svelte`
- Modify: `src/pages/editor/EditorLocationList.css`
- Modify: `src/test/EditorLocationList.test.ts`

**Context:** Replace the single `.loc-list__pending` badge with four variants driven by `PendingEntry.status`. Add stale-`"submitting"`-entry resolution in `syncPending` (PR status lookup + 5-minute orphan fallback). Add "Clear completed" button for `"up_to_date"` entries. Migrate all `removePending + clearDraft` PR-closed paths to `prWasClosed`. Fix `handleDelete` to clear the right draft key for new locations. **Depends on Task 01.**

---

- [ ] **Step 1: Write the failing tests**

Open `src/test/EditorLocationList.test.ts`. Add the following imports at the top (merge with existing):

```ts
import { push } from "svelte-spa-router";
import { addPending, updatePendingStatus } from "../pages/editor/editorStorage";
import { fireEvent } from "@testing-library/svelte/svelte5";
```

Then append these tests after the existing four:

```ts
// Update existing addPending calls in the four original tests to include status: "pending"
// (those tests pass an entry without status; TypeScript will require it after Task 01)
// Fix: in "shows 'Pending additions' section..." test, add status: "pending" to addPending call.
// Fix: in "does not show 'Pending additions'..." test, add status: "pending" to addPending call.

test("shows 'Submitting…' badge for a pending entry with status submitting", async () => {
  localStorage.clear();
  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prTitle: "Edit location: Binnenhof",
    submittedAt: new Date().toISOString(),
    status: "submitting",
  });
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  expect(await screen.findByText(/Submitting…/)).toBeInTheDocument();
});

test("shows '✓ Up to date' badge for a pending entry with status up_to_date", async () => {
  localStorage.clear();
  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prTitle: "Edit location: Binnenhof",
    submittedAt: new Date().toISOString(),
    status: "up_to_date",
  });
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  expect(await screen.findByText(/Up to date/)).toBeInTheDocument();
});

test("shows 'Submission failed' badge with Retry button for failed edit entry", async () => {
  localStorage.clear();
  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prTitle: "Edit location: Binnenhof",
    submittedAt: new Date().toISOString(),
    status: "failed",
    isNew: false,
  });
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  await screen.findByText(/Submission failed/);
  await fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(push).toHaveBeenCalledWith(
    "/editor/locations/democrats_abroad/den_haag/edit/001_loc_binnenhof.yaml",
  );
});

test("Retry for isNew=true failed entry navigates to new route", async () => {
  localStorage.clear();
  // The mock returns one location: "001_loc_binnenhof.yaml" (id=1), so next id = 2
  addPending("democrats_abroad/den_haag/locations", {
    filename: "002_loc_new_place.yaml",
    locationTitle: "New Place",
    prTitle: "Add location: New Place",
    submittedAt: new Date().toISOString(),
    status: "failed",
    isNew: true,
  });
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  await screen.findByText(/Submission failed/);
  await fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(push).toHaveBeenCalledWith(
    "/editor/locations/democrats_abroad/den_haag/new/2",
  );
});

test("'Clear completed' button appears when up_to_date entries exist and removes them", async () => {
  localStorage.clear();
  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prTitle: "Edit location: Binnenhof",
    submittedAt: new Date().toISOString(),
    status: "up_to_date",
  });
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  const clearBtn = await screen.findByRole("button", { name: /clear completed/i });
  expect(clearBtn).toBeInTheDocument();
  await fireEvent.click(clearBtn);
  expect(screen.queryByText(/Up to date/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /clear completed/i })).not.toBeInTheDocument();
});
```

Also update the two existing `addPending` calls in the original tests to include `status: "pending"` (TypeScript now requires it):

In `"shows 'Pending additions' section for new locations not yet in GitHub"`:
```ts
addPending("democrats_abroad/den_haag/locations", {
  filename: "008_loc_new_place.yaml",
  locationTitle: "New Place",
  prUrl: "https://github.com/org/repo/pull/99",
  prTitle: "Add location: New Place",
  submittedAt: new Date().toISOString(),
  status: "pending",   // ADD THIS
});
```

In `"does not show 'Pending additions' when all pending entries are in GitHub list"`:
```ts
addPending("democrats_abroad/den_haag/locations", {
  filename: "001_loc_binnenhof.yaml",
  locationTitle: "Binnenhof",
  prUrl: "https://github.com/org/repo/pull/1",
  status: "pending",   // ADD THIS
});
```

- [ ] **Step 2: Run to confirm the new tests fail**

```
npx vitest run src/test/EditorLocationList.test.ts --reporter=verbose
```

Expected: the new tests FAIL (new badge rendering not yet implemented).

- [ ] **Step 3: Update `src/pages/editor/EditorLocationList.css`**

Keep all existing CSS. Append these new rules at the end of the file:

```css
.loc-list__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 4px;
  text-decoration: none;
}

.loc-list__badge--pending {
  color: #e67e22;
  background: #fef3e2;
}

.loc-list__badge--pending:hover {
  text-decoration: underline;
}

.loc-list__badge--submitting {
  color: #5b4fcf;
  background: #eeeeff;
}

.loc-list__badge--up-to-date {
  color: #27ae60;
  background: #e8f8f0;
}

.loc-list__badge--failed {
  color: #c0392b;
  background: #fdeaea;
}

.loc-list__badge-retry {
  background: #c0392b;
  border: none;
  color: #fff;
  border-radius: 3px;
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  text-transform: none;
  letter-spacing: 0;
}

.loc-list__clear-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
}
```

- [ ] **Step 4: Rewrite `src/pages/editor/EditorLocationList.svelte`**

Replace the entire file with:

```svelte
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

  const hasCompleted = $derived(pending.some((p) => p.status === "up_to_date"));

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
    const STALE_MS = 5 * 60 * 1000;
    let items = getPending(namespace);

    // Demote orphaned "submitting" entries older than 5 minutes with no prUrl
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
      // New locations store their draft under the "_new" key; edits use filename
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
          {#if p.status === "submitting"}
            <span class="loc-list__badge loc-list__badge--submitting">⏱ Submitting…</span>
          {:else if p.status === "failed"}
            <span class="loc-list__badge loc-list__badge--failed">
              ✕ Submission failed
              <button class="loc-list__badge-retry" onclick={() => handleRetry(p)}>↺ Retry</button>
            </span>
          {:else if p.status === "up_to_date"}
            <span class="loc-list__badge loc-list__badge--up-to-date">✓ Up to date</span>
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
      <div style="display:flex;gap:8px">
        {#if hasCompleted}
          <button class="loc-list__clear-btn" onclick={handleClearCompleted}>
            Clear completed
          </button>
        {/if}
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
    </div>

    {#each locations as { filename, sha, location } (filename)}
      {@const pend = pendingFor(filename)}
      <div class="loc-list__item">
        <div class="loc-list__item-header">
          <div>
            <div class="loc-list__item-title">{location.title || filename}</div>
            <div class="loc-list__item-meta">{filename}</div>
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
          {#if pend.status === "submitting"}
            <span class="loc-list__badge loc-list__badge--submitting">⏱ Submitting…</span>
          {:else if pend.status === "failed"}
            <span class="loc-list__badge loc-list__badge--failed">
              ✕ Submission failed
              <button class="loc-list__badge-retry" onclick={() => handleRetry(pend)}>↺ Retry</button>
            </span>
          {:else if pend.status === "up_to_date"}
            <span class="loc-list__badge loc-list__badge--up-to-date">✓ Up to date</span>
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
    {/each}
  </div>
{/if}
```

- [ ] **Step 5: Run the EditorLocationList tests**

```
npx vitest run src/test/EditorLocationList.test.ts --reporter=verbose
```

Expected: all tests PASS including the new badge and retry tests.

- [ ] **Step 6: Run the full suite and lint**

```
npx vitest run --reporter=verbose
npm run lint
```

Expected: all tests pass, no lint errors.

- [ ] **Step 7: Commit**

```
git add src/pages/editor/EditorLocationList.svelte src/pages/editor/EditorLocationList.css src/test/EditorLocationList.test.ts
git commit -m "feat: four-state badge system in EditorLocationList — submitting/pending/up_to_date/failed with retry and clear-completed"
```
