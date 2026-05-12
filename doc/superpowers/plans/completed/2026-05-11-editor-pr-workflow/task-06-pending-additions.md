# Task 06 — EditorLocationList: pending additions section

**Files:**
- Modify: `src/pages/editor/EditorLocationList.svelte`
- Modify: `src/pages/editor/EditorLocationList.css`
- Modify: `src/test/EditorLocationList.test.ts`

**Prerequisites:** Task 04 (namespace storage) must be complete, as `syncPending` uses the namespace API.

**Context:** New locations (submitted as PRs but not yet merged to main) don't appear in the GitHub-fetched `locations` array. They need their own section in the list so the user can always find the PR link after navigating back from the form. This section renders above the main list and shows only pending entries whose `filename` has no match in `locations`.

---

- [x] **Step 1: Write failing test**

In `src/test/EditorLocationList.test.ts`, add a test that seeds localStorage before rendering:

```ts
import { addPending } from "../pages/editor/editorStorage";

// Add after existing tests:

test("shows 'Pending additions' section for new locations not yet in GitHub", async () => {
  localStorage.clear();
  addPending("democrats_abroad/den_haag/locations", {
    filename: "008_loc_new_place.yaml",
    locationTitle: "New Place",
    prUrl: "https://github.com/org/repo/pull/99",
    prTitle: "Add location: New Place",
    submittedAt: new Date().toISOString(),
  });

  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });

  // The GitHub mock returns only "Binnenhof" — "New Place" is pending-only
  expect(await screen.findByText("Pending additions")).toBeInTheDocument();
  expect(screen.getByText("New Place")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /pending — view pr/i })).toHaveAttribute(
    "href",
    "https://github.com/org/repo/pull/99",
  );
});

test("does not show 'Pending additions' when all pending entries are in GitHub list", async () => {
  localStorage.clear();
  // "Binnenhof" IS in the GitHub mock, so it's not a new pending addition
  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prUrl: "https://github.com/org/repo/pull/1",
  });

  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });

  await screen.findByText("Binnenhof"); // wait for list to load
  expect(screen.queryByText("Pending additions")).not.toBeInTheDocument();
});
```

- [x] **Step 2: Run to confirm they fail**

```
npx vitest run src/test/EditorLocationList.test.ts --reporter=verbose
```

Expected: new tests FAIL.

- [x] **Step 3: Add `pendingNewLocations` derived to `EditorLocationList.svelte`**

After the `let pending = $state<PendingEntry[]>([]);` declaration, add:

```ts
const pendingNewLocations = $derived(
  pending.filter(
    (p) => !locations.find((l) => l.filename === p.filename),
  ),
);
```

- [x] **Step 4: Add the "Pending additions" section to the template**

In `EditorLocationList.svelte`, inside the `{:else}` block (after `<div class="loc-list">`), add the new section before the toolbar:

```svelte
{#if pendingNewLocations.length > 0}
  <div class="loc-list__section-heading">Pending additions</div>
  {#each pendingNewLocations as p (p.filename)}
    <div class="loc-list__item loc-list__item--pending">
      <div class="loc-list__item-header">
        <div>
          <div class="loc-list__item-title">
            {(p.locationTitle as string) ?? p.filename}
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
```

- [x] **Step 5: Add styles to `EditorLocationList.css`**

At the end of `src/pages/editor/EditorLocationList.css`, add:

```css
.loc-list__section-heading {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary, #888);
  padding: 12px 0 4px;
}

.loc-list__item--pending {
  opacity: 0.85;
  border-left: 3px solid var(--color-accent, #f0a500);
  padding-left: 8px;
}
```

- [x] **Step 6: Run the tests to confirm they pass**

```
npx vitest run src/test/EditorLocationList.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [x] **Step 7: Run the full suite**

```
npx vitest run --reporter=verbose
```

Expected: all tests PASS.

- [x] **Step 8: Commit**

```
git add src/pages/editor/EditorLocationList.svelte src/pages/editor/EditorLocationList.css src/test/EditorLocationList.test.ts
git commit -m "feat: show pending additions section in EditorLocationList for unmerged PRs"
```
