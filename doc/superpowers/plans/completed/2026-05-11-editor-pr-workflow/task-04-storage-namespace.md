# Task 04 — Storage namespace refactor + draft helpers

**Files:**
- Modify: `src/pages/editor/editorStorage.ts`
- Modify: `src/pages/editor/EditorLocationList.svelte`
- Modify: `src/pages/editor/EditorLocationForm.svelte`
- Create: `src/test/editorStorage.test.ts`

**Context:** `getPending`/`addPending`/`removePending` currently take `project: string, city: string`. This structure doesn't fit future editors (city editor has no `city` param; route editor needs a `route` param). Refactor to accept a single `namespace: string`. The location editor passes `${project}/${city}/locations`. Future editors use their own namespaces.

Also adds `getDraft`, `saveDraft`, `clearDraft` helpers that accept a raw localStorage key string (computed by each editor).

---

- [x] **Step 1: Write failing tests**

Create `src/test/editorStorage.test.ts`:

```ts
import {
  getPending,
  addPending,
  removePending,
  getDraft,
  saveDraft,
  clearDraft,
} from "../pages/editor/editorStorage";

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// getPending / addPending / removePending (namespace API)
// ---------------------------------------------------------------------------

test("getPending returns empty array when nothing stored", () => {
  expect(getPending("democrats_abroad/den_haag/locations")).toEqual([]);
});

test("addPending stores an entry under the namespace key", () => {
  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    prUrl: "https://github.com/org/repo/pull/1",
  });
  const result = getPending("democrats_abroad/den_haag/locations");
  expect(result).toHaveLength(1);
  expect(result[0].filename).toBe("001_loc_binnenhof.yaml");
});

test("addPending replaces existing entry with same filename", () => {
  addPending("ns", { filename: "001_loc_test.yaml", prUrl: "url-1" });
  addPending("ns", { filename: "001_loc_test.yaml", prUrl: "url-2" });
  expect(getPending("ns")).toHaveLength(1);
  expect(getPending("ns")[0].prUrl).toBe("url-2");
});

test("removePending removes the matching filename", () => {
  addPending("ns", { filename: "001_loc_test.yaml" });
  addPending("ns", { filename: "002_loc_other.yaml" });
  removePending("ns", "001_loc_test.yaml");
  const result = getPending("ns");
  expect(result).toHaveLength(1);
  expect(result[0].filename).toBe("002_loc_other.yaml");
});

test("different namespaces are isolated", () => {
  addPending("project/city-a/locations", { filename: "001_loc_a.yaml" });
  addPending("project/city-b/locations", { filename: "001_loc_b.yaml" });
  expect(getPending("project/city-a/locations")[0].filename).toBe("001_loc_a.yaml");
  expect(getPending("project/city-b/locations")[0].filename).toBe("001_loc_b.yaml");
});

// ---------------------------------------------------------------------------
// getDraft / saveDraft / clearDraft
// ---------------------------------------------------------------------------

test("getDraft returns null when nothing stored", () => {
  expect(getDraft("editor_draft_ns_001_loc_test.yaml")).toBeNull();
});

test("saveDraft and getDraft round-trip values", () => {
  saveDraft("editor_draft_ns_001_loc_test.yaml", { title: "Hello", count: 3 });
  expect(getDraft("editor_draft_ns_001_loc_test.yaml")).toEqual({
    title: "Hello",
    count: 3,
  });
});

test("clearDraft removes the stored draft", () => {
  saveDraft("draft_key", { title: "Hello" });
  clearDraft("draft_key");
  expect(getDraft("draft_key")).toBeNull();
});
```

- [x] **Step 2: Run to confirm they fail**

```
npx vitest run src/test/editorStorage.test.ts --reporter=verbose
```

Expected: FAIL — new function signatures and draft helpers don't exist yet.

- [x] **Step 3: Rewrite `editorStorage.ts`**

Replace the entire contents of `src/pages/editor/editorStorage.ts`:

```ts
const PENDING_PREFIX = "editor_pending_";
const DRAFT_PREFIX = "editor_draft_";

export interface PendingEntry {
  filename: string;
  [key: string]: unknown;
}

export function getPending(namespace: string): PendingEntry[] {
  try {
    const raw = localStorage.getItem(`${PENDING_PREFIX}${namespace}`);
    return raw ? (JSON.parse(raw) as PendingEntry[]) : [];
  } catch {
    return [];
  }
}

export function addPending(namespace: string, entry: PendingEntry): void {
  const current = getPending(namespace);
  const without = current.filter((e) => e.filename !== entry.filename);
  localStorage.setItem(
    `${PENDING_PREFIX}${namespace}`,
    JSON.stringify([...without, entry]),
  );
}

export function removePending(namespace: string, filename: string): void {
  const current = getPending(namespace);
  localStorage.setItem(
    `${PENDING_PREFIX}${namespace}`,
    JSON.stringify(current.filter((e) => e.filename !== filename)),
  );
}

export function getDraft(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, values: Record<string, unknown>): void {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    /* ignore storage quota errors */
  }
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
```

- [x] **Step 4: Update `EditorLocationList.svelte` callers**

In `src/pages/editor/EditorLocationList.svelte`, change every call to `getPending`, `addPending`, `removePending` to use the namespace string. The namespace for the location editor is `` `${params.project}/${params.city}/locations` ``.

Find and replace the three call sites:

```ts
// Before:
getPending(params.project, params.city)
// After:
getPending(`${params.project}/${params.city}/locations`)

// Before:
addPending(params.project, params.city, { ... })
// After:
addPending(`${params.project}/${params.city}/locations`, { ... })

// Before:
removePending(params.project, params.city, filename)
// After:
removePending(`${params.project}/${params.city}/locations`, filename)
```

There are three occurrences in `syncPending` / `handleHide` / `handleDelete`. Update all of them.

- [x] **Step 5: Update `EditorLocationForm.svelte` callers**

In `src/pages/editor/EditorLocationForm.svelte`, change the `addPending` call in `handleSubmit`:

```ts
// Before:
addPending(params.project, params.city, { ... })
// After:
addPending(`${params.project}/${params.city}/locations`, { ... })
```

- [x] **Step 6: Run the tests to confirm they pass**

```
npx vitest run src/test/editorStorage.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [x] **Step 7: Run the full suite**

```
npx vitest run --reporter=verbose
```

Expected: all tests PASS.

- [x] **Step 8: Commit**

```
git add src/pages/editor/editorStorage.ts src/pages/editor/EditorLocationList.svelte src/pages/editor/EditorLocationForm.svelte src/test/editorStorage.test.ts
git commit -m "refactor: namespace-keyed storage helpers + add draft helpers to editorStorage"
```
