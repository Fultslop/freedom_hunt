# Task 02: Fix `fetchPrStatuses` — Add `project` Parameter

**Files:**
- Modify: `src/utils/api.ts`
- Modify: `src/pages/editor/EditorLocationList.svelte`
- Modify: `src/test/api.test.ts`

**Background:** `GET /editor/pr-status` now calls `requireEditorCap(request, env, project)`. For D1 user-token holders, it looks up `project_id` in the `user_project_caps` table. If `project` is `""` (the current default when the param is absent), no caps match and the backend returns 403. The frontend `fetchPrStatuses` never passes a `project` parameter, so every D1-authenticated user gets a silent 403 when loading the PR status badges on the location list.

The existing `worker.test.ts` pr-status tests use a participant token with `isAdmin: true`, which bypasses the D1 cap check — so those tests pass today. They do not need to change.

---

- [ ] **Step 1: Write a failing test**

In `src/test/api.test.ts`, find the existing test:

```typescript
test("fetchPrStatuses GETs /editor/pr-status with comma-joined numbers", async () => {
  mockFetch({ ok: true, statuses: { "42": "open" } });
  const result = await fetchPrStatuses(["42", "43"]);
  expect(fetch).toHaveBeenCalledWith(
    "/editor/pr-status?numbers=42,43",
  );
  expect(result.statuses).toEqual({ "42": "open" });
});
```

Replace it with:

```typescript
test("fetchPrStatuses GETs /editor/pr-status with project and comma-joined numbers", async () => {
  mockFetch({ ok: true, statuses: { "42": "open" } });
  const result = await fetchPrStatuses(["42", "43"], "democrats_abroad");
  expect(fetch).toHaveBeenCalledWith(
    "/editor/pr-status?project=democrats_abroad&numbers=42,43",
  );
  expect(result.statuses).toEqual({ "42": "open" });
});
```

Run: `npm run test:run -- src/test/api.test.ts`

Expected: FAIL — `fetchPrStatuses` does not yet accept a project argument, so the URL won't match.

---

- [ ] **Step 2: Update `fetchPrStatuses` in `src/utils/api.ts`**

Find the existing function (around line 95):

```typescript
export async function fetchPrStatuses(
  numbers: string[],
): Promise<{ ok: boolean; statuses?: Record<string, string> }> {
  const res = await fetch(
    `/editor/pr-status?numbers=${numbers.join(",")}`,
  );
  return res.json() as Promise<{
    ok: boolean;
    statuses?: Record<string, string>;
  }>;
}
```

Replace it with:

```typescript
export async function fetchPrStatuses(
  numbers: string[],
  project: string,
): Promise<{ ok: boolean; statuses?: Record<string, string> }> {
  const res = await fetch(
    `/editor/pr-status?project=${encodeURIComponent(project)}&numbers=${numbers.join(",")}`,
  );
  return res.json() as Promise<{
    ok: boolean;
    statuses?: Record<string, string>;
  }>;
}
```

---

- [ ] **Step 3: Run the API test to confirm it passes**

```
npm run test:run -- src/test/api.test.ts
```

Expected: all tests pass.

---

- [ ] **Step 4: Update the caller in `src/pages/editor/EditorLocationList.svelte`**

Find the call site (around line 134):

```typescript
fetchPrStatuses(numbers)
```

Replace it with:

```typescript
fetchPrStatuses(numbers, params.project)
```

`params.project` is already available — it comes from the router props declared on line 25: `let { params }: { params: { project: string; city: string } } = $props();`

---

- [ ] **Step 5: Run the full test suite**

```
npm run test:run
```

Expected: all tests pass.

---

- [ ] **Step 6: Commit**

```
git add src/utils/api.ts src/pages/editor/EditorLocationList.svelte src/test/api.test.ts
git commit -m "fix: pass project param to /editor/pr-status so D1 user-token holders are not rejected"
```
