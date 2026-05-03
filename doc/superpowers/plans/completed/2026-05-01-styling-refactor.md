# Styling Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all inline styles in JSX components to className-based CSS using CSS custom properties for theming, eliminating hardcoded colour values and per-page `<style>` reset tags.

**Architecture:** A global `tokens.css` file declares CSS custom properties for all theme tokens under `:root` and per-theme `data-theme` selectors. A `useCssVars()` hook (called once in `App.jsx`) syncs the active JS theme object to those custom properties at runtime. Components and pages import co-located `.css` files and use `className` + `var(--color-*)` instead of `style={{...}}` props. Truly dynamic values (computed pixel offsets, per-location colours from data) stay as inline styles.

**Tech Stack:** React 19, Vite 8, plain CSS (no modules, no Tailwind), existing `ThemeContext` unchanged.

**Spec:** `doc/superpowers/specs/2026-05-01-styling-design.md`

---

## File Map

### New files

- `src/styles/tokens.css` — all 15 CSS custom properties, one `:root` block per theme
- `src/styles/global.css` — html/body/root reset + all `@keyframes`
- `src/hooks/useCssVars.js` — syncs JS theme object → `--color-*` vars on `:root`
- `src/components/CitySelector.css`
- `src/components/RouteSelector.css`
- `src/components/ChallengeForm.css`
- `src/components/TitleBar.css`
- `src/components/ChallengeCard.css`
- `src/pages/AppPage.css`
- `src/pages/ProjectPage.css`
- `src/pages/CityPage.css`
- `src/pages/RoutePage.css`
- `src/pages/LoginPage.css`

### Modified files

- `src/App.jsx` — import `global.css`, call `useCssVars()` inside `ThemeBodySync`
- `src/components/CitySelector.jsx` — swap inline styles → className
- `src/components/RouteSelector.jsx` — swap inline styles → className
- `src/components/ChallengeForm.jsx` — swap inline styles → className (fix hardcoded colours)
- `src/components/TitleBar.jsx` — swap inline styles → className
- `src/components/ChallengeCard.jsx` — swap inline styles → className, move `@keyframes`
- `src/pages/AppPage.jsx` — remove `<style>` tag, swap inline styles → className
- `src/pages/ProjectPage.jsx` — remove `<style>` tag, swap inline styles → className
- `src/pages/CityPage.jsx` — remove `<style>` tags, swap inline styles → className
- `src/pages/RoutePage.jsx` — remove `<style>` tag + keyframes, swap inline styles → className
- `src/pages/LoginPage.jsx` — remove `<style>` tag, swap inline styles → className
- `.claude/CLAUDE.md` — update coding conventions to reflect CSS-based styling
- `doc/architecture.md` — update Styling row in Tech Stack table and Key Design Decisions

---

## Tasks

| #   | File(s)                                                                     | What                                          |
| --- | --------------------------------------------------------------------------- | --------------------------------------------- |
| 01  | `src/styles/tokens.css`, `src/styles/global.css`, `src/hooks/useCssVars.js` | CSS infrastructure                            |
| 02  | `src/App.jsx`                                                               | Wire `useCssVars` + import `global.css`       |
| 03  | `src/components/CitySelector.*`                                             | Migrate CitySelector                          |
| 04  | `src/components/RouteSelector.*`                                            | Migrate RouteSelector                         |
| 05  | `src/components/ChallengeForm.*`                                            | Migrate ChallengeForm + fix hardcoded colours |
| 06  | `src/components/TitleBar.*`                                                 | Migrate TitleBar                              |
| 07  | `src/components/ChallengeCard.*`                                            | Migrate ChallengeCard + move keyframes        |
| 08  | `src/pages/AppPage.*`                                                       | Migrate AppPage                               |
| 09  | `src/pages/ProjectPage.*`                                                   | Migrate ProjectPage                           |
| 10  | `src/pages/CityPage.*`                                                      | Migrate CityPage                              |
| 11  | `src/pages/RoutePage.*`                                                     | Migrate RoutePage + move keyframes            |
| 12  | `src/pages/LoginPage.*`                                                     | Migrate LoginPage                             |
| 13  | `.claude/CLAUDE.md`                                                         | Update coding conventions                     |
| 14  | `doc/architecture.md`                                                       | Update architecture docs                      |

- [2026-05-01-styling-refactor-01-css-infrastructure.md](2026-05-01-styling-refactor-01-css-infrastructure.md)
- [2026-05-01-styling-refactor-02-app-wiring.md](2026-05-01-styling-refactor-02-app-wiring.md)
- [2026-05-01-styling-refactor-03-cityselector.md](2026-05-01-styling-refactor-03-cityselector.md)
- [2026-05-01-styling-refactor-04-routeselector.md](2026-05-01-styling-refactor-04-routeselector.md)
- [2026-05-01-styling-refactor-05-challengeform.md](2026-05-01-styling-refactor-05-challengeform.md)
- [2026-05-01-styling-refactor-06-titlebar.md](2026-05-01-styling-refactor-06-titlebar.md)
- [2026-05-01-styling-refactor-07-challengecard.md](2026-05-01-styling-refactor-07-challengecard.md)
- [2026-05-01-styling-refactor-08-apppage.md](2026-05-01-styling-refactor-08-apppage.md)
- [2026-05-01-styling-refactor-09-projectpage.md](2026-05-01-styling-refactor-09-projectpage.md)
- [2026-05-01-styling-refactor-10-citypage.md](2026-05-01-styling-refactor-10-citypage.md)
- [2026-05-01-styling-refactor-11-routepage.md](2026-05-01-styling-refactor-11-routepage.md)
- [2026-05-01-styling-refactor-12-loginpage.md](2026-05-01-styling-refactor-12-loginpage.md)
- [2026-05-01-styling-refactor-13-claude-md.md](2026-05-01-styling-refactor-13-claude-md.md)
- [2026-05-01-styling-refactor-14-architecture-md.md](2026-05-01-styling-refactor-14-architecture-md.md)
