# Participant Route Safety & Form-Submit-to-D1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/form-submit` project-aware (only `democrats_abroad` uses Google Apps Script; everything else writes to a new D1 table), and close a cross-project access gap where any authenticated participant can currently read or write another project's gallery/form data by changing the URL.

**Architecture:** A new `requireParticipantForProject` helper in `src/worker/auth.ts` becomes the single source of truth for "is this token allowed to act on this project," replacing ad-hoc `requireAuth` calls in `formSubmitRoute.ts` and `galleryRoutes.ts`. `formSubmitRoute.ts` branches on the token's own project (never client input) to decide Google Script vs. D1. The frontend `requireAuth` guard gets the equivalent project check so mismatched navigation redirects instead of rendering then failing.

**Tech Stack:** Existing stack — Cloudflare Workers, D1, Vitest, Svelte 5. No new dependencies.

## Global Constraints

- `democrats_abroad`'s Google Apps Script submission path (`FORM_SCRIPT_URL`) must have zero behavior change — verified by keeping its existing tests passing unmodified in intent (only the token's `project` value changes from the placeholder `"test_project"` to `"democrats_abroad"`, since that's now what selects this path).
- Every write derives its project from the verified auth token (`authPayload.project`), never from request body/query/form data — matches the pattern `uploadRoute.ts` already uses.
- `requireParticipantForProject` returns `null` (→ caller responds 401 for "no session" / 403 for "wrong project," per existing route conventions) rather than throwing.
- New D1 table: `form_submissions`, migration `migrations/003_form_submissions.sql`, same `AUTH_DB` binding as `photos` — no new Cloudflare resource.
- Existing test file conventions: worker route tests live in `src/test/worker.*.test.ts`, use `worker.fetch(request, env)` integration style with a hand-rolled `makeDb()` fake (see `src/test/worker.gallery.test.ts`) rather than mocking `db.ts` functions individually.

---

### Task 1: `form_submissions` D1 table and `db.ts` helper

**Files:**
- Create: `migrations/003_form_submissions.sql`
- Modify: `src/worker/db.ts`
- Test: `src/test/db.test.ts` (extend if it exists; otherwise this task's only automated coverage is via Task 3's route tests — check first)

**Interfaces:**
- Consumes: nothing new.
- Produces: `insertFormSubmission(database: D1Database, submission: DbFormSubmission): Promise<void>`, consumed by Task 3.

- [ ] **Step 1: Check for an existing db-level test file**

Run: `ls src/test/db.test.ts 2>/dev/null || echo "none"`

If it exists, add tests there following its existing style. If not, skip direct unit tests for the DB helper — Task 3's route-level tests exercise it, matching how `insertPhoto` (added in the photo-gallery plan) has no standalone unit test either.

- [ ] **Step 2: Write the migration**

Create `migrations/003_form_submissions.sql`:

```sql
CREATE TABLE IF NOT EXISTS form_submissions (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL,
  city_id       TEXT NOT NULL,
  route_id      TEXT,
  location_id   TEXT NOT NULL,
  team_name     TEXT NOT NULL,
  contact       TEXT,
  answers       TEXT NOT NULL,
  submitted_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_project_city
  ON form_submissions(project_id, city_id);
```

- [ ] **Step 3: Add the `DbFormSubmission` type and `insertFormSubmission` to `db.ts`**

Append to `src/worker/db.ts`, after the existing photo-query section:

```ts
// ---------------------------------------------------------------------------
// Form submission queries
// ---------------------------------------------------------------------------

export interface DbFormSubmission {
  id: string;
  project_id: string;
  city_id: string;
  route_id: string | null;
  location_id: string;
  team_name: string;
  contact: string | null;
  answers: string; // JSON-encoded
  submitted_at: number;
}

export async function insertFormSubmission(
  database: D1Database,
  submission: DbFormSubmission,
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO form_submissions
       (id, project_id, city_id, route_id, location_id, team_name, contact, answers, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      submission.id, submission.project_id, submission.city_id,
      submission.route_id ?? null, submission.location_id, submission.team_name,
      submission.contact ?? null, submission.answers, submission.submitted_at,
    )
    .run();
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add migrations/003_form_submissions.sql src/worker/db.ts
git commit -m "feat: add form_submissions D1 table and insert helper"
```

