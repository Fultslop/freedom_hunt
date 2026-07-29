# Organizer Results Page — Design

**Date:** 27/07/2026
**Status:** Approved (pending user review of this doc)

## Problem

Form answers are currently collected in two places: a legacy Google Form (used by
`democrats_abroad`, forwarded server-side to a Google Apps Script) and the D1
`form_submissions` table (used by every other project). There is no way for anyone
to see the D1-stored answers short of querying the database directly.

This feature exposes the D1-stored form data to organizers (and, eventually, to
teams viewing their own answers — out of scope for this iteration) via a new page,
following the same "route appended to the city" pattern as the existing photo
gallery (`/:project/:city/gallery`).

**Explicitly out of scope:** the Google Form data used by `democrats_abroad`. That
data never reaches D1 (`formSubmitRoute.ts` forwards it to `FORM_SCRIPT_URL` and
returns before the `insertFormSubmission` call), so **the live Den Haag project will
show an empty results page today**. This is a known, accepted gap — not something
this feature attempts to fix. It only becomes populated if/when `democrats_abroad`
is migrated onto the D1 path, or for any newer project that already uses it (e.g.
`demo`).

## Access Control

Same gate as the photo gallery: `requireAuth` on the frontend route guard,
`requireParticipantForProject` on the worker route. Any team logged into the
project can see every other team's answers for that city. No new organizer-only
auth is introduced by this feature — restricting this to organizers only, and
scoping it to a team's own answers, is left for a future iteration.

Because access is participant-wide (not organizer-only), the API response strips
`contact` from each submission — no reason to leak one team's contact info to
another team's members.

## Backend

### New DB query — `src/worker/db.ts`

```ts
export async function listFormSubmissions(
  database: D1Database,
  projectId: string,
  cityId: string,
): Promise<DbFormSubmission[]> {
  // SELECT * FROM form_submissions WHERE project_id = ? AND city_id = ?
  // ORDER BY submitted_at ASC
}
```

No new table, no migration. Dataset size for a single city's event is small
(tens of teams × ~15 locations); no pagination or SQL-side aggregation needed —
"latest submission per team+location" and "first submission per team+location"
are both computed client-side from the full list, mirroring how `PhotoGallery`
already does client-side filtering over `listPhotos`' full result set.

### New route file — `src/worker/routes/resultsRoutes.ts`

`GET /results/:project/:city/submissions`

- Auth: `requireParticipantForProject(request, env, project)` — 403 if absent/wrong project.
- Calls `listFormSubmissions`, maps each `DbFormSubmission` to a client-safe DTO
  (drops `contact`), returns `{ ok: true, submissions: ResultsSubmission[] }`.
- Wired into `worker.ts`'s fetch chain alongside the other route handlers.

### New shared type — `src/types/results.ts`

```ts
export interface ResultsSubmission {
  id: string;
  locationId: string;
  routeId: string | null;
  teamName: string;
  answers: Record<string, unknown>; // parsed, not the raw JSON string
  submittedAt: number;
}
```

## Frontend

### New page — `src/pages/ResultsDownloadPage.svelte`

Route: `/:project/:city/results_download`, guarded by `requireAuth` (added to
`App.svelte` **before** the `/:project/:city/:route` wildcard, same ordering
requirement that caused the gallery route bug — see devlog 25/07).

On mount, loads two independent things in parallel:

1. **Submissions** — `fetchResultsSubmissions(project, city)` (new function in
   `api.ts`, Results group).
2. **Route index** — for every route in the city's `routes.yaml`, load its
   location YAMLs in order (reusing `loadLocations`) and keep only the
   location-type entries, in order. Produces
   `Record<routeId, { ordinal: number; name: string; fields: FormField[] }[]>`
   — one ordered list per route, restricted to entries that have a
   `challenge.form`, where `ordinal` is that entry's 1-based position **among
   location-type entries in that route** (i.e. `locationOrdinalAt`'s output —
   see below for why this precision matters).

### Why resolution is `(route_id, location_id)`, not `location_id` alone

`form_submissions.location_id` is not a stable per-location identifier. It's
set client-side by `RoutePage.svelte` as `locationOrdinalAt(entries, index)`
(`src/utils/routeEntries.ts`) — **the count of location-type entries up to
that point in whichever route the team is on.** It resets per route.

