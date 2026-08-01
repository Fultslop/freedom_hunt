# The Freedom Hunt — Architecture

## What Is This Project

The Freedom Hunt is a gamified, digitally-run scavenger hunt across European cities for American expats. Run by organisations like Democrats Abroad chapters, it drives voter registration while building community and political consciousness.

Participants visit historically significant sites, complete challenges at each location, and are guided toward registering to vote. The app is mobile-first and runs in the browser — no app store download required.

**App title:** "YES. WE. VOTE."

## Tech Stack

| Layer        | Choice                                                                        |
| ------------ | ----------------------------------------------------------------------------- |
| Framework    | Svelte 5                                                                      |
| Build tool   | Vite 6                                                                      |
| Routing      | svelte-spa-router (hash-based)                                                |
| Language     | TypeScript (`.ts` + `.svelte`)                                                |
| Styling      | Co-located `.css` files + CSS custom properties (no CSS modules, no Tailwind) |
| Data         | Static YAML files in `src/data/text/`                                         |
| YAML loading | `@modyfi/vite-plugin-yaml` (bundled at build time)                            |
| Maps         | Leaflet (via `use:leafletMap` Svelte action)                                  |
| Markdown     | marked                                                                        |
| Icons        | lucide-svelte                                                                 |
| Deployment   | Cloudflare Workers via `@cloudflare/vite-plugin` + wrangler                   |
| Testing      | Vitest + @testing-library/svelte                                              |

## File Structure

