# Participant Route Safety & Form-Submit-to-D1 Design

**Date:** 2026-07-25
**Scope:** (1) Make `/form-submit` project-aware — only `democrats_abroad` forwards to Google Apps Script; every other project writes to a new D1 table. (2) Close a cross-project access gap in `formSubmitRoute.ts` and `galleryRoutes.ts`, where any authenticated participant can currently read or write another project's data by changing the URL, regardless of which project they actually logged into. Does NOT touch editor/organizer auth, does NOT migrate `democrats_abroad`'s own submissions off Google Script — see Out of Scope.

---

## Background

This is sub-project 1 of the [dev/test environment roadmap](2026-07-25-dev-test-environment-roadmap.md). It has to land before the `demo` project exists (which will include both DA's real form-bearing content, referenced by sub-project 2, and new form-bearing content from sub-project 3), because two things are true today:

1. `formSubmitRoute.ts` forwards every submission, from any project, to `env.FORM_SCRIPT_URL` — DA's real Google Sheet — with no project check at all. Introducing a content mirror of DA's real form-bearing locations without fixing this would mean test submissions against the mirror land in the real, live Google Sheet.
2. While investigating that, a second, related gap surfaced: `formSubmitRoute.ts` and `galleryRoutes.ts` gate on `requireAuth()` returning *any* valid token — they never check that the authenticated participant's own `project` matches the `:project` in the URL. Concretely, a participant logged into `demo` could today submit a form to, or browse the photo gallery of, `democrats_abroad` just by changing the URL/payload, because nothing stops them. (`uploadRoute.ts` already gets this right — it derives `project_id` from the auth token, never from client input — this spec brings the other two routes in line with that existing pattern rather than inventing a new one.)

Both are part of the same underlying property this spec establishes: **a participant's write or read access is always scoped to the project their own token belongs to**, never to whatever project id happens to appear in a URL or payload.

---

## Architecture

### What changes

| Layer | Now | After |
|---|---|---|
| `src/worker/auth.ts` | `requireAuth()` only — checks token validity, not project | Adds `requireParticipantForProject(request, env, project)` — valid participant token AND `payload.project === project`, else `null` |
| `formSubmitRoute.ts` | Forwards every submission to `FORM_SCRIPT_URL`, no project check | Uses `requireParticipantForProject`; `democrats_abroad` → unchanged Google Script forward; every other project → insert into new `form_submissions` D1 table |
| `uploadRoute.ts` | Already derives `project_id` from the token (correct) | Switches to the shared `requireParticipantForProject` helper for consistency — no behavior change, since the URL doesn't carry a project id to check against; the token was already the sole source of truth |
| `galleryRoutes.ts` | `requireAuth()` only — any authenticated identity can read any project's gallery | The two `/gallery/:project/:city/...` routes use `requireParticipantForProject(request, env, project)` (project taken from the URL). `/photos/:id/:variant` looks up the photo first, then checks `photo.project_id` against the token's project |
| `src/utils/authGuards.ts` | Frontend `requireAuth` redirects to login only if no session exists at all | Also redirects to `/login/:project` if a participant session exists but for a *different* project — matches the backend, and avoids a page that loads and then 401s |
| D1 | No table for form answers | New `migrations/003_form_submissions.sql` |
| `FormSubmitPayload` / `ChallengeForm.svelte` | No `cityId` sent | Adds `cityId` (component already receives it as a prop for photo upload; this wires it through to form-submit too, for the same `project_id + city_id` scoping `photos` already uses) |

### Behavior change, called out explicitly

Today, an editor/organizer session can also pass `galleryRoutes.ts`'s `requireAuth()` check (it doesn't verify the token is a participant token at all). After this change, `requireParticipantForProject` rejects non-participant tokens outright — an editor would need to log in as a participant of that specific project to view its gallery, same as any participant does today. This is an intentional tightening, not an incidental side effect: the previous behavior meant *any* authenticated identity, from any project, could read any project's gallery.

### Why derive project from the token, not the request

`uploadRoute.ts` already does this correctly today — `authPayload.project` is the only source used to tag a photo's `project_id`, never anything from the multipart form body. This spec applies the identical principle to `formSubmitRoute.ts` and `galleryRoutes.ts`: a participant token is proof of membership in exactly one project (`ParticipantTokenPayload.project`, set at login time by `authRoutes.ts` from the URL the participant actually logged into), so it's the only trustworthy source for "which project does this write/read belong to." Trusting a client-supplied project field (or, for gallery, a bare URL param with no ownership check) would let a valid session for one project act on another's data.

---

## Data Model (D1)

New migration `migrations/003_form_submissions.sql`, applied to the existing `AUTH_DB` — no new binding, same pattern as `002_photos.sql`.

```sql
CREATE TABLE IF NOT EXISTS form_submissions (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL,
  city_id       TEXT NOT NULL,
  route_id      TEXT,
  location_id   TEXT NOT NULL,
  team_name     TEXT NOT NULL,
  contact       TEXT,
  answers       TEXT NOT NULL,   -- JSON-encoded FormSubmitPayload["answers"]
  submitted_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_project_city
  ON form_submissions(project_id, city_id);
```

Mirrors the `photos` table's shape (`project_id`, `city_id`, `route_id`, `location_id`, `team_name`, `contact`) so the two tables can eventually be queried/joined the same way if an admin dashboard is ever built. `answers` stores the raw `Record<string, unknown>` from `FormSubmitPayload` as a JSON string — the field shapes are defined per-location in YAML (`FormField[]`) and aren't worth normalizing into columns.