Concretely, in `demo`'s Paris city (`src/data/text/en/projects/demo/paris/routes.yaml`),
`riverside_route`'s first stop (`001_loc_eiffel_tower`) submits as
`location_id: 1`, and `left_bank_route`'s first stop (`011_loc_musee_orsay`)
*also* submits as `location_id: 1` — same number, unrelated locations. Den
Haag only has one active route today so this happens to be invisible there,
but any multi-route city hits it immediately.

**Consequence:** a submission can only be resolved to a physical location by
looking up `submission.routeId` in the route index, then indexing into that
route's ordered list at position `submission.locationId`. A `location_id`
can never be interpreted on its own. This also means the grid and reports
below are structured **per route**, not as one city-wide pool — see next
section.

### Grid construction (grouped by route)

The page renders one section per route the city defines (`Route: Riverside
Route`, `Route: Left Bank Route`, ...), each containing its own grid:

- **Teams for this route** = the distinct set of `teamName` values among
  submissions whose `routeId` matches this route — not every team in the
  city. A team that did the Riverside route was never going to visit Left
  Bank stops, so it's excluded from that route's grid entirely rather than
  showing manufactured "missing" dashes for a path it never took.
- **Rows** = that route's teams × that route's location-with-a-form ordinals
  (cross product within the route), sorted by ordinal ascending, then team
  name alphabetically.
- For each (team, ordinal) pair, gather all submissions matching
  `routeId + locationId` and take the one with the greatest `submittedAt`
  (if any).
  - Exists → **Answers** cell renders a "View" button; if more than one
    submission exists for that pair, an **"(edited)"** tag appears next to it —
    a lightweight signal that this isn't the team's first answer, without
    exposing a raw ID as its own column (see Answer dialog below for where the
    ID actually surfaces).
  - None → **Answers** cell renders `-`.
- Table columns: **Team | Datetime | Location id | Location name | Answers**
  (`Location id` here is the route-local ordinal — meaningful only within its
  route's section, which is exactly why it's never shown outside that
  section's context).
  - **Datetime** = the `submittedAt` of the submission being shown (i.e. the
    latest one), formatted locally.
- Filter controls above each route's grid:
  - A team/location filter pair (two `<select>`s, same shape as
    `GalleryFilters`), scoped to that route's own teams/locations.
  - A **"Show only missing"** checkbox filters the grid down to rows whose
    Answers cell is `-` — lets an organizer running a live event quickly see
    which teams still haven't submitted at which locations, without scanning
    the full grid by eye.
- A city with only one route (Den Haag today) still renders through this same
  per-route structure — it's just one section, not a special case.

### Answer dialog

Clicking "View" opens a modal (new component, e.g. `ResultsAnswerDialog.svelte`)
listing that submission's answers against the location's form fields, in field
order:

- `section` fields — skipped (they're a heading pseudo-field with no value).
- `photo` fields — **skipped**. A photo answer is never present in
  `answers` (it's uploaded separately to the `photos` table, correlated by
  team+location+task title, not by field id) — there is no reliable way to know
  which of a team's uploaded photos answered which specific photo field. Rather
  than guess, the dialog omits photo fields and shows a one-line note pointing to
  the existing Gallery page for photos.
- All other field types — render the field's `label` as the question, and the
  stored value as the answer, formatted per type (boolean → Yes/No, radio/multiple
  → the selected option label(s), string/number/textarea → the raw value).
- A field present in the form but absent from `answers` (partial submission, e.g.
  an optional field left blank) renders as "No answer" rather than being omitted —
  this is a per-question state inside one dialog, distinct from the table's
  whole-row dash for "never submitted at all."
- Footer line: the submission's own `id` (the D1 row's UUID), and — when more
  than one submission exists for this team+location — a note that this is the
  latest of N submissions. This is where the raw record ID lives; it's not
  promoted to a table column (see Grid construction above).

### Location reports (inline reading view)

The grid above is built for coverage-scanning ("who's missing what"), not for
reading through content — clicking one cell at a time doesn't add up to "a
coherent complete view" of a location's results. A second section on the same
page addresses that directly, nested under the same per-route sections as the
grid (`Route: Riverside Route` → its location reports, `Route: Left Bank
Route` → its own, etc. — never mixed, for the same reason the grid is
route-scoped):

- Below each route's grid, one collapsed group per that route's
  location-with-a-form ordinals, header reading
  `Location 1 — Eiffel Tower (12/18 teams answered)`. The completion count
  is `teams (of this route) with ≥1 submission at this ordinal` / `total teams
  on this route`, computed from the same in-memory data as the grid.
- Expanding a location renders, inline, exactly what that location's part of
  the downloaded `.md` would contain: each team that submitted (fastest-first,
  same "earliest submission at this location" ordering as the doc — see
  Download below), their latest answers, formatted the same way the answer
  dialog formats them. This is a live, on-page rendering of the same
  `buildResultsMarkdown` data model, not a separate hand-rolled view.
- Teams with no submission at that location are not listed in the expanded
  view (same as the doc) — the grid is where "who's missing" lives; this
  section is where "what did they say" lives.
- Sharing formatting logic with both the dialog and the `.md` builder matters
  for consistency: a shared `formatAnswer(field, value)` helper (in
  `resultsMarkdown.ts` or a small sibling util) is used by all three call
  sites, not three independent implementations.

### Download (.md)

A "Download" button on the same page (no second route/page). Generation is pure
client-side, from data already in memory — no new server endpoint.

Logic lives in a standalone, unit-testable utility:
`src/utils/resultsMarkdown.ts` → `buildResultsMarkdown(project, city, routeIndex, submissions): string`,
built from the same `Record<routeId, ...>` route index and full submissions
list the page already loaded — `teams` and `locations` are derived internally
per route rather than passed in flattened, since route scoping isn't optional.

Output shape:

```
TITLE
=====
Date

## Teams (alphabetical order)
- Team A
- Team B

## Answers

### Route: Riverside Route

#### Location 1 — Eiffel Tower

(ordered by date, fastest team first)

*Team*: Team A
*Time*: 2026-07-27 14:03
Question: Did you find the plaque?
Answer: Yes

*Team*: Team B
*Time*: 2026-07-27 14:11
Question: Did you find the plaque?
Answer: No

#### Location 2 — ...

### Route: Left Bank Route

#### Location 1 — Musée d'Orsay
...
```

- **TITLE** = `{project} / {city} Results`; **Date** = the generation date (today).
- **Teams (alphabetical order)** lists every team across every route in this
  city (the section isn't route-scoped — it's a top-level roster), but the
  `## Answers` body is grouped by route first, then by that route's location
  ordinals, for the same reason the on-page grid is: a `location_id` only
  means something in the context of its route.
- Per-location team ordering ("fastest team first") is by that team's **earliest**
  submission timestamp at that location — i.e. when they actually first completed
  it — even though the answer text shown is their latest (possibly edited)
  submission and the *Time* line shows that latest submission's timestamp. This
  keeps "who got here first" meaningful even after a team edits an answer later.
- Only teams with at least one submission at a location are listed under that
  location's section — no dash/blank entries in the doc (unlike the on-page table,
  which shows every team for scannable coverage-checking).