```
src/
  pages/
    LandingPage.svelte  — Attract screen (SearchPlane background, DepthWordmark) hosting JoinSheet; "Start hunting" → /start
    TeamSetupPage.svelte — Team name (AppForm random_value: reroll + editable) → completes login via stashed password; auto-skips to RoutePage when the project has exactly one city/route
    ProjectPage.svelte  — City picker for a chosen project
    CityPage.svelte     — Route picker for a chosen city
    RoutePage.svelte    — Swipe-based challenge flow
    LoginPage.svelte    — Login: team name (prefill + dice reroll) + password; contact removed
    GalleryLandingPage.svelte — Post-event photo gallery: hero rotation + filterable grid + lightbox download
    editor/             — Editor pages (admin)
  components/
    TitleBar.svelte     — Persistent top bar (back, title, progress, theme switcher)
    SearchPlane.svelte  — Tilted 3D procedural-search background (frozen/search/route modes); shared by LandingPage and TeamSetupPage
    JoinSheet.svelte    — Hunt-code entry sheet hosted on LandingPage: empty/checking/invalid/found states
    HuntSummary.svelte  — Stat chips (stops/distance/duration) for JoinSheet's found state, shown only when a project resolves to exactly one city/route
    DepthWordmark.svelte — Indented "Searchspace / Scavenger Hunt / <project>" wordmark with theme-gated sheen
    ChallengeCard.svelte — Card for one location (storyline, breadcrumb, challenge)
    ChallengeForm.svelte — Inline form embedded inside a ChallengeCard
    AppForm.svelte      — Generic data-driven form (renders all field types, calls onSubmit callback)
    CitySelector.svelte — City card used in ProjectPage
    RouteSelector.svelte — Route card used in CityPage
    MarkdownText.svelte — Renders markdown via marked
    RouteScreen.svelte  — Dispatches a route entry to ChallengeCard/TextScreen/SplashScreen/OptionsScreen/ConsentScreen/CompletionScreen by template-type
    TextScreen.svelte   — Route entry template: top image + title + markdown
    SplashScreen.svelte — Route entry template: full-bleed image, shader/overlay, anchored title, entrance effect
    OptionsScreen.svelte — Route entry template: top image + title + navigation buttons
    ConsentScreen.svelte — Route entry template: GDPR consent screen (age gate, photo-promotion checkbox/note via AppForm, safety/photo bullet sections, chips)
    CompletionScreen.svelte — Route entry template: end-of-route stats + data-driven WideButton list
    ScreenHero.svelte   — Shared top-image component used by TextScreen/OptionsScreen
    CheckpointGateModal.svelte — Portal overlay for checkpoint gates: fail/succeed modes, skippable, onStay/onProceed
    effects/            — ConfettiEffect, ShootingStarsEffect, FireworksEffect (hand-rolled CSS)
  stores/
    themeStore.ts       — Active theme; syncs CSS custom properties to <html>
    titleBarStore.ts    — Title bar state (title, progress, back path)
    languageStore.ts    — Language selection (currently English only)
    authStore.ts        — Authentication state
    fontSizeStore.ts    — Font size preference
  theme/
    themes.ts           — wireframe / app / GWC theme presets
  utils/
    loadText.ts         — Loads YAML data files at runtime
    loadLocations.ts    — Resolves and loads location YAML files for a route
    authGuards.ts       — Route pre-condition functions for svelte-spa-router
    routeNav.ts         — Navigation helpers (clampedNext, clampedPrev)
    checkpointNav.ts    — Checkpoint-aware navigation: isCheckpointEntry, nextNavigableIndex, prevNavigableIndex, earliestAllowedIndex, isBackwardCrossingBlocked
    routeRequirements.ts — evaluateGate: resolve requirement check results against a gate (forms, period logic)
    teamNameGenerator.ts — generateTeamName(seedNouns?): 32 adjectives × 32 nouns by default, or a project-seeded noun list
    normalizeCode.ts     — normalizeCode(): canonical uppercase/no-separator form for hunt-code/password comparison (client display + server matching)
    searchWalk.ts        — Pure procedural-tree geometry for SearchPlane's search mode (child count, headings, camera lerp, aging)
    placeNames.ts        — Decorative fictional place-name labels for SearchPlane (not the team-name generator)
    huntSummary.ts        — resolveHuntSummary(): resolves a project to route stats only when it has exactly one city and one route; haversineMeters()
    api.ts              — All client HTTP functions (challenge, editor, auth); postVerifyCode resolves typed codes
    formValues.ts       — buildNestedValues (dotted-path → nested object) and flattenValues (inverse)
    routeEntries.ts     — isLocationEntry/locationTotal/locationOrdinalAt — location-vs-template discrimination; isNavBarVisible excludes checkpoints
    splashEffectHistory.ts — shouldFireEffect/recordEffectFired — splash entrance-effect cooldown/repeat tracking
  actions/
    swipe.ts            — Svelte action for touch swipe events
    leafletMap.ts       — Svelte action for Leaflet map integration
  assets/
    AssetManager.ts     — fetchImage(filename) fetches /assets/img/ at runtime,
                          caches as blob URLs; preloadImages() for early warming
  data/
    img/                — Location images (served at /assets/img/ in dev + prod)
    text/
      en/
        application.yaml              — App title & tagline
        editor/
          location_form.yaml            — Field definitions for the location editor form
        projects/
          projects.yaml               — Project index (id, name, description)
          <projectId>/
            <projectId>.yaml          — Project detail text
            cities.yaml               — City list for this project
            <cityId>/
              <cityId>.yaml           — City description
              routes.yaml             — Route definitions (name → location ID list)
              <locationId>.yaml       — Location challenge data
  test/
    *.test.ts           — Vitest + @testing-library/svelte tests
  main.ts               — App entry point
  App.svelte            — Route definitions + store initialization
doc/
  architecture.md       — This file
  devlog/
    _devlog.md          — Session-by-session development log
  plans/                — Human-authored implementation plans
  prompts/              — Reusable prompts and AI context snippets
  superpowers/
    specs/              — Brainstorming design specs
    plans/              — Superpowers-generated implementation plans
```

## Routing

| Path                     | Component     | Notes                                               |
| ------------------------ | ------------- | --------------------------------------------------- |
| `/`                      | `LandingPage` | Attract screen, join sheet closed                    |
| `/start`                 | `LandingPage` | Same page, join sheet open with an empty code field  |
| `/join/:code`            | `LandingPage` | Same page, join sheet open and auto-verifying `:code` (deep link / QR target) — lands in the found state without flashing the empty form |
| `/team/:project`         | `TeamSetupPage` | Team name (`AppForm` `random_value` field: reroll + editable) + password (from stashed verify-code response, `sessionStorage.pendingHuntAuth`); completes login. Skips straight to `/:project/:city/:route` when `resolveHuntSummary` finds exactly one city/route, otherwise lands on `/:project` |
| `/login/demo`            | `DemoLoginPage` | Email+password login for the `demo` project only — matched before the `/login/:project` wildcard. `LandingPage`'s demo button and a code of literally `demo` both route here unchanged |
| `/signup/demo`           | `DemoSignupPage` | Email+password signup for the `demo` project only — matched before the `/signup` route |
| `/:project`              | `ProjectPage` | City picker; loads `projects/<project>/cities.yaml` |
| `/:project/:city`        | `CityPage`    | Route picker; loads `<city>/routes.yaml`            |
| `/:project/:city/:route` | `RoutePage`   | Swipe-based challenge flow; loads location YAMLs    |
| `/:project/:city/gallery` | `GalleryLandingPage` | Read-only post-event photo gallery; hero rotation + filterable grid + lightbox download |
| `/:project/:city/results_download` | `ResultsDownloadPage` | Organizer/participant results view: per-route coverage grid, inline location reports, `.md` export |

