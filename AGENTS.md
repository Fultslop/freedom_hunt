# Searchspace-scavenger-hunt — Agent Context

## Project

A city based scavenger hunt across European cities. Currently live with Den Haag (for the Democrats Abroad / GWC project).

See `doc/architecture.md` for full project context.

## Dev Commands

    npm run dev       # local dev server
    npm run build     # production build
    npm run preview   # preview production build
    npm run lint      # ESLint
    npm run typecheck # Type checking (TypeScript + Svelte-check)
    npm test          # Run Vitest tests

## Key Docs

- **Architecture:** `doc/architecture.md` — project intent, stack, routing, data model
- **Devlog:** `doc/devlog/_devlog.md` — dated log of decisions and changes (note: underscore prefix)

## Coding Conventions

- **Svelte 5 & TypeScript** — use `.svelte` (Svelte 5 runes) and `.ts` files.
- **CSS custom properties** — all styling via co-located `.css` files imported into each component/page. Use CSS `var(--color-*)` tokens for all colours. No CSS modules, no Tailwind.
- **Global resets and keyframes** — live in `src/styles/global.css`, imported once in `main.ts` or `App.svelte`.
- **Inline styles** — permitted only for truly dynamic values that cannot be expressed as a static CSS rule (e.g. computed pixel offsets, `width` percentage driven by runtime state). Theme colours are not dynamic — always use CSS custom properties.
- **Token sync** — `src/App.svelte` syncs the theme object to `--color-*` CSS custom properties on `<html>` using a `$effect`.
- **New components** — create a co-located `ComponentName.css` file. Use BEM-like class names (`component-name__element--modifier`). Import the CSS file at the top of the Svelte file.
- **Content data** — lives in `src/data/text/en/` as YAML. New cities = new directory + YAML files under `projects/<projectId>/<cityId>/`.
- **No abstractions for one-off things** — keep it simple, follow existing patterns.

## Session Start

Before starting work, read:

1. `doc/architecture.md` — understand the project structure
2. Last 3 entries in `doc/devlog/_devlog.md` — entries are delimited by `**DD/MM/YYYY, Author**:` lines, newest first

## Session End

**Always update the devlog as the last step of every session.** Add an entry at the top of `doc/devlog/_devlog.md` following the format: `**DD/MM/YYYY, Claude**: [TYPE] One-line summary. Up to 5 bullet points.`

## Limitations

- The user will control Git, do not invoke git commands
