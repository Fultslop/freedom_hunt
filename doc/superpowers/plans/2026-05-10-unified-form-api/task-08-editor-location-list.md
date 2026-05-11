# Task 08: Refactor `EditorLocationList` to Use api.ts

**Files:**
- Modify: `src/pages/editor/EditorLocationList.svelte`

Replace three inline `fetch()` calls with functions from `api.ts`. Remove the local `LocationEntry` interface (it duplicates `LocationListEntry` from api.ts).

---

- [ ] **Step 1: Update imports and remove the local `LocationEntry` interface**

In `src/pages/editor/EditorLocationList.svelte`, replace the script block top section. Change:

```typescript
  import type { Location } from "../../types/data";
  import "./EditorLocationList.css";
  import { getNextLocationId } from "./editorUtils";

  let { params }: { params: { project: string; city: string } } = $props();

  interface LocationEntry {
    filename: string;
    sha: string;
    location: Location;
  }
```

To:

```typescript
  import "./EditorLocationList.css";
  import { getNextLocationId } from "./editorUtils";
  import {
    fetchEditorLocations,
    fetchPrStatuses,
    saveEditorLocation,
    type LocationListEntry,
  } from "../../utils/api";

  let { params }: { params: { project: string; city: string } } = $props();
```

- [ ] **Step 2: Replace `locations` state type**

Change:

```typescript
  let locations = $state<LocationEntry[]>([]);
```

To:

```typescript
  let locations = $state<LocationListEntry[]>([]);
```

- [ ] **Step 3: Replace `fetchLocations()` body**

Replace the entire `fetchLocations` function body with:

```typescript
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
```

- [ ] **Step 4: Replace the `fetch` call in `syncPending()`**

In `syncPending()`, replace:

```typescript
        fetch(`/editor/pr-status?numbers=${numbers.join(",")}`)
          .then((r) => r.json())
          .then((data) => {
            const typed = data as {
              ok?: boolean;
              statuses?: Record<string, string>;
            };
```

With:

```typescript
        fetchPrStatuses(numbers)
          .then((data) => {
            const typed = data;
```

> Remove the `const typed = data as { ... }` cast — `fetchPrStatuses` already returns the correct type. Update all `typed.ok` and `typed.statuses` references to use `data.ok` and `data.statuses` directly (they are the same object).

- [ ] **Step 5: Replace the `fetch` call in `handleHide()`**

In `handleHide()`, replace:

```typescript
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
```

With:

```typescript
      try {
        const data = await saveEditorLocation({
          project: params.project,
          city: params.city,
          filename: _filename!,
          existingSha: sha,
          location: { ...cleanLoc, hidden: true },
        });
```

- [ ] **Step 6: Run lint**

```
npm run lint
```

Expected: passes cleanly.

- [ ] **Step 7: Run tests**

```
npm test -- EditorLocationList
```

Tests will fail (they still mock `globalThis.fetch`). They will be fixed in Task 12.

- [ ] **Step 8: Commit**

```
git add src/pages/editor/EditorLocationList.svelte
git commit -m "refactor: EditorLocationList uses api.ts instead of inline fetch"
```
