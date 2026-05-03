# Freedom Hunt — Refactor Design Spec

**Date:** 2026-04-28  
**Status:** Approved

## Overview

A complete blank-slate rebuild of the Freedom Hunt app on the same tech stack (React 19, Vite, React Router v7, JSX, inline styles). The current implementation is discarded entirely — no content migration. The rebuild introduces a deeper navigation hierarchy, full data/i18n separation, and a swipe-based mobile-first challenge flow.

---

## 1. Routing & Page Structure

Four screens, four URL levels. Browser navigation handles selection; swiping handles challenge progression within a route.

| Screen       | URL                      | Purpose                                                    |
| ------------ | ------------------------ | ---------------------------------------------------------- |
| App home     | `/`                      | Lists available projects — simple orientation              |
| Project page | `/:project`              | Lists cities for the selected project — simple orientation |
| City page    | `/:project/:city`        | Lists available routes for the city                        |
| Route page   | `/:project/:city/:route` | Full swipe-based challenge flow                            |

The challenge index within a route is **not** a URL segment. It lives in React state, persisted to `localStorage` so reload returns the participant to their last stop. Browser back/forward navigates between selection screens, not between individual challenges.

---

## 2. Data Structure

All content lives under `src/data/`. Text is separated by language; images mirror the text structure. Keeping data under `src/` is required for Vite's dynamic `import()` to resolve files at build time.

```
src/data/
  text/
    en/
      application.json
      projects/
        projects.json
        democrats_abroad/
          democrats_abroad.json
          cities.json
          den_haag/
            den_haag.json
            routes.json
            001_loc_binnenhof.json
            002_loc_peace_palace.json
            ...
          madrid/
            ...
          berlin/
            ...
          amsterdam/
            ...
  images/
    democrats_abroad/
      den_haag/
        ...
```

Adding a new language means adding a parallel `text/{lang}/` tree with the same file structure and translated values. No code changes required.

### File shapes

**`application.json`** — app-level UI strings:

```json
{
  "app.title": "Scavenger Hunt",
  "app.subtitle": "..."
}
```

**`routes.json`** — named routes, each an ordered list of location file IDs:

```json
{
  "short_walk": {
    "description": "A 2-hour introduction, 5 stops",
    "locations": ["001_loc_binnenhof", "003_loc_ridderzaal"]
  },
  "full_route": {
    "description": "The complete hunt, ~4 hours",
    "locations": [
      "001_loc_binnenhof",
      "002_loc_peace_palace",
      "003_loc_ridderzaal"
    ]
  }
}
```

Routes can be organized by duration/distance or by theme — the structure supports both equally.

**`{id}_loc_{name}.json`** — a single location/challenge:

```json
{
  "title": "Binnenhof",
  "description": "...",
  "location": { "lat": 52.0799, "long": 4.3133 },
  "clue": "...",
  "challenge": "..."
}
```

All values are plain strings in the English bundle. The file path (`text/en/...`) encodes the language. Data structures are intentionally kept minimal — fields will evolve as the product matures.

---

## 3. i18n Layer

A lightweight custom i18n implementation — no external library.

**`src/i18n/LanguageContext.jsx`**  
React context providing `currentLang` (defaults to `"en"`) and `setLang`. Wrap the app at the root level.

**`src/hooks/useText.js`**  
Takes a logical path string (e.g. `"democrats_abroad/den_haag/001_loc_binnenhof"`) and dynamically imports `src/data/text/${currentLang}/${path}.json` via Vite's `import()`. Returns the dictionary object and a loading flag.

Components access text directly off the returned object: `text.title`, `text.clue`, etc.

For v1, `currentLang` is always `"en"` and never changes. The hook is fully localization-ready — adding Dutch requires only adding a `text/nl/` tree and a language switcher that calls `setLang("nl")`.

---

## 4. Component Structure

```
src/
  pages/
    AppPage.jsx           # / — project list
    ProjectPage.jsx       # /:project — city list
    CityPage.jsx          # /:project/:city — route list
    RoutePage.jsx         # /:project/:city/:route — swipe challenge flow
  components/
    ChallengeCard.jsx     # single challenge screen rendered inside RoutePage
    RouteSelector.jsx     # route picker card used by CityPage
    CitySelector.jsx      # city picker card used by ProjectPage
  i18n/
    LanguageContext.jsx
  hooks/
    useText.js
  App.jsx
  main.jsx
  data/
    text/
      en/
        ...
    images/
      ...
```

**AppPage and ProjectPage** are intentionally minimal — they communicate purpose and let the user select where to go. No complex UI.

**CityPage** loads `routes.json` for the selected city and renders a list of `RouteSelector` cards.

**RoutePage** is the core experience:

- Loads all location JSON files for the active route up front (files are small)
- Renders one `ChallengeCard` at a time based on `currentIndex`
- Swipe left/right (or prev/next buttons as fallback) advances the index
- `currentIndex` is written to `localStorage` keyed by `${project}/${city}/${route}` on every change

**ChallengeCard** receives a single location's text object and renders it. Stateless.

---

## 5. Swipe Mechanic

Implemented directly in `RoutePage` — no swipe library. A simple CSS transform/transition on the card container driven by touch events (`onTouchStart`, `onTouchEnd`). Threshold of ~60px horizontal swipe triggers index advance or retreat. Previous/next buttons provide an accessible fallback.

---

## 6. Styling

Inline styles throughout, matching existing conventions. Each page component injects a `<style>` tag for `html, body, #root` resets. Style is intentionally neutral and functional — visual redesign will follow separately via Claude Design once wireframes are ready.

Mobile-first. All layouts assume a phone viewport; wider screens get centred single-column content.

---

## 7. State Management

No global state manager. Each page component loads what it needs via `useText`. Data flows down to children as props. The only persisted state is challenge progress in `localStorage`.

---

## 8. Out of Scope (v1)

- Visual design polish
- Actual multi-language content (structure and code are ready; only `en` is populated)
- User accounts, scoring, or progress syncing across devices
- Map view for challenge locations
- Offline/PWA capability (existing intent, not part of this refactor)
