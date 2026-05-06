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
    AppPage.svelte      — Home: lists available projects
    ProjectPage.svelte  — City picker for a chosen project
    CityPage.svelte     — Route picker for a chosen city
    RoutePage.svelte    — Swipe-based challenge flow
    editor/             — Editor pages (admin)
  components/
    TitleBar.svelte     — Persistent top bar (back, title, progress, theme switcher)
    ChallengeCard.svelte — Card for one location (storyline, breadcrumb, challenge)
    ChallengeForm.svelte — Inline form embedded inside a ChallengeCard
    CitySelector.svelte — City card used in ProjectPage
    RouteSelector.svelte — Route card used in CityPage
    MarkdownText.svelte — Renders markdown via marked
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
| `/`                      | `AppPage`     | Lists projects from `projects/projects.yaml`        |
| `/:project`              | `ProjectPage` | City picker; loads `projects/<project>/cities.yaml` |
| `/:project/:city`        | `CityPage`    | Route picker; loads `<city>/routes.yaml`            |
| `/:project/:city/:route` | `RoutePage`   | Swipe-based challenge flow; loads location YAMLs    |

**RoutePage states:** loading → location cards rendered as a swipeable stack. Swipe left advances, swipe right retreats. Current index is persisted to `localStorage` keyed by project/city/route so reload resumes position.

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
coordinates:
  longitude: 4.3133
  latitude: 52.0799
storyline: |
  Narrative context shown on the card.
breadcrumb: |
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

Supported form field types: `boolean`, `string`, `number`, `radio`.

Reference: `src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml` is the canonical complete example.

## Theme System

Three theme presets defined in `themes.ts`: `wireframe`, `app`, `GWC` (Democrats Abroad branding — DA navy `#002868` / flag red `#BF0A30`).

- **themeStore** holds the active token object (`background`, `surface`, `border`, `text`, `accent`, bar/progress/clue sub-tokens); components subscribe via `$themeStore`.
- **titleBarStore** holds `{ title, progress, backPath }` for the persistent `TitleBar` component.
- `App.svelte` syncs the active theme's tokens to CSS custom properties on `<html>` via a `$effect` on every theme change.
- The `TitleBar` includes a style-switcher (☰) to toggle between themes at runtime.

## Image Handling

Images are not bundled — they are served as static files at `/assets/img/<filename>`:

- **Dev:** a Vite plugin serves `src/data/img/` at `/assets/img/`.
- **Prod:** a Vite plugin copies `src/data/img/` → `dist/client/assets/img/` at build time.

`AssetManager.fetchImage(filename)` fetches the URL, converts it to a blob URL, and caches it in memory. Components call this inside `$effect` blocks and store the result in `$state`.

## Key Design Decisions

**YAML data files.** All content lives in `src/data/text/en/` as YAML, bundled by `@modyfi/vite-plugin-yaml`. Adding a new city = new directory + YAML files; no code changes needed. Location files are named `NNN_loc_<slug>.yaml` and listed in `routes.yaml`.

**Multi-project, multi-city, multi-route.** The URL structure (`/:project/:city/:route`) and data hierarchy support running the same app for multiple organisations, cities, and named routes simultaneously.

**CSS custom properties for theming.** No CSS modules, no Tailwind. Each component and page has a co-located `.css` file. Colours are expressed as `var(--color-*)` CSS custom properties. The token set is defined in `src/styles/tokens.css`; `App.svelte` syncs the active JS theme object onto `<html>` as CSS custom properties on every theme change via a `$effect`. Global resets and `@keyframes` live in `src/styles/global.css`. Inline styles are reserved for values that are unavoidably dynamic (computed pixel offsets, runtime-state-driven widths, per-record colour values from data).

**Cloudflare Workers deployment.** The app runs as a Cloudflare Worker serving static assets. `npm run preview` builds and runs locally via `wrangler dev`. `npm run deploy` pushes to Cloudflare.

**Data loading utilities.** `loadText(lang, path)` loads `src/data/text/{lang}/{path}.yaml`. `loadLocations(lang, locationPaths)` loads each location YAML in parallel. Components call these inside `$effect` blocks and write results into `$state` variables.
