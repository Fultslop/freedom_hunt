# City Selector in Editor Location List

**Date:** 2026-05-12
**Status:** Approved

## Problem

`EditorPage` hardcodes `den_haag` when navigating to the Locations editor, making it impossible for organizers to edit locations for other cities (e.g. Oslo). The cities list for a project already exists in `cities.yaml`.

## Solution

Add a city `<select>` dropdown to the toolbar in `EditorLocationList`. Persist the last-used city in localStorage so `EditorPage` can navigate directly to it on next visit.

## Files Changed

- `src/pages/editor/EditorLocationList.svelte`
- `src/pages/editor/EditorLocationList.css`
- `src/pages/editor/EditorPage.svelte`

## Design

### New imports in EditorLocationList

```ts
import { loadText } from "../../utils/loadText";
import type { City, CitiesText } from "../../types/data";
```

### localStorage key

```
editor_last_city_${project}
```

Written in two places in `EditorLocationList`:
1. On mount — so direct URL visits also track the city
2. On dropdown change — so switching city updates it immediately

Read in `EditorPage` to determine which city to navigate to.

### EditorLocationList — city load

Inside the existing `$effect`, add an explicit `params.city` read (so the effect re-fires on city change) and kick off the cities load:

```ts
$effect(() => {
  params.city; // explicit dependency — effect must re-run when city changes
  localStorage.setItem(`editor_last_city_${params.project}`, params.city);
  loadText<CitiesText>('en', `projects/${params.project}/cities`)
    .then((data) => { cities = data?.items ?? []; });
  fetchLocations();
  syncPending();
});
```

> **Why the explicit read:** In Svelte 5, `$effect` only tracks reactive values read synchronously during the effect's execution. `fetchLocations` reads `params.city` inside an `async` function after an `await`, placing it outside the synchronous tracking window. The bare `params.city;` statement ensures the effect re-fires on every city change.

New state:

```ts
let cities = $state<City[]>([]);
```

Cities load is fast; no separate loading indicator needed. If `loadText` returns null or an empty list, the `<select>` is rendered with `disabled` (see toolbar section below).

### EditorLocationList — toolbar

The toolbar uses `justify-content: space-between`. The left side gains a `<select class="loc-list__city-select">` with `bind:value` for idiomatic Svelte 5 controlled behaviour. The select is disabled when the cities list is empty (load failure or not yet arrived).

```html
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
    <!-- existing clear + refresh buttons -->
  </div>
</div>
```

`selectedCity` is a `$state` variable kept in sync with `params.city` inside the `$effect`. This allows `bind:value` (which requires a writable binding) while ensuring the select always reflects the current URL:

```ts
let selectedCity = $state(params.city);

$effect(() => {
  selectedCity = params.city; // keep in sync when URL changes externally
  // ... rest of effect
});
```

On change handler:

```ts
function handleCityChange() {
  localStorage.setItem(`editor_last_city_${params.project}`, selectedCity);
  push(`/editor/locations/${params.project}/${selectedCity}`);
}
```

### EditorPage — button fix

Replace:
```ts
push(`/editor/locations/${project}/den_haag`)
```
with:
```ts
push(`/editor/locations/${project}/${localStorage.getItem(`editor_last_city_${project}`) ?? 'den_haag'}`)
```

No async required. If the user has never used the dropdown, falls back to `'den_haag'`.

> **Note:** The `'den_haag'` fallback is intentionally hardcoded — it is the primary and launch city for the `democrats_abroad` project. If a future project has a different first city, the localStorage key will be populated on first use of the dropdown and the fallback will never be hit after that.

### CSS

New rule in `EditorLocationList.css`, matching the visual style of `.loc-list__refresh-btn`:

```css
.loc-list__city-select {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.loc-list__city-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

## Behaviour Summary

| Scenario | Result |
|---|---|
| First visit ever | EditorPage navigates to `den_haag` |
| Switch to Oslo via dropdown | localStorage updated; list reloads for Oslo |
| Return to EditorPage after switching | Navigates directly to Oslo |
| Navigate directly to city URL | localStorage updated to that city on mount |
| cities.yaml adds a new city | It appears in the dropdown automatically |
| cities.yaml fails to load | Select rendered disabled; list still loads for current city |
