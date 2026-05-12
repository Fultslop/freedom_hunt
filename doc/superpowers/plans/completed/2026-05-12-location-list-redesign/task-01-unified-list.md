# Task 01 – Unified allItems derived state and list template

**Files:**
- Modify: `src/pages/editor/EditorLocationList.svelte` — add `ListItem` type, `allItems` derived, numeric sort, replace template loop
- Modify: `src/test/EditorLocationList.test.ts` — update existing "Pending additions" test

---

- [ ] **Step 1: Update the "Pending additions" test to assert the heading is gone**

In `src/test/EditorLocationList.test.ts`, replace the test starting at line 53
(`"shows 'Pending additions' section for new locations not yet in GitHub"`) with:

```typescript
test("renders pending-only item inline without 'Pending additions' heading", async () => {
  addPending("democrats_abroad/den_haag/locations", {
    filename: "008_loc_new_place.yaml",
    locationTitle: "New Place",
    prUrl: "https://github.com/org/repo/pull/99",
    prTitle: "Add location: New Place",
    submittedAt: new Date().toISOString(),
    status: "pending",
  });

  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });

  expect(await screen.findByText("New Place")).toBeInTheDocument();
  expect(screen.queryByText("Pending additions")).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /pending — view pr/i }),
  ).toHaveAttribute("href", "https://github.com/org/repo/pull/99");
});
```

- [ ] **Step 2: Run the test file to verify the updated test now fails**

```
npm run test -- --reporter=verbose src/test/EditorLocationList.test.ts
```

Expected: the updated test fails with something like
`Expected element not to be in the document` (for "Pending additions").
All other tests pass.

- [ ] **Step 3: Add `ListItem` type and `allItems` derived state to the script**

In `src/pages/editor/EditorLocationList.svelte`, after line 46
(`const hasCompleted = $derived(...)`), insert:

```typescript
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
```

- [ ] **Step 4: Update `fetchLocations` to sort numerically**

In `src/pages/editor/EditorLocationList.svelte`, find the sort inside `fetchLocations`
(around line 60):

```typescript
        locations = data.locations.sort((a, b) =>
          a.filename.localeCompare(b.filename),
        );
```

Replace with:

```typescript
        locations = data.locations.sort(
          (a, b) => getLocationIndex(a.filename) - getLocationIndex(b.filename),
        );
```

- [ ] **Step 5: Replace the template — remove old sections, add unified `{#each allItems}` loop**

In `src/pages/editor/EditorLocationList.svelte`, replace **everything inside the
`{:else}` block** (from `<div class="loc-list">` through its closing `</div>`, keeping
the outer `{:else}` / `{/if}` wrappers) with the following. The toolbar is left
unchanged for now (add button and no icons) — that is Task 02's job.

```svelte
  <div class="loc-list">
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
  </div>
```

- [ ] **Step 6: Run the EditorLocationList tests**

```
npm run test -- --reporter=verbose src/test/EditorLocationList.test.ts
```

Expected: all tests pass, 0 failures. The test updated in Step 1 should now pass.

- [ ] **Step 7: Run the full test suite**

```
npm test
```

Expected: all tests pass, 0 failures.

- [ ] **Step 8: Lint**

```
npm run lint
```

Expected: 0 errors.

- [ ] **Step 9: Commit**

```
git add src/pages/editor/EditorLocationList.svelte src/test/EditorLocationList.test.ts
git commit -m "refactor: unify location list into single allItems sorted loop"
```