**RoutePage states:** loading → location cards rendered as a swipeable stack. Swipe left advances, swipe right retreats. Current index is persisted to `localStorage` keyed by project/city/route so reload resumes position.

### Route entry templates (`template-type`)

A route's `locations` list can mix ordinary locations with non-location screens. Every entry file has an optional `template-type` field — absent (or `"location"`) means the existing location shape above; six other values render a different template instead:

| `template-type` | File pattern | Renders |
|---|---|---|
| `text` | `NNN_text_<slug>.yaml` | Top image (optional) + centered title + markdown body |
| `splash` | `NNN_splash_<slug>.yaml` | Full-bleed image with an optional CSS shader/overlay, anchored title, optional one-shot entrance effect |
| `options` | `NNN_options_<slug>.yaml` | Top image (optional) + centered title + a list of buttons, each linking externally or navigating to a named in-app screen |
| `consent` | `NNN_consent_<slug>.yaml` | GDPR consent screen: heading/intro/chips + two icon+text bullet sections (safety/photos) + an embedded `AppForm` (age gate, photo-promotion checkbox, declined-state note) + primary button + optional privacy link/footer. See "Consent & Photo-Promotion Review" below. |
| `checkpoint` | `NNN_chck_<slug>.yaml` | Gate that blocks forward/backward navigation until a requirement is met; never rendered as a visible screen — the carousel skips over it via nextNavigableIndex/prevNavigableIndex |
| `completion` | `NNN_completion_<slug>.yaml` | End-of-route screen: hero image, title/subtitle/place/caption, closing text, stats (stops/photos/time), and a data-driven `buttons` list (`WideButton`) |

Existing `NNN_loc_*.yaml` files are unaffected. Each template type has its own JSON Schema in `src/data/schemas/` (`text.schema.json`, `splash.schema.json`, `options.schema.json`, `consent.schema.json`, `completion.schema.json`), validated the same three ways as location/form YAML (IDE via `.vscode/settings.json`, CI via `npm run validate:yaml`). A consent entry's `fields` array is authored inline (not a separate `*_form_*.yaml` file) and is validated by `scripts/validate-yaml.ts` against `form.schema.json` as a second pass over that same file, since `consent.schema.json` itself only checks that `fields` is an array.

`RouteEntry` (`src/types/data.ts`) is the discriminated union of all seven shapes. `loadLocations.ts` passes non-location entries through unresolved (no `challenge.form` to resolve); `RoutePage.svelte` renders each entry via a new `RouteScreen.svelte` dispatcher, which picks `ChallengeCard`/`TextScreen`/`SplashScreen`/`OptionsScreen`/`ConsentScreen`/`CompletionScreen` based on `template-type`.

Only `location`-type entries count toward the route's progress indicator ("N of M") and get a numbered badge — `src/utils/routeEntries.ts`'s `locationTotal`/`locationOrdinalAt` compute this separately from the raw array index used for swipe navigation and localStorage keys. While viewing a template screen, the progress indicator holds at the last-passed location's number.

Splash screen entrance effects (`confetti | shooting-stars | fireworks`, `src/components/effects/`) are hand-rolled CSS, no animation library. `repeat-effect: { cooldown, max }` controls whether the effect replays on re-entering the same screen; the fire-count/last-fired state lives in `RoutePage`'s `splashEffectHistory` (`src/utils/splashEffectHistory.ts`), not inside `SplashScreen` itself, since carousel/peek swipe mode reuses one component instance across many different entries via prop changes rather than remounting per entry.

The admin editor does not yet support authoring these template types — they're hand-authored YAML for now, same validation safety net as locations.

## Data Model

### `application.yaml`

