# Theming & Title Bar — Implementation Index

**Goal:** Add a persistent title bar and a runtime-switchable three-preset theme system (wireframe / app / GWC) driven by project JSON config.

**Architecture:** Dual React Context — `ThemeContext` owns the active style token object; `TitleBarContext` owns what the bar displays (title, progress, back path). A single `TitleBar` component mounts once in `App.jsx` above all routes and reads from both. Pages declare their title bar config and trigger theme switches via hooks.

**Tech Stack:** React 19, React Router v7, Vitest + Testing Library, inline styles throughout (no CSS modules).

**Spec:** [doc/superpowers/specs/2026-04-29-theming-titlebar-design.md](../specs/2026-04-29-theming-titlebar-design.md)

---

## Tasks

Execute in order — each task depends on the previous one.

| # | Task | File(s) |
|---|---|---|
| 1 | [Theme preset objects](2026-04-29-theming-01-themes.md) | `src/theme/themes.js` |
| 2 | [ThemeContext](2026-04-29-theming-02-theme-context.md) | `src/theme/ThemeContext.jsx` + test |
| 3 | [TitleBarContext](2026-04-29-theming-03-titlebar-context.md) | `src/theme/TitleBarContext.jsx` + test |
| 4 | [TitleBar component](2026-04-29-theming-04-titlebar-component.md) | `src/components/TitleBar.jsx` + test |
| 5 | [Wire up App.jsx](2026-04-29-theming-05-app-wiring.md) | `src/App.jsx` |
| 6 | [Add style field to project JSON](2026-04-29-theming-06-data-json.md) | `src/data/text/en/projects/democrats_abroad/democrats_abroad.json` |
| 7 | [Theme AppPage](2026-04-29-theming-07-apppage.md) | `src/pages/AppPage.jsx` |
| 8 | [Theme ProjectPage](2026-04-29-theming-08-projectpage.md) | `src/pages/ProjectPage.jsx` |
| 9 | [Theme CityPage](2026-04-29-theming-09-citypage.md) | `src/pages/CityPage.jsx` |
| 10 | [Theme RoutePage](2026-04-29-theming-10-routepage.md) | `src/pages/RoutePage.jsx` |
| 11 | [Theme ChallengeCard](2026-04-29-theming-11-challengecard.md) | `src/components/ChallengeCard.jsx` + test update |
