# Task 01 — editorStorage: status field + new helpers

**Files:**
- Modify: `src/pages/editor/editorStorage.ts`
- Modify: `src/test/editorStorage.test.ts`

**Context:** `PendingEntry` currently has only `filename` plus arbitrary extra fields via `[key: string]: unknown`. We need an explicit `status` field and an `isNew` flag so the list and form can render correct badges and clear the right draft. Three new helpers are added: `updatePendingStatus` (in-place status update), `prWasClosed` (combined status+draft clear for the merged-PR event), and `clearCompletedPending` (remove all `"up_to_date"` entries). All callers that currently call `removePending + clearDraft` for a closed-PR event will be migrated to `prWasClosed` in later tasks.

---

- [ ] **Step 1: Add new tests to `src/test/editorStorage.test.ts`**

Append these tests after the existing ones (keep all existing tests intact):

```ts
import {
  getPending,
  addPending,
  removePending,
  getDraft,
  saveDraft,
  clearDraft,
  updatePendingStatus,
  prWasClosed,
  clearCompletedPending,
} from "../pages/editor/editorStorage";
```

Update the import at the top of the file to include the three new helpers, then append:

```ts
// ---------------------------------------------------------------------------
// updatePendingStatus
// ---------------------------------------------------------------------------

it("updatePendingStatus changes status of an existing entry", () => {
  addPending("ns", { filename: "001_loc_test.yaml", status: "submitting" });
  updatePendingStatus("ns", "001_loc_test.yaml", "pending");
  expect(getPending("ns")[0].status).toBe("pending");
});

it("updatePendingStatus does nothing when filename is not found", () => {
  addPending("ns", { filename: "001_loc_test.yaml", status: "submitting" });
  updatePendingStatus("ns", "999_loc_missing.yaml", "failed");
  expect(getPending("ns")[0].status).toBe("submitting");
});

// ---------------------------------------------------------------------------
// prWasClosed
// ---------------------------------------------------------------------------

it("prWasClosed sets status to up_to_date and clears edit draft", () => {
  const draftKey = "editor_draft_ns_001_loc_test.yaml";
  addPending("ns", {
    filename: "001_loc_test.yaml",
    status: "pending",
    isNew: false,
  });
  saveDraft(draftKey, { title: "Stale" });

  prWasClosed("ns", "001_loc_test.yaml");

  expect(getPending("ns")[0].status).toBe("up_to_date");
  expect(getDraft(draftKey)).toBeNull();
});

it("prWasClosed clears the _new draft key when isNew is true", () => {
  const draftKey = "editor_draft_ns_new";
  addPending("ns", {
    filename: "001_loc_test.yaml",
    status: "pending",
    isNew: true,
  });
  saveDraft(draftKey, { title: "New draft" });

  prWasClosed("ns", "001_loc_test.yaml");

  expect(getPending("ns")[0].status).toBe("up_to_date");
  expect(getDraft(draftKey)).toBeNull();
});

// ---------------------------------------------------------------------------
// clearCompletedPending
// ---------------------------------------------------------------------------

it("clearCompletedPending removes entries with status up_to_date", () => {
  addPending("ns", { filename: "001_loc_a.yaml", status: "up_to_date" });
  addPending("ns", { filename: "002_loc_b.yaml", status: "pending" });
  addPending("ns", { filename: "003_loc_c.yaml", status: "failed" });

  clearCompletedPending("ns");

  const result = getPending("ns");
  expect(result).toHaveLength(2);
  expect(result.map((e) => e.filename)).not.toContain("001_loc_a.yaml");
});

it("clearCompletedPending is a no-op when no up_to_date entries exist", () => {
  addPending("ns", { filename: "001_loc_a.yaml", status: "pending" });
  clearCompletedPending("ns");
  expect(getPending("ns")).toHaveLength(1);
});
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```
npx vitest run src/test/editorStorage.test.ts --reporter=verbose
```

Expected: FAIL — `updatePendingStatus`, `prWasClosed`, `clearCompletedPending` not exported.

- [ ] **Step 3: Update `src/pages/editor/editorStorage.ts`**

Replace the entire file:

```ts
const PENDING_PREFIX = "editor_pending_";
const DRAFT_PREFIX = "editor_draft_";

export interface PendingEntry {
  filename: string;
  status: "submitting" | "pending" | "up_to_date" | "failed";
  isNew?: boolean;
  [key: string]: unknown;
}

export function getPending(namespace: string): PendingEntry[] {
  try {
    const raw = localStorage.getItem(`${PENDING_PREFIX}${namespace}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    return parsed.map((e) => ({
      ...e,
      status: (e.status as PendingEntry["status"] | undefined) ?? "pending",
    })) as PendingEntry[];
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

export function updatePendingStatus(
  namespace: string,
  filename: string,
  status: PendingEntry["status"],
): void {
  const current = getPending(namespace);
  const entry = current.find((e) => e.filename === filename);
  if (entry) {
    entry.status = status;
    localStorage.setItem(`${PENDING_PREFIX}${namespace}`, JSON.stringify(current));
  }
}

export function prWasClosed(namespace: string, filename: string): void {
  const entry = findPendingByFilename(namespace, filename);
  updatePendingStatus(namespace, filename, "up_to_date");
  const draftKey = entry?.isNew
    ? `${DRAFT_PREFIX}${namespace}_new`
    : getPendingDraftKey(namespace, filename);
  clearDraft(draftKey);
}

export function clearCompletedPending(namespace: string): void {
  const current = getPending(namespace);
  localStorage.setItem(
    `${PENDING_PREFIX}${namespace}`,
    JSON.stringify(current.filter((e) => e.status !== "up_to_date")),
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

export function getPendingDraftKey(namespace: string, filename: string): string {
  return `${DRAFT_PREFIX}${namespace}_${filename}`;
}

export function findPendingByFilename(
  namespace: string,
  filename: string,
): PendingEntry | undefined {
  return getPending(namespace).find((e) => e.filename === filename);
}
```

- [ ] **Step 4: Run the tests to confirm they all pass**

```
npx vitest run src/test/editorStorage.test.ts --reporter=verbose
```

Expected: all tests PASS (existing + new).

- [ ] **Step 5: Run the full suite to check for type errors**

```
npx vitest run --reporter=verbose
```

Expected: existing tests pass. Some tests in `EditorLocationForm.test.ts` and `EditorLocationList.test.ts` may show TypeScript errors because `addPending` calls in those test files no longer supply the required `status` field — those will be fixed in Tasks 03 and 04.

- [ ] **Step 6: Commit**

```
git add src/pages/editor/editorStorage.ts src/test/editorStorage.test.ts
git commit -m "feat: add status/isNew to PendingEntry + updatePendingStatus, prWasClosed, clearCompletedPending helpers"
```
