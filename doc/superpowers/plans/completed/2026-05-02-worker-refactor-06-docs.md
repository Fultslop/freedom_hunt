# Task 06 — Documentation + dead code audit

> **Index:** [worker-refactor](2026-05-02-worker-refactor.md) | **Depends on:** Task 04

**Goal:** Add comments to non-obvious functions, verify no dead code remains.

**Files:**

- Modify: `src/worker/auth.js`
- Modify: `src/worker/github.js`
- Modify: `src/worker/routes/editorRoutes.js`

---

- [ ] **Step 1: Dead code audit**

Check for anything exported but never imported outside tests:

```
grep -rn "verifyToken\|buildR2Key\|createToken\|decodeGitHubContent\|encodeGitHubContent" src --include="*.js" --include="*.jsx"
```

Expected findings:

- `verifyToken` — used inside `requireAuth` in `auth.js`; also imported directly in `worker.auth.test.js`. Not dead.
- `buildR2Key` — used in `uploadRoute.js`; also imported in `worker.test.js`. Not dead.
- `createToken` — used in `authRoutes.js`; also imported in `worker.auth.test.js` and `worker.test.js`. Not dead.
- `decodeGitHubContent` / `encodeGitHubContent` — used in `github.js` internally; exported for `worker.github.test.js`. Not dead.

No dead code to remove. If the grep returns any other hits, investigate before deleting.

---

- [ ] **Step 2: Add comments to `src/worker/auth.js`**

Add the following comments to the non-obvious functions. Do not add comments to functions whose name already explains what they do.

Above `verifyToken`:

```js
// Returns null instead of throwing so callers can treat any invalid token as unauthenticated.
export async function verifyToken(token, secret) {
```

Above `checkRateLimit`:

```js
// Sliding window: resets the counter when more than RATE_LIMIT_WINDOW_MS has passed since windowStart.
// Returns true if the request should be blocked.
export async function checkRateLimit(ip, env) {
```

---

- [ ] **Step 3: Add comments to `src/worker/github.js`**

The `createLocationPR` function has a multi-step side-effectful flow that is non-obvious. It already has a comment from Task 03 — verify it is still present:

```js
// Creates a branch, commits a YAML file, and opens a PR against main.
// Sequence: resolve HEAD sha → create branch → PUT file → create PR.
export async function createLocationPR(...)
```

Add above `fetchPRStatuses`:

```js
// GitHub uses state "closed" for both merged and rejected PRs.
export async function fetchPRStatuses(numbers, env) {
```

---

- [ ] **Step 4: Verify route documentation is present in `src/worker/routes/editorRoutes.js`**

Confirm the `GET /editor/pr-status` comment block is still present (it was added during extraction in Task 04):

```js
// GET /editor/pr-status?numbers=1,2,3
// Returns { ok: true, statuses: { "27": "open", "28": "closed" } }
// Used by the location list to auto-clear pending badges for PRs that are
// no longer open. GitHub uses state "closed" for both merged and rejected PRs.
if (request.method === 'GET' && url.pathname === '/editor/pr-status') {
```

If absent, add it back.

---

- [ ] **Step 5: Run the full test suite one last time**

```
npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```
git add src/worker/auth.js src/worker/github.js src/worker/routes/editorRoutes.js
git commit -m "docs: add comments to non-obvious worker utility functions"
```
