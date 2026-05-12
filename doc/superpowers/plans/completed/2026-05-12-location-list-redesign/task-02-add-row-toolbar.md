# Task 02 – Add row, toolbar icons, and CSS

**Files:**
- Modify: `src/pages/editor/EditorLocationList.svelte` — add row, toolbar changes
- Modify: `src/pages/editor/EditorLocationList.css` — add `.loc-list__item--add`, remove dead classes
- Modify: `src/test/EditorLocationList.test.ts` — three new tests

---

- [ ] **Step 1: Add three failing tests**

Append to `src/test/EditorLocationList.test.ts`:

```typescript
test("shows only the add row when there are no locations and no pending entries", async () => {
  vi.mocked(fetchEditorLocations).mockResolvedValueOnce({ ok: true, locations: [] });

  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });

  const addBtn = await screen.findByRole("button", { name: /\+ add location …/i });
  expect(addBtn).toBeInTheDocument();
  expect(screen.queryByText("Binnenhof")).not.toBeInTheDocument();
});

test("clicking add row accounts for pending filenames when computing next ID", async () => {
  addPending("democrats_abroad/den_haag/locations", {
    filename: "008_loc_new_place.yaml",
    locationTitle: "New Place",
    prTitle: "Add location: New Place",
    submittedAt: new Date().toISOString(),
    status: "pending",
  });

  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });

  await screen.findByText("New Place");
  await fireEvent.click(screen.getByRole("button", { name: /\+ add location …/i }));
  // live: [001], pending: [008] → max(1, 8) + 1 = 9
  expect(push).toHaveBeenCalledWith(
    "/editor/locations/democrats_abroad/den_haag/new/9",
  );
});

test("toolbar shows ↻ Refresh and ✕ Clear completed labels", async () => {
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

  await screen.findByText("Binnenhof");
  expect(screen.getByRole("button", { name: /↻ refresh/i })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /✕ clear completed/i }),
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify all three fail**

```
npm run test -- --reporter=verbose src/test/EditorLocationList.test.ts
```

Expected: the three new tests fail (no `+ Add location …` button, wrong ID in push call,
no icon in button labels). All other tests pass.

- [ ] **Step 3: Add the `+ Add location …` row to the template**

In `src/pages/editor/EditorLocationList.svelte`, immediately before the closing
`</div>` of `<div class="loc-list">` (after the `{/each}` block), insert:

```svelte
    <button
      class="loc-list__item loc-list__item--add"
      onclick={() => {
        const newId = getNextLocationId(allItems.map((i) => i.filename));
        push(`/editor/locations/${params.project}/${params.city}/new/${newId}`);
      }}
    >
      + Add location …
    </button>
```

- [ ] **Step 4: Update the toolbar — remove add button, add icons**

In `src/pages/editor/EditorLocationList.svelte`, replace the entire
`<div class="loc-list__toolbar">` block with:

```svelte
    <div class="loc-list__toolbar">
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
```

- [ ] **Step 5: Add `.loc-list__item--add` CSS and remove dead rules**

In `src/pages/editor/EditorLocationList.css`:

**Remove** the `.loc-list__add-btn` rule block (lines 18–31 approximately):
```css
.loc-list__add-btn,
.loc-list__refresh-btn {
  ...
}

.loc-list__add-btn {
  background: var(--color-accent);
  color: #fff;
}
```

After removing the combined selector, the `.loc-list__refresh-btn` rule needs its own
block. Replace those two blocks with just the refresh rule:

```css
.loc-list__refresh-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
```

**Remove** the `.loc-list__section-heading` rule block:
```css
.loc-list__section-heading {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary, #888);
  padding: 12px 0 4px;
}
```

**Add** `.loc-list__item--add` at the end of the file (before the closing comment if any):

```css
.loc-list__item--add {
  border-style: dashed;
  color: var(--color-accent);
  cursor: pointer;
  background: transparent;
  width: 100%;
  text-align: left;
  font-weight: 600;
  font-size: var(--font-size-base);
}

.loc-list__item--add:hover {
  background: var(--color-surface);
}
```

- [ ] **Step 6: Run the EditorLocationList tests**

```
npm run test -- --reporter=verbose src/test/EditorLocationList.test.ts
```

Expected: all tests pass, including the three added in Step 1.

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
git add src/pages/editor/EditorLocationList.svelte src/pages/editor/EditorLocationList.css src/test/EditorLocationList.test.ts
git commit -m "feat: add location row inline at bottom of list, toolbar icons"
```
