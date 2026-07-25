# Task 01: Fix Pre-Existing Test-Suite Isolation Bug (Prerequisite)

**Files:**
- Modify: `src/test/worker.test.ts:525-533`

**Root cause (verified):** `npm run test:run` fails 64 of 151 tests today, but every failing test passes when run in isolation (`npx vitest run src/test/TitleBar.test.ts` alone: 8/8 pass). Running the full suite with `worker.test.ts` excluded (`npx vitest run --exclude "**/worker.test.ts"`) passes all 282 remaining tests. The cause is isolated to the `/auth/logout` describe block in `worker.test.ts`:

```ts
describe("/auth/logout", () => {
  beforeEach(() => {
    vi.stubGlobal("Response", NodeResponse);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  ...
});
```

The project's `vite.config.ts` runs tests with `isolate: false` + `singleThread: true` (all test files share one JS realm, sequentially). `vi.unstubAllGlobals()` under that configuration reverts more global state than just `Response`, corrupting the `jest-dom` matcher registration and other global setup for every test file that runs afterward in the same thread — producing the cascade of unrelated `"Invalid Chai property"` and stale-mock failures seen across ~29 files.

**Verified fix:** replace the `vi.stubGlobal`/`vi.unstubAllGlobals` pair with a plain manual save/restore of `globalThis.Response`, which does not touch Vitest's global-stub tracking at all. This was tested end-to-end during design research: with this exact change, `npx vitest run` reports `36 passed (36)` files, `318 passed (318)` tests.

No new test is written for this task — it's a fix to existing test infrastructure, verified by running the full suite.

---

- [ ] **Step 1: Apply the fix**

In `src/test/worker.test.ts`, replace:

```ts
describe("/auth/logout", () => {
  // happy-dom v20 blocks Set-Cookie from Response.headers.get(); use undici's
  // Response for this block so the cookie-clearing assertion can read the header.
  beforeEach(() => {
    vi.stubGlobal("Response", NodeResponse);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
```

with:

```ts
describe("/auth/logout", () => {
  // happy-dom v20 blocks Set-Cookie from Response.headers.get(); use undici's
  // Response for this block so the cookie-clearing assertion can read the header.
  // Plain assignment (not vi.stubGlobal/unstubAllGlobals) — with isolate:false,
  // unstubAllGlobals reverts global state shared across the whole test run,
  // not just this file, which broke jest-dom matcher registration for every
  // test file that ran afterward in the same thread.
  const originalResponse = globalThis.Response;
  beforeEach(() => {
    globalThis.Response = NodeResponse as unknown as typeof Response;
  });
  afterEach(() => {
    globalThis.Response = originalResponse;
  });
```

---

- [ ] **Step 2: Run the full suite and confirm exit code**

```bash
npm run test:run
```

Expected: `Test Files  36 passed (36)`, `Tests  318 passed (318)`, and the command exits 0.

If you still see an `AggregateError`/`ECONNREFUSED` block printed to stderr with an exit code of 1 despite all tests showing as passed, that is a separate unhandled-rejection leak (something making a real, unmocked `fetch` call to `localhost:3000`) — not caused by this fix and not blocking for this task, but flag it to the user before continuing, since it means `npm run test:run` won't reliably exit 0 in CI. Do not attempt to silently suppress it (e.g. via `--dangerously-ignore-unhandled-errors` or similar) without confirming with the user first.

---

- [ ] **Step 3: Run lint and typecheck**

```bash
npm run lint
npm run typecheck
```

Expected: both exit 0 with no errors.

---

- [ ] **Step 4: Commit**

```bash
git add src/test/worker.test.ts
git commit -m "fix: replace vi.stubGlobal/unstubAllGlobals with manual Response save/restore

Fixes cross-file test pollution under isolate:false — unstubAllGlobals was
reverting global state needed by later test files, cascading into 64 failures
across 29 files that all pass individually."
```