```yaml
app.title: "YES. WE. VOTE."
app.tagline: "..."
```

### `projects/projects.yaml` — Project index

```yaml
items:
  - id: democrats_abroad
    name: "Democrats Abroad / Global Women's Caucus"
    description: "..."
```

### `projects/<projectId>/cities.yaml` — City list

```yaml
items:
  - id: den_haag
    name: "Den Haag"
    image: den-haag-logo.jpg
    country: "Netherlands"
    description: "..."
```

### `projects/<projectId>/<cityId>/routes.yaml` — Route definitions

```yaml
short_loop:
  description: "A 2.5–3 hour route..."
  locations:
    - 001_loc_binnenhof
    - 002_loc_vredespaleis

extended_route:
  description: "A 3.5–4.5 hour route..."
  locations:
    - 004_loc_american_bookstore
    - 001_loc_binnenhof
    - 002_loc_vredespaleis
    - 003_loc_plein
```

### `projects/<projectId>/<cityId>/<locationId>.yaml` — Location detail

```yaml
locationId: 1
title: "The Final Civic Act"
image: filename.jpg
name:
  label: ""
  value: "Binnenhof / Het Plein"
address: "Binnenhof 1"
coordinates:               # optional — omit to hide the map section
  longitude: 4.3133
  latitude: 52.0799
storyline: |
  Narrative context shown on the card.
breadcrumb: |               # optional — omit to hide the "clue to next destination" section
  The navigational clue to find the location.
challenge:
  name: ""
  description: |
    The challenge the participant must complete.
  notes: ""
  form:
    - id: found_plaque
      type: boolean
      label: Did you find the plaque?
    - id: motto_text
      type: string
      label: What motto is engraved?
    - id: visitor_count
      type: number
      label: Roughly how many visitors are here?
    - id: time_of_day
      type: radio
      label: What time of day did you arrive?
      options:
        - Morning (before 12:00)
        - Afternoon (12:00–17:00)
        - Evening (after 17:00)
```

Supported form field types: `boolean`, `string`, `number`, `radio`, `multiple`, `photo`, `textarea`, `section`.

`textarea` renders a `<textarea>` for long text. `section` is a pseudo-field that renders a heading in the form with no associated value — used by the editor form for visual grouping.

Reference: `src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml` is the canonical complete example.

### `projects/<projectId>/<projectId>.yaml` — Project metadata

Free-form project-level YAML. Fields consumed by the app:

```yaml
organizer_url: "https://your-organization.example.org"
project.store_forms_in_local_storage: true   # default true
project.form_required: false                  # default false
project.can_forms_skip: false                 # default false
project.allow_resubmit: true                  # default true
```

- `organizer_url` — if present, the gallery landing page (`/:project/:city/gallery`) renders a header link pointing to this URL (opens in a new tab). If absent, no link is shown.
- `project.store_forms_in_local_storage` — when true (default), each location's form values, photo upload outcomes, and submitted/skipped flags persist to `localStorage` (see `src/utils/formStorage.ts`), keyed `${project}/${city}/${route}/${locationId}/form`, so in-progress or completed forms survive a reload or crash. When false, all form state is in-memory only for the session.
- `project.form_required` — when true, the Next button/swipe-forward is blocked (soft-disabled: styled but still clickable) until the current location's form is submitted, showing a toast listing missing required fields on a blocked attempt. Required `photo` fields must have a successful upload to count as filled.
- `project.can_forms_skip` — when true, the blocked-navigation toast includes a Skip button that bypasses the requirement for that location (persisted if local storage is enabled).
- `project.allow_resubmit` — when true (default), a location's form stays visible and editable after a successful submit, with the button relabeled "Re-submit" (disabled until a value changes). When false, the form is replaced by a static "Submitted! ✓" message, matching the original behavior.

`getHuntSettings()` (`src/utils/huntSettings.ts`) centralizes reading these four flags with their defaults; `RoutePage` loads this file once per route via `loadText`.

### `photos` table (D1, `AUTH_DB`)

Populated by `POST /upload` (see API Layer below) and by the one-off `scripts/backfill-photos.ts` migration script for pre-existing event photos. Not derived from YAML — this is the only queryable link between an uploaded photo and the team/task/project/city that produced it.