- Field rendering rules mirror the dialog: `section`/`photo` fields skipped,
  fields absent from a shown submission are omitted from that team's block
  entirely (the doc is a readable report, not a fixed-shape record).
- Triggered via a `Blob` + temporary `<a download>` click, same mechanism as
  other file-download interactions already used in the app (no new pattern).

## Edge Cases

- **Empty city** (no submissions yet, e.g. `democrats_abroad` today): the route
  index still builds from YAML, but every route's team list is empty (teams are
  derived from submissions), so there's nothing to cross-product. Page shows
  "No results yet for this city." instead of a set of empty per-route grids.
- **Team name collisions from casing/whitespace** ("Team A" vs "team a"): treated
  as distinct teams, same as everywhere else in the app — there's no team
  registry to normalize against, and fixing that is out of scope here.
- **A submission's `routeId` is null, or doesn't match any route currently in
  the city's `routes.yaml`, or its `locationId` ordinal is out of range for
  that route's current location count** (missing `routeId` on an old/malformed
  submission; a route renamed or deleted; a route's location list reordered or
  shortened after the submission was made — `form_submissions` doesn't
  snapshot the location name the way the `photos` table snapshots
  `task_title`, so this table has no defense against later content edits):
  that submission is excluded from every route's grid and reports — it has
  nowhere to attach to. Not surfaced as an error; this is a data hygiene/drift
  issue, not a page-level failure. A route reorder retroactively "reinterpreting"
  older submissions (rather than orphaning them) is a separate, pre-existing
  characteristic of how `location_id` is generated — out of scope to fix here.
- **A team has submissions under more than one `routeId` for the same city**
  (e.g. they restarted on a different route): they simply appear as a team in
  more than one route's section — expected, not an error.

## Non-Goals (this iteration)

- Organizer-only access control (currently: any project participant).
- Team-scoped "see only your own answers" view.
- Any handling of the `democrats_abroad` Google Form data.
- Format options for the download beyond `.md`.
- Editing or moderating submitted answers from this page.
