# Theming & Title Bar — Design Spec

**Date:** 2026-04-29  
**Status:** Approved

## Overview

Add a persistent title bar and a runtime-switchable theme system to the Freedom Hunt app. Themes are preset style token objects; the active theme is set by project config and can be overridden by the user at runtime via a menu in the title bar.

---

## Goals

- Three visual styles: `wireframe`, `app`, `GWC`
- Architecture extensible for light/dark variants per style (not implemented now)
- Project JSON declares its default style; no code change needed to add a new project with a different style
- Users can switch styles at runtime via the title bar menu
- A persistent title bar shows context (title + progress + back navigation) across all pages

---

## Design Decisions

| Decision                | Choice                       | Reason                                                                         |
| ----------------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| Theme system            | React Context (dual context) | Matches inline-style convention; TitleBar mounts once without re-mount flicker |
| Style switcher location | Title bar ☰ menu            | Always accessible; doesn't eat screen space                                    |
| Default style fallback  | `"app"`                      | Wireframe is too bare for real use; app is the neutral production default      |
| Style default source    | Project JSON `style` field   | Consistent with existing data-driven philosophy                                |
| Light/dark              | Not implemented              | Architecture supports it (add variant tokens to each preset later)             |

---

## Section 1 — Data Model

Add a `style` field to each project-level JSON file:

```
src/data/text/en/projects/democrats_abroad/democrats_abroad.json
```

```json
{
  "style": "GWC",
  ...existing fields...
}
```

Valid values: `"wireframe"` | `"app"` | `"GWC"`.  
When the field is absent, the app falls back to `"app"`.  
No other JSON files change — style is set once at the project level and applies to all cities and routes beneath it.

---

## Section 2 — Theme System

### `src/theme/themes.js`

Three named theme preset objects. Each is a flat map of design tokens:

| Token              | Purpose                                      |
| ------------------ | -------------------------------------------- |
| `background`       | Page background color                        |
| `surface`          | Card / section background                    |
| `border`           | Divider and border color                     |
| `text`             | Primary body text                            |
| `textSecondary`    | Secondary / description text                 |
| `textMuted`        | Labels, meta text                            |
| `accent`           | Highlight color (progress fill, label color) |
| `barBackground`    | Title bar background                         |
| `barBorder`        | Title bar bottom border                      |
| `barText`          | Title bar primary text                       |
| `barTextSecondary` | Title bar secondary text (back label)        |
| `progressTrack`    | Progress bar track background                |
| `progressFill`     | Progress bar fill                            |
| `clueBackground`   | Clue section background tint                 |
| `clueBorderColor`  | Clue section left border color               |

Style directions (exact hex values determined during implementation):

- **wireframe** — white background, neutral grays, system fonts, no color accents
- **app** — dark navy background, amber accents, serif headings, adventurous feel
- **GWC** — white background, DA navy (#002868) headings, flag red (#BF0A30) accents, clean and institutional (ref democrats_abroad)

### `src/theme/ThemeContext.jsx`

Exports:

- `ThemeProvider` — wraps the app; initial `themeName` is `"app"`
- `useTheme()` — returns `{ theme, themeName, setThemeName }`
  - `theme` is the full resolved token object for the current `themeName`
  - `setThemeName(name)` switches the active theme

---

## Section 3 — Title Bar System

### `src/theme/TitleBarContext.jsx`

Exports:

- `TitleBarProvider` — wraps the app; default state: `{ title: 'Freedom Hunt', progress: null, backPath: null }`
- `useTitleBar(config?)` — when called with a config object, sets the title bar state in a `useEffect`; when called with no argument, returns `{ titleBar, setTitleBar }` for direct reads/writes

`titleBar` shape:

```js
{
  title: string,
  progress: { current: number, total: number } | null,
  backPath: string | null,
}
```

### `src/components/TitleBar.jsx`

Reads from both `ThemeContext` and `TitleBarContext`. Layout (top to bottom):

**Main row:**

- Left: `←` back button if `backPath` is set, calls `navigate(backPath)`
- Center-left: `title` text
- Right: `☰` icon that toggles a style-switcher overlay

**Progress row** (rendered only when `progress` is non-null):

- A filled bar proportional to `current / total`
- Styled with `theme.progressTrack` and `theme.progressFill`

**Style-switcher overlay:**

- Lists the three style names
- Clicking one calls `setThemeName(name)`
- Closes on selection or outside click

`TitleBar` is rendered once in `App.jsx`, above the `<Routes>` block.

---

## Section 4 — Page Integration

### `useTitleBar` call per page

| Page        | title                  | progress                      | backPath              |
| ----------- | ---------------------- | ----------------------------- | --------------------- |
| AppPage     | `'Freedom Hunt'`       | null                          | null                  |
| ProjectPage | project name from JSON | null                          | `'/'`                 |
| CityPage    | city name from JSON    | null                          | `/${project}`         |
| RoutePage   | route name from JSON   | `{ current: index+1, total }` | `/${project}/${city}` |

RoutePage updates progress as `currentIndex` changes — added to the existing `useEffect` that writes to `localStorage`.

### Theme application in pages

Each page:

1. Calls `useTheme()` to get the current token object
2. Replaces all hardcoded color values with theme tokens on the root `div` and child elements
3. Adds `background: theme.background` to the root `div` so the theme color fills the full screen (alongside the existing `<style>` reset tag)

### Theme switching on project entry

`ProjectPage` calls `setThemeName(projectData.style ?? 'app')` in a `useEffect` once project data loads. `AppPage` calls `setThemeName('app')` unconditionally on mount, so navigating back to the home screen always resets the theme.

---

## File Checklist

New files:

- `src/theme/themes.js`
- `src/theme/ThemeContext.jsx`
- `src/theme/TitleBarContext.jsx`
- `src/components/TitleBar.jsx`

Modified files:

- `src/App.jsx` — add providers, render `TitleBar`
- `src/pages/AppPage.jsx` — add `useTheme`, `useTitleBar`
- `src/pages/ProjectPage.jsx` — add `useTheme`, `useTitleBar`, `setThemeName`
- `src/pages/CityPage.jsx` — add `useTheme`, `useTitleBar`
- `src/pages/RoutePage.jsx` — add `useTheme`, `useTitleBar` with progress
- `src/components/ChallengeCard.jsx` — call `useTheme()` directly and apply tokens (no prop threading needed)
- `src/data/text/en/projects/democrats_abroad/democrats_abroad.json` — add `style` field

---

## Out of Scope

- Light/dark mode variants (architecture supports it; not implemented now)
- Per-city or per-route style overrides (project-level only)
- Animated theme transitions
- Persisting the user's style override to localStorage (nice-to-have, not required)
