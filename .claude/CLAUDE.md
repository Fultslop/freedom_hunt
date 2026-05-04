# Searchspace-scavenger-hunt — Claude Context

## Project

A city based scavenger hunt across European cities. Currently live with Den Haag (for the Democrats Abroad / GWC project).
See `doc/architecture.md` for full project context.

## Dev Commands

    npm run dev       # local dev server
    npm run build     # production build
    npm run preview   # preview production build
    npm run lint      # ESLint

## Key Docs

- **Architecture:** `doc/architecture.md` — project intent, stack, routing, data model
- **Devlog:** `doc/devlog/_devlog.md` — dated log of decisions and changes (note: underscore prefix)

## Coding Conventions

- **TypeScript only** — all source files use `.ts` (no JSX) or `.tsx` (with JSX). No `.js` or `.jsx` files in `src/`.
- **CSS custom properties** — all styling via co-located `.css` files imported into each component/page. Use CSS `var(--color-*)` tokens for all colours. No CSS modules, no Tailwind.
- **Global resets and keyframes** — live in `src/styles/global.css`, imported once in `App.jsx`. Do not inject `<style>` reset tags in page components.
- **Inline styles** — permitted only for truly dynamic values that cannot be expressed as a static CSS rule (e.g. computed pixel offsets, `width` percentage driven by runtime state, per-record colour values from data). Theme colours are not dynamic — always use CSS custom properties.
- **Token sync** — `src/hooks/useCssVars.ts` syncs the JS theme object to `--color-*` CSS custom properties on `<html>` on every theme change. Called once inside `ThemeBodySync` in `App.tsx`.
- **New components** — create a co-located `ComponentName.css` file. Use BEM-like class names (`component-name__element--modifier`). Import the CSS file at the top of the TSX file. Define props as an inline interface `interface ComponentNameProps { ... }` rather than using PropTypes.
- **Content data** — lives in `src/data/text/en/` as YAML. New cities = new directory + YAML files under `projects/<projectId>/<cityId>/`. See `src/data/text/en/projects/democrats_abroad/den_haag/` for the full shape
- **No abstractions for one-off things** — keep it simple, follow existing patterns

## Session Start

Before starting work, read:

1. `doc/architecture.md` — understand the project structure
2. Last 3 entries in `doc/devlog/_devlog.md` — entries are delimited by `**DD/MM/YYYY, Author**:` lines, newest first

## Session End

**Always update the devlog as the last step of every session.** Add an entry at the top of `doc/devlog/devlog.md` following the format: `**DD/MM/YYYY, Claude**: [TYPE] One-line summary. Up to 5 bullet points.`

## Limitations

- The user will control Git, do not invoke git commands
