# Location List Redesign

**Date:** 2026-05-12
**Status:** Approved

## Goal

Make the location list UX more cohesive: move the add-location action into the list itself, unify live locations and pending additions into one sorted view, and add icons to action buttons.

## Requirements

1. "+ Add location …" appears as the last row in the location list, not as a toolbar button.
2. Clicking it opens the new location editor (same behaviour as the old toolbar button).
3. After submitting a new location and returning to the list, the new entry appears in its correct sorted position; the add row remains at the bottom.
4. All locations (live and pending-only) are ordered by their numerical ID prefix (e.g. `001` from `001_loc_den_haag.yaml`).
5. Refresh button keeps its current toolbar position; gains a `↻` icon prefix.
6. Clear completed button gains a `✕` icon prefix.

## Architecture

### Data / derived state

`fetchLocations` sorts by `getLocationIndex(filename)` (numeric) instead of `localeCompare`.

A new `$derived` `allItems` merges live locations and pending-only additions into one sorted array:

```ts
type ListItem =
  | { kind: 'live';    filename: string; sha: string; location: DataLocation; pending?: PendingEntry }
  | { kind: 'pending'; filename: string; entry: PendingEntry }

allItems = [
  ...locations.map(loc => ({ kind: 'live', ...loc, pending: pendingFor(loc.filename) })),
  ...pendingNewLocations.map(p => ({ kind: 'pending', filename: p.filename, entry: p }))
].sort((a, b) => getLocationIndex(a.filename) - getLocationIndex(b.filename))
```

`pendingNewLocations` (pending entries with no matching live location) stays as the data source for `kind: 'pending'` items. `pendingFor()` continues to attach badges to live rows.

**Mutual exclusivity guarantee:** `pendingNewLocations` is defined as `pending.filter(p => !locations.find(loc => loc.filename === p.filename))`, so the two sets that build `allItems` are mutually exclusive by filename — a given filename can only appear as `kind:'live'` or `kind:'pending'`, never both. No additional dedup step is needed.

### Template

One `{#each allItems}` loop replaces the current split between the "Pending additions" section and the `{#each locations}` loop.

**Live item** (`kind === 'live'`): title, filename meta, Edit + Hide + conditional Delete buttons, pending badge below if present. Identical rendering to today.

**Pending-only item** (`kind === 'pending'`): title (`entry.locationTitle ?? entry.filename`), filename meta, Remove button, badge (submitting / failed+retry / up_to_date / pending+PR link). Uses `.loc-list__item--pending` styling (accent left border, slight opacity).

**Add row** — always last, after the loop:
- `<button class="loc-list__item loc-list__item--add">+ Add location …</button>`
- Full-width, dashed border, accent-coloured text, no inner action buttons.
- `onclick` calls `getNextLocationId` with filenames from the full `allItems` array (live + pending), not just `locations`, to avoid generating an ID already claimed by a pending addition.

**Toolbar** (above the list, right-aligned):
```
[✕ Clear completed]  [↻ Refresh]
```
The `+ Add location` button is removed from the toolbar.

**Empty state:** When `allItems` is empty (no live locations, no pending additions), only the add row is shown.

**Removed from template:** the `{#if pendingNewLocations.length > 0}` block and the `.loc-list__section-heading` element.

### CSS

Add `.loc-list__item--add`:
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

Remove `.loc-list__add-btn` and `.loc-list__section-heading` (no longer used).

All other existing classes stay unchanged.

## Out of scope

- Any changes to `EditorLocationForm` or the submission flow.
- Reordering or renaming of location IDs.
- Pagination or search/filter on the list.
