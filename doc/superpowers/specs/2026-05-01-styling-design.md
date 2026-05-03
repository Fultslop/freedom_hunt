# Styling Refactor — Inline Styles → Plain CSS + CSS Custom Properties

**Date:** 01/05/2026
**Status:** Approved

## Overview

Migrate all inline styles in JSX components to className-based CSS, using CSS custom properties (variables) for theming. The goal is to reduce JSX verbosity, enable project-wide style changes via a single stylesheet, and fix hardcoded color values that bypass the theme system.

## Tech Choice

**Approach B1 — Global stylesheet + dynamic `:root` class**

- `ThemeContext` stays as-is (provides a JS `theme` object)
- A `useCssVars()` hook syncs `theme.*` values to `--color-*` CSS custom properties on `:root`
- Each theme (wireframe, app, GWC) gets its own `:root[data-theme="name"]` block in `tokens.css`
- `ThemeContext` sets `document.documentElement.dataset.theme = themeName` on theme change
- Components use `className` + CSS variables instead of `style={{...}}` props
- No build config changes, no new dependencies

## File Structure

```
src/
  styles/
    tokens.css      — CSS custom properties for all theme tokens (one :root per theme)
    global.css      — global resets, keyframes, shared utility classes
  components/
    TitleBar.css
    ChallengeCard.css
    ChallengeForm.css
    CitySelector.css
    RouteSelector.css
  pages/
    AppPage.css
    ProjectPage.css
    CityPage.css
    RoutePage.css
    LoginPage.css
```

## Token Mapping

| JS theme key             | CSS custom property          |
| ------------------------ | ---------------------------- |
| `theme.surface`          | `--color-surface`            |
| `theme.accent`           | `--color-accent`             |
| `theme.border`           | `--color-border`             |
| `theme.text`             | `--color-text`               |
| `theme.textSecondary`    | `--color-text-secondary`     |
| `theme.textMuted`        | `--color-text-muted`         |
| `theme.background`       | `--color-background`         |
| `theme.barBackground`    | `--color-bar-background`     |
| `theme.barBorder`        | `--color-bar-border`         |
| `theme.barText`          | `--color-bar-text`           |
| `theme.barTextSecondary` | `--color-bar-text-secondary` |

Hardcoded colors being fixed:

- `#BF0A30` → `--color-error` (used in ChallengeForm for error states)
- `#2d7a2d` → `--color-success` (used in ChallengeForm for success states)
- `#002868` → already covered by theme tokens in some contexts, hardcoded in others → `--color-accent` or theme token
- `#ddd`, `#666`, `#888`, `#aaa` (CitySelector/RouteSelector) → theme tokens or `--color-border` equivalents

## tokens.css Structure

```css
:root {
  /* Default / fallback values (wireframe theme) */
  --color-surface: #ffffff;
  --color-accent: #002868;
  --color-border: #e5e7eb;
  --color-text: #111111;
  --color-text-secondary: #6b7280;
  --color-text-muted: #9ca3af;
  --color-background: #f9fafb;
  --color-bar-background: #ffffff;
  --color-bar-border: #e5e7eb;
  --color-bar-text: #111111;
  --color-bar-text-secondary: #6b7280;
  --color-error: #bf0a30;
  --color-success: #2d7a2d;
}

:root[data-theme="app"] {
  --color-surface: #ffffff;
  --color-accent: #002868;
  --color-border: #e5e7eb;
  --color-text: #111111;
  --color-text-secondary: #6b7280;
  --color-text-muted: #9ca3af;
  --color-background: #f9fafb;
  --color-bar-background: #ffffff;
  --color-bar-border: #e5e7eb;
  --color-bar-text: #111111;
  --color-bar-text-secondary: #6b7280;
}

:root[data-theme="GWC"] {
  /* GWC theme values — populated from themes.js */
}
```

## global.css Contents

- `html, body, #root { margin: 0; padding: 0; }`
- `@keyframes fadeInUp` (from ChallengeCard)
- `@keyframes slideInFromRight` (from RoutePage)
- `@keyframes slideInFromLeft` (from RoutePage)

## useCssVars Hook

```js
// src/hooks/useCssVars.js
import { useEffect } from "react";
import { useTheme } from "../theme/ThemeContext";

export function useCssVars() {
  const { theme, themeName } = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = themeName;
    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  }, [theme, themeName]);
}
```

Called once in `App.jsx` to activate global CSS variable sync.

## Migration Order

1. Create `src/styles/tokens.css` with all theme variable definitions
2. Create `src/styles/global.css` with resets and keyframes
3. Add `useCssVars()` hook and wire into `App.jsx`
4. Migrate pages (remove `<style>` reset tags, apply class names):
   - AppPage → AppPage.css
   - ProjectPage → ProjectPage.css
   - CityPage → CityPage.css
   - RoutePage → RoutePage.css
   - LoginPage → LoginPage.css
5. Migrate components:
   - TitleBar → TitleBar.css
   - ChallengeCard → ChallengeCard.css
   - ChallengeForm → ChallengeForm.css (also fix hardcoded error/success colors)
   - CitySelector → CitySelector.css (also fix hardcoded colors)
   - RouteSelector → RouteSelector.css (also fix hardcoded colors)
6. MarkdownText: pass-through style prop is fine, no changes needed

## Hardcoded Color Fixes

| File          | Before                                                                          | After                                                                |
| ------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| ChallengeForm | `#BF0A30` (error), `#2d7a2d` (success), `#002868` (submit btn), `#333` (labels) | `--color-error`, `--color-success`, `--color-accent`, `--color-text` |
| CitySelector  | `#ddd`, `#666`, `#888`, `#aaa`                                                  | `--color-border`, `--color-text-secondary`, `--color-text-muted`     |
| RouteSelector | `#ddd`, `#666`, `#aaa`                                                          | `--color-border`, `--color-text-secondary`, `--color-text-muted`     |

## Testing Notes

- Components can use both `style` and `className` during migration — no big bang rewrite
- Tests using `data-testid` are unaffected
- Any test asserting on computed style values may need updating
- Visual smoke test recommended after each component migration