```sql
CREATE TABLE photos (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL,
  city_id       TEXT NOT NULL,
  route_id      TEXT,
  location_id   TEXT NOT NULL,
  task_title    TEXT NOT NULL,   -- snapshot of challenge.name at upload time, not a live join
  team_name     TEXT NOT NULL,
  contact       TEXT,
  r2_key        TEXT NOT NULL,   -- R2 key prefix; variants live at {r2_key}/{thumb,medium,full}.jpg
  mime_type     TEXT NOT NULL,
  uploaded_at   INTEGER NOT NULL
);
```

### `participant_whitelist` / `participant_accounts` tables (D1, `AUTH_DB`)

Used only by the `demo` project's participant auth. `participant_whitelist` gates who may sign up (`email`, `project_id`, `added_at` — managed manually via `wrangler d1 execute`, no admin UI). `participant_accounts` holds individual email+password participant accounts (`id`, `email`, `project_id`, `team_name`, `contact`, `password_hash`, `created_at`), scoped per-project. Login/signup both issue the same `ParticipantTokenPayload` shape as the shared-team-password flow used by every other project — the rest of the app (forms, uploads, gallery, route guards) can't tell the two auth modes apart.

### `form_submissions` table (D1, `AUTH_DB`)

Populated by `POST /form-submit` for all projects — D1 is the primary store. Additionally, `democrats_abroad` optionally forwards to the Google Apps Script at `FORM_SCRIPT_URL` when that secret is configured (best-effort, non-blocking — `console.warn` on failure). Project is always taken from the participant's auth token, never from the request body.

```sql
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
```

**`location_id` is per-route, not global.** `form_submissions.location_id` is the 1-based ordinal position of that location among location-type entries in whichever route the team was on (`locationOrdinalAt()`, `src/utils/routeEntries.ts`), set client-side by `RoutePage`. The same number means different locations in different routes — resolving a submission to a physical location requires looking up `(route_id, location_id)` together against that route's location list, never `location_id` alone. `src/utils/resultsRouteIndex.ts` builds this per-route index from a city's `routes.yaml` and location YAML.

### `consent_records` table (D1, `AUTH_DB`) — GDPR consent & photo-promotion

Populated by `POST /consent` (the `consent` template-type screen, and the `☰` menu's "Photo permissions" withdrawal submenu). One row per participant identity, upserted rather than appended:

```sql
CREATE TABLE consent_records (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  team_name         TEXT NOT NULL,
  contact           TEXT NOT NULL DEFAULT '',  -- '' sentinel, never NULL — see below
  all_sixteen_plus  INTEGER NOT NULL,
  promo_consent     INTEGER NOT NULL,          -- server-forced 0 when all_sixteen_plus = 0
  promo_approved    INTEGER NOT NULL DEFAULT 0, -- human-set only, via PromoReviewPage
  consent_version   INTEGER NOT NULL,
  acknowledged_at   INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  UNIQUE (project_id, team_name, contact)
);
```

**Identity key is `(project_id, team_name, contact)`, matching `form_submissions`'s scoping — not a new participant-ID concept.** For shared-team-password projects `contact` is usually absent, making consent effectively team-level (the age question is phrased "is everyone in *your team*..."). For individual-login projects (`participant_accounts`), `contact` defaults to the account's own email at signup and is carried on every login, so it's always populated and distinct per person even if two people share a `team_name`.

**`contact` is `NOT NULL DEFAULT ''`, deliberately not nullable like `form_submissions.contact`.** SQLite's `UNIQUE` constraint treats every `NULL` as distinct from every other `NULL`, so a nullable `contact` would silently defeat "update, don't duplicate" for every shared-team-password project (where `contact` is normally absent) — exactly the common case. `db.ts`'s `upsertConsent()`/`getConsent()`/`setPromoApproved()`/`listPromoReviewPhotos()` always pass `""` rather than `null` for this column.

**Consent text versioning is KV-based, not YAML-based.** There's no live CMS — YAML is compiled into the client bundle at build time — so the "current" `consentVersion` an organiser can bump without a full content PR/redeploy is stored in the existing `AUTH_STORE` KV namespace, key `` `consent-version:${project}:${city}:${route}` ``, managed via `wrangler kv key put` (no admin UI, same precedent as `participant_whitelist`). Missing key defaults to `1`. `src/worker/consentVersion.ts`'s `getConsentVersion()` is the only reader; `POST /consent` (with `acknowledge: true`, i.e. the actual consent screen submitting) always stamps this value server-side — the client never supplies `consentVersion`. The same route with `acknowledge: false` (the withdrawal menu just toggling `promo_consent`) preserves the existing row's version instead of re-stamping it.

**`promo_approved`** is a human review gate independent of participant consent — required before any photo is used promotionally, regardless of what was ticked. Only settable via `POST /promo-approve` (organizer-only, `src/pages/editor/PromoReviewPage.svelte`, route `/editor/:project/:city/promo-review`), never through the participant-facing `POST /consent`. It gates per-team (approving one of a team's photos approves the whole team's future promotional use, matching the field's grain — see the design spec's §11 for the deferred, more granular per-photo version).

**R2 image variants.** Each photo is stored as three capped JPEG variants under a shared key prefix, generated in the Worker via `@cf-wasm/photon` (WASM, no native bindings) since Cloudflare's URL-based Image Resizing isn't available on the current plan:

| Variant | Cap | Purpose |
|---|---|---|
| `thumb` | 300px long edge, quality 0.75 | Hero rotation, gallery grid |
| `medium` | 1200px long edge, quality 0.8 | Lightbox preview |
| `full` | 2048px long edge, quality 0.85 | Download button — **not** the raw uploaded file; always re-encoded and capped so per-photo storage is bounded regardless of source camera resolution |

EXIF orientation is corrected during this same resize step (`src/worker/imageProcessing.ts`), since Photon's resize/re-encode does not preserve EXIF and would otherwise produce sideways thumbnails.

## Consent & Photo-Promotion Review

Authoring guidance for a route's `NNN_consent_*.yaml` file (referenced from the template-types
table above):

