# The Freedom Hunt — Claude Context

## Project

A gamified voter registration scavenger hunt for American expats across European cities. Built for organisations like Democrats Abroad chapters. Participants visit historically significant sites, complete challenges, and register to vote. Currently live with Den Haag (Democrats Abroad / GWC).

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

- **JSX only** — no TypeScript, no `.tsx` files
- **Inline styles** — all styling via JS style objects on elements. No CSS modules, no Tailwind, no external stylesheets
- **Global resets** — each page component injects a `<style>` tag for `html, body, #root` resets at the top of its return. Follow this pattern for new pages
- **Content data** — lives in `src/data/text/en/` as YAML. New cities = new directory + YAML files under `projects/<projectId>/<cityId>/`. See `src/data/text/en/projects/democrats_abroad/den_haag/` for the full shape
- **No abstractions for one-off things** — keep it simple, follow existing patterns

## Session Start

Before starting work, read:
1. `doc/architecture.md` — understand the project structure
2. Last 3 entries in `doc/devlog/_devlog.md` — entries are delimited by `**DD/MM/YYYY, Author**:` lines, newest first

## Session End

**Always update the devlog as the last step of every session.** Add an entry at the top of `doc/devlog/devlog.md` following the format: `**DD/MM/YYYY, Claude**: [TYPE] One-line summary. Up to 5 bullet points.`

## Limitations

* The user will control Git, do not invoke git commands