---

### Task 2: `requireParticipantForProject` auth helper

**Files:**
- Modify: `src/worker/auth.ts`
- Test: `src/test/worker.auth.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, `isParticipantToken` (existing).
- Produces: `requireParticipantForProject(request: Request, env: Env, project: string): Promise<ParticipantTokenPayload | null>`, consumed by Tasks 3 and 5.

- [ ] **Step 1: Write the failing test**

Add to `src/test/worker.auth.test.ts` (check existing imports/setup in that file first and match its style — it likely already imports `createToken`, `TEST_SECRET`):

```ts
import { requireParticipantForProject } from "../worker/auth";

describe("requireParticipantForProject", () => {
  const SECRET = "test-secret";

  it("returns the payload when the token's project matches", async () => {
    const token = await createToken(
      { project: "demo", teamName: "Team A", contact: "a@b.com", isAdmin: false, exp: Math.floor(Date.now() / 1000) + 3600 },
      SECRET,
    );
    const request = new Request("https://example.com/x", { headers: { Cookie: `freedom_hunt_auth=${token}` } });
    const result = await requireParticipantForProject(request, { AUTH_SECRET: SECRET } as any, "demo");
    expect(result?.project).toBe("demo");
  });

  it("returns null when the token's project does not match", async () => {
    const token = await createToken(
      { project: "demo", teamName: "Team A", contact: "a@b.com", isAdmin: false, exp: Math.floor(Date.now() / 1000) + 3600 },
      SECRET,
    );
    const request = new Request("https://example.com/x", { headers: { Cookie: `freedom_hunt_auth=${token}` } });
    const result = await requireParticipantForProject(request, { AUTH_SECRET: SECRET } as any, "democrats_abroad");
    expect(result).toBeNull();
  });

  it("returns null when there is no token", async () => {
    const request = new Request("https://example.com/x");
    const result = await requireParticipantForProject(request, { AUTH_SECRET: SECRET } as any, "demo");
    expect(result).toBeNull();
  });

  it("returns null for a non-participant (editor) token", async () => {
    const token = await createToken({ user_id: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET);
    const request = new Request("https://example.com/x", { headers: { Cookie: `freedom_hunt_auth=${token}` } });
    const result = await requireParticipantForProject(request, { AUTH_SECRET: SECRET } as any, "demo");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/worker.auth.test.ts`
Expected: FAIL — `requireParticipantForProject` is not exported.

- [ ] **Step 3: Implement**

Add to `src/worker/auth.ts`, after the existing `requireAuth` function, importing `isParticipantToken` and `ParticipantTokenPayload` from `../types/auth`:

```ts
export async function requireParticipantForProject(
  request: Request,
  env: Env,
  project: string,
): Promise<ParticipantTokenPayload | null> {
  const payload = await requireAuth(request, env);
  if (!payload || !isParticipantToken(payload)) {
    return null;
  }
  if (payload.project !== project) {
    return null;
  }
  return payload;
}
```

Add `import { isParticipantToken } from "../types/auth";` and `import type { ParticipantTokenPayload } from "../types/auth";` to the top of `auth.ts` alongside the existing `AnyTokenPayload` import.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/test/worker.auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/worker/auth.ts src/test/worker.auth.test.ts
git commit -m "feat: add requireParticipantForProject auth helper"
```

---

### Task 3: Rewrite `/form-submit` to be project-aware

**Files:**
- Modify: `src/worker/routes/formSubmitRoute.ts`
- Modify: `src/test/worker.test.ts` (fix the existing `TEST_PAYLOAD.project` and add new D1-path tests)

**Interfaces:**
- Consumes: `requireAuth`, `isParticipantToken` from `../auth`/`../../types/auth`; `insertFormSubmission` from `../db` (Task 1).
- Produces: no new exports — this is a route handler, already wired into `worker.ts`.

- [ ] **Step 1: Fix the existing tests' token so they still exercise the Google Script path**

In `src/test/worker.test.ts`, the top-level `TEST_PAYLOAD.project` is currently `"test_project"`. Change it to `"democrats_abroad"`:

```ts
const TEST_PAYLOAD: TokenPayload = {
  project: "democrats_abroad",
  teamName: "Team A",
  contact: "a@b.com",
  isAdmin: false,
  exp: Math.floor(Date.now() / 1000) + 3600,
};
```

This is a global fixture used by many `describe` blocks in this file beyond `/form-submit` — search the file for any test that asserts a specific `project` value in a response body (e.g. editor/admin tests) and confirm none depend on it being `"test_project"` before changing it. If any do, give those specific tests their own locally-scoped token instead of changing the shared fixture.

- [ ] **Step 2: Add the new failing tests for the D1 path**

Add to the `describe("/form-submit", ...)` block in `src/test/worker.test.ts`:

```ts
it("writes to form_submissions D1 table for non-DA projects instead of calling fetch", async () => {
  const demoToken = await createToken(
    { project: "demo", teamName: "Team A", contact: "a@b.com", isAdmin: false, exp: Math.floor(Date.now() / 1000) + 3600 },
    TEST_SECRET,
  );
  const fetchSpy = vi.fn();
  globalThis.fetch = fetchSpy;
  const inserted: unknown[] = [];
  const env: Env = {
    FORM_SCRIPT_URL: "https://script.google.com/fake",
    AUTH_STORE: { get: async () => null },
    AUTH_SECRET: TEST_SECRET,
    AUTH_DB: {
      prepare: () => ({
        bind: (...args: unknown[]) => {
          inserted.push(args);
          return { run: async () => {} };
        },
      }),
    },
  } as unknown as Env;
  const request = new Request("https://example.com/form-submit", {
    method: "POST",
    body: JSON.stringify({ locationId: 1, cityId: "paris", answers: { q1: "a" } }),
    headers: { "Content-Type": "application/json", Cookie: `freedom_hunt_auth=${demoToken}` },
  });

  const response = await worker.fetch(request, env);

  expect(fetchSpy).not.toHaveBeenCalled();
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.ok).toBe(true);
  expect(inserted[0]).toContain("demo"); // project_id bound value
  expect(inserted[0]).toContain("Team A"); // team_name from token, not client input
});

it("returns 401 for /form-submit when not authenticated", async () => {
  const env: Env = { AUTH_SECRET: TEST_SECRET } as unknown as Env;
  const request = new Request("https://example.com/form-submit", {
    method: "POST",
    body: JSON.stringify({}),
  });
  const response = await worker.fetch(request, env);
  expect(response.status).toBe(401);
});
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `npx vitest run src/test/worker.test.ts -t "form-submit"`
Expected: the two new tests FAIL (route doesn't check project yet); the existing forward-to-script tests should still PASS since `TEST_PAYLOAD.project` is now `"democrats_abroad"`.

- [ ] **Step 4: Rewrite `formSubmitRoute.ts`**

```ts
import type { Env } from "../../types/worker";
import { requireAuth } from "../auth";
import { isParticipantToken } from "../../types/auth";
import { insertFormSubmission } from "../db";
import { json } from "../utils";

function generateId(): string {
  return crypto.randomUUID();
}

export async function handleFormSubmitRoute(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method !== "POST" || url.pathname !== "/form-submit") {
    return null;
  }

  const authPayload = await requireAuth(request, env);
  if (!authPayload || !isParticipantToken(authPayload)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  if (authPayload.project === "democrats_abroad") {
    try {
      const body = await request.text();
      const scriptRes = await fetch(env.FORM_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const scriptData = (await scriptRes.json()) as { ok?: boolean };
      return json({ ok: scriptData.ok ?? true });
    } catch {
      return json({ ok: false, error: "Submission failed" }, 500);
    }
  }

  try {
    const body = (await request.json()) as {
      locationId?: number;
      routeId?: string;
      cityId?: string;
      answers?: Record<string, unknown>;
    };
    await insertFormSubmission(env.AUTH_DB, {
      id: generateId(),
      project_id: authPayload.project,
      city_id: body.cityId ?? "unknown",
      route_id: body.routeId ?? null,
      location_id: String(body.locationId ?? "unknown"),
      team_name: authPayload.teamName,
      contact: authPayload.contact || null,
      answers: JSON.stringify(body.answers ?? {}),
      submitted_at: Math.floor(Date.now() / 1000),
    });
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "Submission failed" }, 500);
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/test/worker.test.ts -t "form-submit"`
Expected: PASS — all `/form-submit` tests, including the two new ones and the three pre-existing Google Script ones.

- [ ] **Step 6: Run the full suite to check for fallout from the shared `TEST_PAYLOAD` change**

Run: `npm run test:run`
Expected: PASS. If anything outside the `/form-submit` block now fails because it depended on `TEST_PAYLOAD.project === "test_project"`, give that specific test its own local token instead of reverting the shared fixture (this route's DA-detection logic depends on the shared fixture being `"democrats_abroad"`).

- [ ] **Step 7: Commit**

```bash
git add src/worker/routes/formSubmitRoute.ts src/test/worker.test.ts
git commit -m "feat: route form-submit to D1 for non-DA projects, Google Script for DA only"
```

---

### Task 4: Refactor `uploadRoute.ts` onto the shared helper

**Files:**
- Modify: `src/worker/routes/uploadRoute.ts`

**Interfaces:**
- Consumes: `requireParticipantForProject` (Task 2).
- Produces: no interface change — pure refactor.

- [ ] **Step 1: Confirm current tests pass before touching anything**

Run: `npx vitest run src/test/worker.uploadRoute.test.ts`
Expected: PASS (baseline).

- [ ] **Step 2: Replace the manual auth check**

In `src/worker/routes/uploadRoute.ts`, replace:

```ts
import { requireAuth } from "../auth";
...
const authPayload = await requireAuth(request, env);
if (!authPayload || !isParticipantToken(authPayload)) {
  return json({ ok: false, error: "Unauthorized" }, 401);
}
```

There's no project available yet at this point in the handler (it's parsed from `formData` further down, and per this spec must NOT be trusted anyway) — so this route can't call `requireParticipantForProject` with a real project argument. Leave the existing `requireAuth` + `isParticipantToken` check as-is; this task is a no-op confirmation, not a change. Do not import or call `requireParticipantForProject` here — document why in a one-line comment above the check:

```ts
// No project to check against here (project always comes from the token
// itself, per requireParticipantForProject's contract, but this route has
// nothing else to compare it to) — requireAuth + isParticipantToken is correct as-is.
const authPayload = await requireAuth(request, env);
if (!authPayload || !isParticipantToken(authPayload)) {
  return json({ ok: false, error: "Unauthorized" }, 401);
}
```

- [ ] **Step 3: Run tests to confirm nothing broke**

Run: `npx vitest run src/test/worker.uploadRoute.test.ts`
Expected: PASS, unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/worker/routes/uploadRoute.ts
git commit -m "docs: clarify why uploadRoute doesn't use requireParticipantForProject"
```

---

### Task 5: Project-scope `galleryRoutes.ts`

**Files:**
- Modify: `src/worker/routes/galleryRoutes.ts`
- Modify: `src/test/worker.gallery.test.ts`

**Interfaces:**
- Consumes: `requireParticipantForProject` (Task 2), `getPhotoById` (existing).
- Produces: no interface change — same three routes, tighter auth.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/worker.gallery.test.ts` (the file already has `TEST_PAYLOAD` with `project: "democrats_abroad"` and `authToken` built from it in `beforeEach` — reuse those, add a second token for a different project):

```ts
describe("cross-project access", () => {
  let otherProjectToken: string;
  beforeEach(async () => {
    otherProjectToken = await createToken(
      { ...TEST_PAYLOAD, project: "demo" },
      TEST_SECRET,
    );
  });

  it("returns 403 when the token's project doesn't match the gallery list URL", async () => {
    const request = new Request("https://example.com/gallery/democrats_abroad/den_haag/photos", {
      headers: { Cookie: `freedom_hunt_auth=${otherProjectToken}` },
    });
    const response = await worker.fetch(request, { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb() } as unknown as Env);
    expect(response.status).toBe(403);
  });

  it("returns 403 when the token's project doesn't match the random-photos URL", async () => {
    const request = new Request("https://example.com/gallery/democrats_abroad/den_haag/photos/random", {
      headers: { Cookie: `freedom_hunt_auth=${otherProjectToken}` },
    });
    const response = await worker.fetch(request, { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb() } as unknown as Env);
    expect(response.status).toBe(403);
  });

  it("returns 403 when requesting a photo belonging to a different project", async () => {
    const request = new Request("https://example.com/photos/p1/thumb", {
      headers: { Cookie: `freedom_hunt_auth=${otherProjectToken}` },
    });
    const response = await worker.fetch(request, {
      AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb(), PHOTOS: { get: vi.fn() },
    } as unknown as Env);
    expect(response.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to verify these fail**

Run: `npx vitest run src/test/worker.gallery.test.ts -t "cross-project access"`
Expected: FAIL (currently all return 200 — no project check exists).

- [ ] **Step 3: Implement the fix**

Rewrite `src/worker/routes/galleryRoutes.ts`:

```ts
import type { Env } from "../../types/worker";
import type { DbPhoto } from "../db";
import type { GalleryPhoto } from "../../types/gallery";
import { requireAuth, requireParticipantForProject } from "../auth";
import { isParticipantToken } from "../../types/auth";
import { json } from "../utils";
import { listPhotos, randomPhotos, getPhotoById } from "../db";
import { buildVariantKey, PHOTO_VARIANTS, type PhotoVariant } from "../photoKeys";

const RANDOM_SAMPLE_SIZE = 12;

function toGalleryPhoto(photo: DbPhoto): GalleryPhoto {
  return {
    id: photo.id,
    locationId: photo.location_id,
    taskTitle: photo.task_title,
    teamName: photo.team_name,
    uploadedAt: photo.uploaded_at,
    thumbUrl: `/photos/${photo.id}/thumb`,
    mediumUrl: `/photos/${photo.id}/medium`,
    fullUrl: `/photos/${photo.id}/full`,
  };
}

export async function handleGalleryRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method !== "GET") {
    return null;
  }

  const randomMatch = url.pathname.match(/^\/gallery\/([^/]+)\/([^/]+)\/photos\/random$/);
  const listMatch = url.pathname.match(/^\/gallery\/([^/]+)\/([^/]+)\/photos$/);
  const photoMatch = url.pathname.match(/^\/photos\/([^/]+)\/([^/]+)$/);

  if (randomMatch) {
    const [, project, city] = randomMatch;
    const authPayload = await requireParticipantForProject(request, env, project);
    if (!authPayload) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    const photos = await randomPhotos(env.AUTH_DB, project, city, RANDOM_SAMPLE_SIZE);
    return json({ ok: true, photos: photos.map(toGalleryPhoto) });
  }

  if (listMatch) {
    const [, project, city] = listMatch;
    const authPayload = await requireParticipantForProject(request, env, project);
    if (!authPayload) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    let photos = await listPhotos(env.AUTH_DB, project, city);
    const team = url.searchParams.get("team");
    const task = url.searchParams.get("task");
    if (team) {
      photos = photos.filter((photo) => photo.team_name === team);
    }
    if (task) {
      photos = photos.filter((photo) => photo.task_title === task);
    }
    return json({ ok: true, photos: photos.map(toGalleryPhoto) });
  }

  if (photoMatch) {
    const authPayload = await requireAuth(request, env);
    if (!authPayload) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const [, id, variantParam] = photoMatch;
    if (!(PHOTO_VARIANTS as readonly string[]).includes(variantParam)) {
      return json({ ok: false, error: "Unknown variant" }, 400);
    }
    const variant = variantParam as PhotoVariant;
    const photo = await getPhotoById(env.AUTH_DB, id);
    if (!photo) {
      return json({ ok: false, error: "Not found" }, 404);
    }
    if (!isParticipantToken(authPayload) || authPayload.project !== photo.project_id) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    const key = buildVariantKey(photo.r2_key, variant);
    const object = await env.PHOTOS.get(key);
    if (!object) {
      return json({ ok: false, error: "Not found" }, 404);
    }
    const contentType = variant === "full" ? photo.mime_type : "image/jpeg";
    return new Response(object.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  return null;
}
```

Note the 401-vs-403 split preserved for the two existing "returns 401 when not authenticated" tests on the list/random routes: those tests send *no* cookie at all, so `requireParticipantForProject` returns `null` the same way whether the cause is "no session" or "wrong project" — check those two existing tests' expected status codes against this new single-403-on-any-failure behavior before running.

- [ ] **Step 4: Reconcile the two pre-existing "returns 401 when not authenticated" tests**

Open `src/test/worker.gallery.test.ts` and update the two tests titled `"returns 401 when not authenticated"` under `GET /gallery/:project/:city/photos` and `GET /gallery/:project/:city/photos/random` to expect `403` instead of `401`, since `requireParticipantForProject` now returns the same "no valid session for this project" outcome regardless of whether there was no session or the wrong one, and this route family reports that uniformly as 403. Leave the two 401 tests under `GET /photos/:id/:variant` as 401 — that endpoint still starts with a plain `requireAuth` check before it knows which project the photo belongs to.

- [ ] **Step 5: Run the full gallery test file**

Run: `npx vitest run src/test/worker.gallery.test.ts`
Expected: PASS — all existing tests (with the Step 4 status-code updates) plus the three new cross-project tests.

- [ ] **Step 6: Commit**

```bash
git add src/worker/routes/galleryRoutes.ts src/test/worker.gallery.test.ts
git commit -m "fix: scope gallery routes to the authenticated participant's own project"
```

---

### Task 6: Wire `cityId` through `/form-submit` on the frontend

**Files:**
- Modify: `src/utils/api.ts`
- Modify: `src/components/ChallengeForm.svelte`
- Modify: `src/test/api.test.ts`
- Modify: `src/test/ChallengeForm.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `FormSubmitPayload` now includes `cityId: string`, consumed by Task 3's worker route (already written to read `body.cityId`).

- [ ] **Step 1: Write the failing test**

In `src/test/ChallengeForm.test.ts`, find the existing test that asserts what `postFormSubmit` is called with (search for `postFormSubmit` mock assertions) and add `cityId` to the expected call — e.g. if there's a test rendering `<ChallengeForm cityId="den_haag" .../>` and submitting, add:

```ts
expect(postFormSubmit).toHaveBeenCalledWith(
  expect.objectContaining({ cityId: "den_haag" }),
);
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/test/ChallengeForm.test.ts`
Expected: FAIL — current call doesn't include `cityId`.

- [ ] **Step 3: Update the payload type and the two call sites**

In `src/utils/api.ts`:

```ts
export interface FormSubmitPayload {
  locationId: number;
  routeId?: string;
  cityId: string;
  teamName: string;
  contact: string;
  answers: Record<string, unknown>;
}
```

In `src/components/ChallengeForm.svelte`, `handleSubmit`:

```ts
async function handleSubmit(values: Record<string, unknown>) {
  const auth = $authStore.activeAuth;
  const data = await postFormSubmit({
    locationId,
    routeId,
    cityId,
    teamName: auth?.kind === "participant" ? auth.teamName : "",
    contact: auth?.kind === "participant" ? (auth.contact ?? "") : "",
    answers: values,
  });
  if (!data.ok) { throw new Error("Submission failed"); }
}
```

(`cityId` is already a prop on this component — no new prop needed.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/ChallengeForm.test.ts src/test/api.test.ts`
Expected: PASS. If `api.test.ts` has a test asserting the exact `postFormSubmit` request body shape, update it to include `cityId` too.

- [ ] **Step 5: Commit**

```bash
git add src/utils/api.ts src/components/ChallengeForm.svelte src/test/ChallengeForm.test.ts src/test/api.test.ts
git commit -m "feat: include cityId in form-submit payload"
```

---

### Task 7: Frontend `requireAuth` guard — project-scoped redirect

**Files:**
- Modify: `src/utils/authGuards.ts`
- Modify: `src/test/authGuards.test.ts`

**Interfaces:**
- Consumes: `authStore` (existing).
- Produces: no interface change — same `requireAuth(detail)` signature and behavior for the already-covered cases, new behavior for the mismatched-project case.

- [ ] **Step 1: Write the failing test**

Add to `src/test/authGuards.test.ts`, inside `describe("requireAuth", ...)`:

```ts
it("redirects to that project's login when authenticated for a different project", () => {
  authStore.loginParticipant("demo", "Team", "t@test.com");
  const result = requireAuth({ params: { project: "democrats_abroad" } });
  expect(result).toBe(false);
  expect(replace).toHaveBeenCalledWith("/login/democrats_abroad");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/test/authGuards.test.ts`
Expected: FAIL — current guard returns `true` for any truthy `activeAuth`.

- [ ] **Step 3: Implement**

In `src/utils/authGuards.ts`:

```ts
export function requireAuth(detail: {
  params?: Record<string, string> | null;
}): boolean {
  const { activeAuth, authLoading, isLoggingOut } = get(authStore);
  if (authLoading || isLoggingOut) {
    return true;
  }
  const project = detail.params?.project ?? "";
  const wrongProject =
    activeAuth?.kind === "participant" && activeAuth.projectId !== project;
  if (!activeAuth || wrongProject) {
    replace(`/login/${project}`);
    return false;
  }
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/authGuards.test.ts`
Expected: PASS — including the existing "returns true when authenticated" test (same project) and the existing "redirects when not authenticated" test.

- [ ] **Step 5: Run the full suite**

Run: `npm run test:run`
Expected: PASS, all files.

- [ ] **Step 6: Commit**

```bash
git add src/utils/authGuards.ts src/test/authGuards.test.ts
git commit -m "fix: redirect to login when a participant session doesn't match the URL project"
```

---

### Task 8: Lint, typecheck, and update architecture docs

**Files:**
- Modify: `doc/architecture.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: both clean. Fix any issues surfaced by the preceding tasks before proceeding.

- [ ] **Step 2: Update the `photos` table section in `doc/architecture.md`**

Immediately after the existing `### \`photos\` table (D1, \`AUTH_DB\`)` section, add:

```markdown
### `form_submissions` table (D1, `AUTH_DB`)

Populated by `POST /form-submit` for every project except `democrats_abroad`, which still forwards to the Google Apps Script at `FORM_SCRIPT_URL` (unchanged, legacy path — see `doc/setup.md`). Project is always taken from the participant's auth token, never from the request body.

\`\`\`sql
CREATE TABLE form_submissions (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL,
  city_id       TEXT NOT NULL,
  route_id      TEXT,
  location_id   TEXT NOT NULL,
  team_name     TEXT NOT NULL,
  contact       TEXT,
  answers       TEXT NOT NULL,   -- JSON-encoded field-id → value map
  submitted_at  INTEGER NOT NULL
);
\`\`\`
```

- [ ] **Step 3: Update the API Layer table's Challenge row**

Find the `| Challenge | \`postFormSubmit(payload)\` → \`POST /form-submit\`; ... |` row in the API Layer table and note the routing split:

```markdown
| Challenge | `postFormSubmit(payload)` → `POST /form-submit` (routes to Google Sheet for `democrats_abroad`, D1 `form_submissions` for every other project); `postPhotoUpload(payload)` → `POST /upload` |
```

- [ ] **Step 4: Commit**

```bash
git add doc/architecture.md
git commit -m "docs: document form_submissions table and project-aware form-submit routing"
```