- **Name the specific uses in the checkbox label.** The label is the permission scope a
  participant is actually agreeing to — avoid open-ended phrasing like "and other purposes"; it
  weakens consent specificity and adds nothing beyond the uses already named.
- **The fold (`whyWereAsking`) is for context, the checkbox label is for scope.** Don't move a
  scope fact (what the photos/videos will be used for) into the fold to shorten the label — a
  participant must be able to read the full scope without expanding anything.
- **Bump the consent version via KV, not YAML**, on any material change to the permission scope:
  `wrangler kv key put consent-version:<project>:<city>:<route> <n>`. This is deliberate — see the
  `consent_records` section above for why version bumps stay out of the YAML/build pipeline.
  Participants who agreed to the old scope have not agreed to the new one and must be re-prompted,
  never silently migrated.
- **Minimum age (`minimumAge`) and photo/video permission content are both required per-route
  fields** — the schema (`consent.schema.json`) enforces their presence, but pick a real value
  deliberately; don't copy a number from another city's jurisdiction without checking it.
- **Omit `safety`/`photos` to inherit the platform defaults** in
  `src/data/text/en/consent_defaults.yaml`. To add one route-specific line (a canal towpath, a
  long stair climb) on top of the defaults, copy the default items into the route's own file and
  append the extra one — there's no partial-merge mechanism, a route that sets `safety`/`photos`
  at all replaces the section wholesale.

Photo-promotion consent itself (`promo_consent`, `all_sixteen_plus`) is participant-facing; a
separate **organizer-only** human review gate (`promo_approved`, set only via `POST
/promo-approve`, `src/pages/editor/PromoReviewPage.svelte` at
`/editor/:project/:city/promo-review`) must also be satisfied before any photo is used
promotionally, regardless of what a participant ticked.

## Theme System

Three theme presets defined in `themes.ts`: `wireframe`, `app`, `GWC` (Democrats Abroad branding — DA navy `#002868` / flag red `#BF0A30`).

- **themeStore** holds the active token object (`background`, `surface`, `border`, `text`, `accent`, bar/progress/clue sub-tokens, `search*`/`intro*`/`sheenImage` tokens for `SearchPlane`/`DepthWordmark`, and the `intro: { motion, sheen }` behavior value); components subscribe via `$themeStore`.
- **titleBarStore** holds `{ title, progress, backPath }` for the persistent `TitleBar` component.
- `App.svelte` syncs the active theme's tokens to CSS custom properties on `<html>` via a `$effect` on every theme change.
- The `TitleBar` includes a style-switcher (☰) to toggle between themes at runtime.
- `wireframe`'s `intro.motion` is `'static'` (a single frozen `SearchPlane` tree) and `intro.sheen` is `false`; `app` and `GWC` both animate (`'search'`), but only `app` has the wordmark sheen — a shimmering title would contradict `wireframe`'s low-fi purpose and `GWC`'s civic-brand tone.