---

## API Layer

### `POST /form-submit` (rewritten)

1. `requireParticipantForProject` is not directly usable here since the route doesn't know the project until the token is decoded — instead: decode the token via `requireAuth`, reject if missing or not a participant token (`isParticipantToken`), then use `authPayload.project` as the project for everything downstream. (Same shape as `uploadRoute.ts` today.)
2. If `authPayload.project === "democrats_abroad"`: forward the request body to `env.FORM_SCRIPT_URL` exactly as today — **zero behavior change for the real DA project**.
3. Otherwise: parse the JSON body (`locationId`, `routeId?`, `cityId`, `teamName`, `contact`, `answers`), insert a row into `form_submissions` using `authPayload.project`, `authPayload.teamName`, `authPayload.contact` (not client-supplied team/contact — same reasoning as above), and return `{ ok: true }`.

### `POST /upload`

No behavior change. Refactored to call the new shared `requireParticipantForProject` helper instead of `requireAuth` + manual `isParticipantToken` check, purely for consistency — the helper's project argument is a no-op here since upload has no project in its own URL/body to check against; the token remains the sole source, same as before.

### `GET /gallery/:project/:city/photos`, `GET /gallery/:project/:city/photos/random`

Both switch from `requireAuth` to `requireParticipantForProject(request, env, project)` (the `:project` URL segment). Returns 403 (not 401 — the session is valid, just for the wrong project) when the token's project doesn't match.

### `GET /photos/:id/:variant`

Still starts with `requireAuth` (no project in the URL to check yet), but after `getPhotoById` resolves the row, add: if not a participant token, or `authPayload.project !== photo.project_id`, return 403.

---

## Frontend

### `src/types/api.ts` (or wherever `FormSubmitPayload` lives — currently `src/utils/api.ts`)

```ts
export interface FormSubmitPayload {
  locationId: number;
  routeId?: string;
  cityId: string;      // new
  teamName: string;
  contact: string;
  answers: Record<string, unknown>;
}
```

`teamName`/`contact` stay in the payload shape for now (existing pattern) even though the worker will end up trusting `authPayload` over them once `isParticipantToken` is enforced — no call site changes needed beyond adding `cityId`, and it keeps the payload self-descriptive for any future direct API caller.

### `ChallengeForm.svelte`

`handleSubmit` adds `cityId` (the component already receives `cityId` as a prop, currently only used for the photo-upload payload):

```ts
const data = await postFormSubmit({
  locationId,
  routeId,
  cityId,
  teamName: auth?.kind === "participant" ? auth.teamName : "",
  contact: auth?.kind === "participant" ? (auth.contact ?? "") : "",
  answers: values,
});
```

### `src/utils/authGuards.ts`

```ts
export function requireAuth(detail: {
  params?: Record<string, string> | null;
}): boolean {
  const { activeAuth, authLoading, isLoggingOut } = get(authStore);
  if (authLoading || isLoggingOut) {
    return true;
  }
  const project = detail.params?.project ?? "";
  if (
    !activeAuth ||
    (activeAuth.kind === "participant" && activeAuth.projectId !== project)
  ) {
    replace(`/login/${project}`);
    return false;
  }
  return true;
}
```

Editor sessions (`activeAuth.kind === "editor"`) are left alone — this guard is only ever used on participant-facing routes (`/:project`, `/:project/:city`, `/:project/:city/gallery`, `/:project/:city/:route`), and an editor viewing those pages was already a separate, pre-existing situation this spec doesn't change.

---

## Out of Scope

- Migrating `democrats_abroad`'s real submissions off Google Apps Script — it keeps using `FORM_SCRIPT_URL` unchanged, permanently, until a future decision says otherwise.
- Editor/organizer route access scoping (`requireEditorAccess`, `editorRoutes.ts`) — capability-based access there is a separate, already-existing mechanism (`user_project_caps`) and isn't touched.
- An admin-facing UI for reading `form_submissions` — this spec only adds the write path. Reading the data back (dashboard, export) is a future concern, mirroring how `photos` didn't get a read UI until the gallery sub-project.
- Rate limiting or dedup on form submissions — not present today for the Google Script path either; not introduced here.

---

## Testing / Verification

Following the existing worker test patterns (`src/test/worker.uploadRoute.test.ts`, `src/test/worker.gallery.test.ts`):

1. `formSubmitRoute` — unit tests: `democrats_abroad` submission still forwards to `FORM_SCRIPT_URL` with the exact existing body shape (regression guard); a `demo` (or any non-DA) submission inserts into `form_submissions` and does **not** call `fetch` at all; missing/invalid token → 401; editor token → 401; participant token for a *different* project than the one implied by their own session is impossible to construct by design (project always comes from the token, never the request) — test that the D1 insert always uses `authPayload.project`, not any client-supplied value.
2. `uploadRoute` — existing tests continue passing unchanged (refactor-only).
3. `galleryRoutes` — new tests: participant token for project A requesting project B's gallery list/random → 403; same project → 200 (existing behavior preserved); `/photos/:id/:variant` for a photo belonging to a different project → 403.
4. `authGuards.test.ts` (or wherever `requireAuth` is tested) — new case: participant session for project A visiting `/:B/...` → redirects to `/login/B`, not just "let through because *a* session exists."
5. Manual smoke test on the dev checklist (once sub-projects 2–3 exist): log into `demo`, confirm `/democrats_abroad/den_haag` redirects to `/login/democrats_abroad` instead of rendering.
