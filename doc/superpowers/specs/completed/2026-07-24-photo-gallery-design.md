# Post-Event Photo Gallery Design

**Date:** 2026-07-24
**Scope:** Read-only post-event photo landing page + gallery, and the upload-time metadata changes needed to support it (team/task attribution, capped image variants). Does NOT include bulk download, ZIP export, infinite scroll pagination, EXIF-based per-team featured curation, or shareable single-photo URLs — see Out of Scope.

---

## Background

The scavenger hunt app already lets participants upload photos during a hunt (`POST /upload`), but the stored R2 object carries almost no context: the key is just `${locationId}_${timestamp}.${ext}`, and team name / answers are sent separately to an external Google Sheet via `FORM_SCRIPT_URL`, never linked back to the photo. There is currently no queryable relationship between an R2 photo and the team or task that produced it.

Now that the Den Haag event has run, we need a standalone post-event page where participants can browse and download event photos, filtered by team or task. Building that page requires first closing the metadata gap above — both for photos uploaded from now on, and (via a best-effort backfill) for photos already sitting in R2 from the event that already happened.

Organizers keep using the Google Sheet as their existing view (unchanged). A new D1 table becomes the app's own queryable source of truth for photo metadata, written alongside the sheet.

---

## Prerequisites

Before implementation begins, the current test suite must be un-broken — 64 of 151 tests fail on `main` today, unrelated to this feature:
- A `jest-dom` matcher registration issue across ~20+ component test files (`toBeInTheDocument`/`toHaveTextContent` reported as "Invalid Chai property" — matchers aren't being extended in the Vitest setup).
- `InviteAcceptPage.test.ts` failures from a stale `vi.mock("../utils/api")` missing a `fetchInviteToken` export.
- At least one test making a real network call to `localhost:3000` (`ECONNREFUSED`) instead of being mocked.

This is a prerequisite task in the implementation plan, not part of this feature's scope — but building new tests on top of a broken suite would hide new regressions.

---

## Architecture

### What changes

| Layer | Now | After |
|-------|-----|-------|
| Photo storage | One R2 object per photo, raw uploaded file, unbounded size | Three capped variants per photo (`full`, `medium`, `thumb`) under a shared key prefix |
| Photo metadata | None — team/task only exist in the external Google Sheet, uncorrelated to the R2 object | New `photos` table in the existing `AUTH_DB` D1 database, written at upload time |
| `POST /upload` | Stores raw file, no metadata write | Also accepts `routeId`, `cityId`, `taskTitle`; generates capped variants; inserts a `photos` row |
| Photo access | No serving route exists | New authenticated `GET /photos/:id/:variant` streaming route |
| Frontend | No gallery route | New `/:project/:city/gallery` route, reusing the existing participant/editor auth guard |

### Image processing

Cloudflare's URL-based Image Resizing is not available on the current plan, so resizing happens **in the Worker** at upload time using a WASM image library (`@cf-wasm/photon`), which runs in the Workers runtime without native bindings. This is also where EXIF orientation gets corrected, since WASM resize/re-encode does not preserve EXIF and would otherwise produce sideways thumbnails on some photos even when the original displayed correctly.

Three variants are generated and stored per photo:

| Variant | Target | Purpose |
|---|---|---|
| `thumb` | ~300px long edge | Hero rotation, gallery grid |
| `medium` | ~1200px long edge | Lightbox preview |
| `full` | capped at 2048px long edge, JPEG quality ~85 | Download button. **Not** the literal raw upload — re-encoded and capped so per-photo storage is bounded and predictable regardless of source camera resolution. |

If image processing fails on upload (corrupt file, unsupported format), the Worker falls back to storing only `full` from the raw bytes and skips `medium`/`thumb`; the `photos` row is still written so the upload isn't silently lost. The frontend falls back to the `full` URL if a `thumb`/`medium` variant 404s.

---

## Data Model (D1)

New migration `migrations/002_photos.sql`, applied to the existing `AUTH_DB` database — no new binding required.

```sql
CREATE TABLE IF NOT EXISTS photos (
  id            TEXT PRIMARY KEY,       -- uuid
  project_id    TEXT NOT NULL,
  city_id       TEXT NOT NULL,
  route_id      TEXT,
  location_id   TEXT NOT NULL,
  task_title    TEXT NOT NULL,          -- snapshot of challenge.name at upload time
  team_name     TEXT NOT NULL,
  contact       TEXT,
  r2_key        TEXT NOT NULL,          -- base key prefix, e.g. "001_binnenhof_1731234567890"
  mime_type     TEXT NOT NULL,
  uploaded_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_photos_project_city ON photos(project_id, city_id, uploaded_at);
CREATE INDEX IF NOT EXISTS idx_photos_team ON photos(project_id, city_id, team_name);
```

`task_title` is a snapshot, not a live join against location YAML — this is a "memories" page, so it should reflect what was true during the event even if a location's content is later edited, renamed, or removed. The same reasoning applies to `team_name` and `contact`, both copied from the auth token/form at upload time rather than referenced live.

### R2 key layout

Each photo's three variants live under a shared prefix (`r2_key` is this prefix, without a file extension):

```
{r2_key}/full.jpg
{r2_key}/medium.jpg
{r2_key}/thumb.jpg
```

---

## Upload Flow Changes

`POST /upload` (`src/worker/routes/uploadRoute.ts`) changes:

1. Client (`ChallengeForm.svelte` — already has `locationId`, `routeId`, and the location's `challenge.name` in scope) additionally sends `cityId` and `taskTitle` in the upload `FormData`.
2. Worker pulls `project` and `teamName` from the authenticated participant token via `requireAuth` — never trusts the client for these two fields.
3. Worker generates the three capped variants (see Image Processing above), writes them to R2 under the new key layout, and inserts one row into `photos` — all within the same request. This removes any need for timestamp-based correlation for anything uploaded going forward.
4. The existing `/form-submit` → Google Sheet write is unchanged; organizers keep their current view.

---

## Backfill (Den Haag Event)

A one-off local script, `scripts/backfill-photos.ts` (not part of the deployed app), run manually once:

1. Lists all existing R2 objects (current naming: `{locationId}_{timestamp}.ext`).
2. Reads all rows from the Google Sheet via the existing `doGet` endpoint on `FORM_SCRIPT_URL` (`timestamp, routeId, locationId, teamName, email, fields` columns, per `doc/superpowers/plans/2026-05-02-dashboard-02-sheet-read.md`).
3. For each photo, finds the sheet row with matching `locationId` and the closest `timestamp` (within a bounded window, e.g. 10 minutes) to recover `teamName`, `routeId`, and `contact`.
4. Generates `full`/`medium`/`thumb` variants for each existing original (applying the same 2048px/quality-85 cap), re-uploads them under the new `{r2_key}/...` layout, and inserts the corresponding `photos` row. `task_title` is looked up from the current location YAML, since it is the only source available for historical data.
5. Photos with no confident sheet match (outside the time window, or no matching `locationId`) are still inserted, with `team_name = "Unknown"`, so they remain visible in the gallery rather than being silently dropped.
6. Failures on individual photos are logged to a report file rather than aborting the run.

---

## API Endpoints

All routes below require an authenticated session (`requireAuth` — participant or editor; access is "logged in," not role-gated) — matches the existing pattern of a shared per-project login. Access is via the same login as the main app (`/login/:project`); if `authStore.activeAuth` is already set, the login step is skipped automatically, since the gallery reuses the existing `authStore`/cookie session.

| Route | Purpose |
|---|---|
| `GET /gallery/:project/:city/photos` | Returns all photo metadata for that project+city: `id, taskTitle, teamName, locationId, uploadedAt`, plus derived variant URLs. Optional `?team=` / `?task=` query params are supported server-side from the start, even though the MVP gallery does client-side filtering, so pagination/server-side filtering can be added later without a contract change. Photo volume for Den Haag is expected in the low hundreds, so fetch-all is fine for now. |
| `GET /gallery/:project/:city/photos/random` | Returns a random sample (e.g. 12) for hero rotation. `ORDER BY RANDOM() LIMIT 12` in D1 is adequate at this scale. |
| `GET /photos/:id/:variant` | Streams image bytes from R2 for `variant` in `thumb`/`medium`/`full`, after the same auth check. Sets a long-lived `Cache-Control` since photos are immutable once uploaded. This is what `<img src>` and the lightbox download link point at — photos are never served from a public R2 URL, since these are real participants' photos of themselves and their teammates. |

---

## Frontend Pages & Components

New route added to `App.svelte`, following the existing `/:project/:city/...` convention:

| Route | Component |
|---|---|
| `/:project/:city/gallery` | `GalleryLandingPage.svelte` — hero rotation + CTAs + full grid on one scrollable page |

Guarded by the existing `requireAuth` function in `src/utils/authGuards.ts` (unchanged), redirecting to `/login/:project` if not authenticated.

**Components** (co-located `.css`, BEM naming, per project conventions):

- `PhotoHero.svelte` — fetches the random sample, auto-rotates every 3-4s, stacked-Polaroid presentation via CSS `transform: rotate()` (randomized tilt per photo, set once per photo not re-randomized on each rotation), shows team name + task title as caption per photo.
- `PhotoGallery.svelte` — grid of `PhotoThumb.svelte` cards using the `thumb` variant; owns the fetched full photo list and current filter state.
- `GalleryFilters.svelte` — team-name and task-name filter inputs; filters the already-fetched list client-side, no extra API calls.
- `PhotoLightbox.svelte` — modal opened on thumb click; loads the `medium` variant, shows team/task metadata, and a `<a href="/photos/:id/full" download>` button. Supports `Escape` to close. No cross-photo keyboard navigation for MVP (see Out of Scope).

Landing page CTAs: "Browse All Photos" scrolls to the grid section; "Find / Download My Photos" scrolls to the grid and focuses the team filter input.

---

## Error Handling

- **No photos yet for a project/city** — empty state ("No photos yet") instead of an error. `PhotoHero` hides itself entirely if the random-sample endpoint returns fewer than 3 photos, to avoid an awkward rotation of one or two.
- **Missing/corrupt image variant** — `PhotoThumb`/`PhotoLightbox` fall back to the `full` URL if `thumb`/`medium` 404s.
- **Auth expired mid-browse** — `GET /photos/:id/:variant` returning 401 is handled by the existing app-wide session-expiry flow, not a gallery-specific case.
- **Backfill script partial failures** — logged per-photo to a report file; the run continues rather than aborting.
- **Upload-time image processing failure** — falls back to storing only `full` from the raw bytes; `photos` row is still written.

---

## Testing

Following the existing Vitest + `@testing-library/svelte` setup (once the prerequisite test-suite fixes land):

- Worker route tests for the three new gallery endpoints (`worker.test.ts` pattern) — auth-required, team/task filtering, random sampling.
- Unit tests for the new upload key/variant-generation logic (equivalent to today's `buildR2Key` tests).
- Component tests: `PhotoGallery` (filter behavior), `PhotoLightbox` (open/close, correct download `href`), `PhotoHero` (rotation timing via fake timers, hides below the 3-photo threshold).
- `scripts/backfill-photos.ts` gets an integration-style test against mocked Sheet/R2 responses — a one-off script is still worth verifying before running once against real data, since mismatches would misattribute real photos.

---

## Out of Scope

Explicitly deferred, per the original request:
- Bulk download / ZIP export / select-all.
- Infinite scroll / server-side pagination (endpoint shape supports adding it later).
- Blur-up progressive loading beyond the three fixed variants.
- Shareable single-photo URLs.
- Organizer-curated "featured photo" flag (hero uses a random sample instead).
- Cross-photo keyboard navigation within the lightbox.