## Image Handling

Images are not bundled — they are served as static files at `/assets/img/<filename>`:

- **Dev:** a Vite plugin serves `src/data/img/` at `/assets/img/`.
- **Prod:** a Vite plugin copies `src/data/img/` → `dist/client/assets/img/` at build time.

`AssetManager.fetchImage(filename)` fetches the URL, converts it to a blob URL, and caches it in memory. Components call this inside `$effect` blocks and store the result in `$state`.

## API Layer

All client-side HTTP calls go through `src/utils/api.ts`. No component or store calls `fetch()` directly.

Functions are grouped by domain:

| Group | Functions |
|-------|-----------|
| Challenge | `postFormSubmit(payload)` → `POST /form-submit` (routes to Google Sheet for `democrats_abroad`, D1 `form_submissions` for every other project); `postPhotoUpload(payload)` → `POST /upload` |
| Editor | `fetchEditorLocations(project, city)`, `fetchEditorLocation(project, city, file)`, `saveEditorLocation(payload)`, `fetchPrStatuses(numbers[])` |
| Auth | `fetchAuthMe()`, `postLogin(payload)` (contact optional), `postLogout()`, `postVerifyCode(code)` → resolves a typed code to project or `demo` via `AUTH_STORE.list()` |
| Gallery | `fetchGalleryPhotos(project, city, filters?)` → `GET /gallery/:project/:city/photos`; `fetchRandomPhotos(project, city)` → `GET /gallery/:project/:city/photos/random`; photo bytes served via `GET /photos/:id/:variant` |
| Results | `fetchResultsSubmissions(project, city)` → `GET /results/:project/:city/submissions`, same participant-scoped auth as Gallery |
| Consent | `postConsentUpdate(city, route, {allSixteenPlus, promoConsent, acknowledge})` → `POST /consent`; `fetchConsent()` → `GET /consent`; `fetchConsentVersion(project, city, route)` → `GET /consent/version` (public, no auth) |
| Promo review (editor) | `fetchPromoReviewPhotos(project, city)` → `GET /promo-review`; `postPromoApprove(project, teamName, contact)` → `POST /promo-approve` — both organizer-capability gated |

Each function wraps a single endpoint, handles the request shape, and returns a typed response. Tests mock the function directly rather than mocking `globalThis.fetch`.

## Unified Form System

`AppForm.svelte` is the single generic form component. It receives a `FormField[]` array and an `onSubmit` callback; it never calls any endpoint directly.

**Props:**
- `fields: FormField[]` — field definitions (from YAML or passed inline)
- `initialValues?: Record<string, unknown>` — pre-populated values for edit mode
- `onSubmit: (values) => Promise<void>` — called with nested output after validation
- `onPhotoUpload?: (file) => Promise<{ ok: boolean }>` — injected photo upload handler
- `onSuccess?: () => void` — called after `onSubmit` resolves without error
- `confirmMessage?: string` — if set, shows a confirm dialog before calling `onSubmit`
- `submitLabel?: string` — button label (default: `"Submit"`)

**Dotted-path IDs:** A field with `id: "coordinates.latitude"` writes into `{ coordinates: { latitude: value } }` in the value passed to `onSubmit`. `flattenValues()` provides the reverse (for seeding `initialValues` from a loaded nested object).

**Field types:** `boolean`, `string`, `number`, `radio`, `multiple`, `photo`, `textarea`, `section`

- `textarea` — long text, renders `<textarea>`
- `section` — pseudo-field, renders a section heading, produces no value

**Consumer pattern:**

| Component | Role |
|-----------|------|
| `ChallengeForm` | Thin wrapper: adds flag dividers, success state; provides `onSubmit` (calls `postFormSubmit`), `onPhotoUpload` (calls `postPhotoUpload`), and `confirmMessage` |
| `EditorLocationForm` | Data-driven wrapper: loads field list from `src/data/text/en/editor/location_form.yaml` via `loadText()`; flattens loaded location data into `initialValues`; `onSubmit` rebuilds nested object, parses coordinates, calls `saveEditorLocation()` |

**Editor form YAML:** `src/data/text/en/editor/location_form.yaml` defines all fields for the location editor. Adding or reordering editor fields requires only editing this file — no TypeScript changes.

**Completion badge.** `ChallengeCard`'s numbered badge shows a small status overlay when `form_required` gating is in effect: a green checkmark once that location's form has been submitted, or a grey dash if the user skipped it via the toast's Skip button (see `project.can_forms_skip` above). The badge's own background color remains the per-location `themeColor`/theme accent — the overlay is a separate small circle, not a recoloring of the badge itself.

## YAML Data Validation

Location and form YAML files are validated at three layers to prevent invalid data from reaching users.

### JSON Schemas

Two schemas live in `src/data/schemas/`:

| Schema | Applies to | Key constraints |
|--------|------------|-----------------|
| `location.schema.json` | `*_loc_*.yaml` | `additionalProperties: false` at root and inside `challenge`; `challenge.form` must be a `string` (filename reference) if present |
| `form.schema.json` | `*_form_*.yaml` | Array of field objects; each field has `additionalProperties: false`; `type` is an enum of the eight supported field types |
| `checkpoint.schema.json` | `*_chck_*.yaml` | `additionalProperties: false`; requires `template-type: checkpoint`, `gate` object with `require` (requirement array), `re-entry` (gate definition for re-crossing), `skippable` (boolean); each requirement supports `type: forms` or `type: period` |

**Why `challenge.form` must be a string:** form data is kept in separate `*_form_*.yaml` files and referenced by filename. Inline arrays in the `challenge.form` field are a data-authoring error.

### Layer 1 — IDE (VS Code)

`.vscode/settings.json` wires the schemas to the file globs via the `redhat.vscode-yaml` extension. Unknown keys, wrong types, and missing required fields appear as red squiggles while editing.

### Layer 2 — Runtime sentinel

`loadLocations.ts` checks the resolved `challenge.form` value after loading. If it is an array (i.e. the form reference was never migrated), the array is replaced with a single sentinel field `{ id: "form", type: "inline_form" }`. `AppForm.svelte` renders any field with an unrecognised `type` as `unrecognized field '${id}'`, so the problem is visible on the location page rather than silently missing.

### Layer 3 — CI (`npm run validate:yaml`)

`scripts/validate-yaml.js` finds all `*_loc_*.yaml`, `*_form_*.yaml`, and `*_chck_*.yaml` files under `src/data/text/en/projects/`, parses each with `js-yaml`, and validates against the appropriate JSON schema using `ajv`. Errors are written to stderr in the form:

```
ERROR: src/data/.../001_loc_binnenhof.yaml: /challenge: must NOT have additional properties ('for')
ERROR: src/data/.../001_form_binnenhof.yaml: /3: must NOT have additional properties ('voodoo')
```

The script exits 1 on any violation. It runs as a CI step (`.github/workflows/ci.yml`) before typecheck, so bad data blocks the pipeline.

## Key Design Decisions

**YAML data files.** All content lives in `src/data/text/en/` as YAML, bundled by `@modyfi/vite-plugin-yaml`. Adding a new city = new directory + YAML files; no code changes needed. Location files are named `NNN_loc_<slug>.yaml`, checkpoint files `NNN_chck_<slug>.yaml`, and all are listed in `routes.yaml`.

**Multi-project, multi-city, multi-route.** The URL structure (`/:project/:city/:route`) and data hierarchy support running the same app for multiple organisations, cities, and named routes simultaneously.

**CSS custom properties for theming.** No CSS modules, no Tailwind. Each component and page has a co-located `.css` file. Colours are expressed as `var(--color-*)` CSS custom properties. The token set is defined in `src/styles/tokens.css`; `App.svelte` syncs the active JS theme object onto `<html>` as CSS custom properties on every theme change via a `$effect`. Global resets and `@keyframes` live in `src/styles/global.css`. Inline styles are reserved for values that are unavoidably dynamic (computed pixel offsets, runtime-state-driven widths, per-record colour values from data).

**Cloudflare Workers deployment.** The app runs as a Cloudflare Worker serving static assets. `npm run preview` builds and runs locally via `wrangler dev`. `npm run deploy` pushes to Cloudflare.

**Data loading utilities.** `loadText(lang, path)` loads `src/data/text/{lang}/{path}.yaml`. `loadLocations(lang, locationPaths)` loads each location YAML in parallel. Components call these inside `$effect` blocks and write results into `$state` variables.
