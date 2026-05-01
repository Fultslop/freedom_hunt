# Design: Claude Session Context Setup

**Date:** 2026-03-21
**Status:** Approved

## Problem

Each new Claude session starts cold — no knowledge of the project's intent, conventions, or history. This leads to wasted time re-explaining context, and risks Claude making suggestions that contradict established decisions.

## Goal

Give Claude a reliable, low-maintenance context baseline at the start of every session: what the project is, how it's structured, how to work in it, and where to look for history.

## Decisions

- **Approach A (Lean):** CLAUDE.md stays thin and delegates to docs. Architecture lives in `doc/architecture.md`. Devlog already exists at `doc/devlog/devlog.md`.
- Project is React + Vite + JSX. CLAUDE.md reflects the current stack.
- Devlog format is already established — no changes to it.
- Claude-specific files go in `.claude/` (user preference). Claude Code reads `.claude/CLAUDE.md` natively alongside the root `CLAUDE.md`.

## Files to Create

### `doc/architecture.md`

Captures the project's purpose, stack, file structure, routing, data model, and key design decisions. Sourced from the LandingPage spec content.

**Sections:**

1. **What Is This Project** — mission, inspiration (Mamdani NYC hunt), target audience (American expats in Europe), Democrats Abroad context
2. **Tech Stack** — React 19, Vite, React Router v7, JSX (no TypeScript), deployed via `gh-pages`
3. **File Structure** — `src/pages/`, `src/data/`, `doc/`
4. **Routing** — `/` → LandingPage, `/:city` → CityPage (dynamic, loaded via `import()`)
5. **Data Model:**
   - `src/data/cities.json` — city index array. Each entry: `{ id, name, country, flag, tagline, description, status ("active"|"coming-soon"), locationCount }`
   - `src/data/<cityId>.json` — city detail. Shape: `{ city: { id, name, country, flag, description, totalLocations, totalPoints, walkTime, suggestedRoute }, locations: [...] }`. Each location: `{ id, name, neighborhood, coords, theme, themeColor, clue, historicalHook, americanConnection, challenge, votingBridge, points, badge, isFinal }`
   - Reference: `src/data/amsterdam.json` is the canonical example.
6. **Key Design Decisions** — PWA intent, data-driven city pages, voter registration funnel embedded at each location, inline styles throughout (no CSS modules/Tailwind), `<style>` tag in each page component for global html/body resets

---

### `.claude/CLAUDE.md`

Claude's orientation file. Loaded at session start by Claude Code. Short and actionable.

**Sections:**

1. **Project summary** — one paragraph: what the app is, who it's for, current state
2. **Dev commands** — `npm run dev` (local dev), `npm run build` (production build), `npm run preview` (preview build), `npm run lint` (ESLint)
3. **Key docs** — pointers to `doc/architecture.md` and `doc/devlog/devlog.md`
4. **Coding conventions:**
   - JSX (not TSX) — no TypeScript
   - Inline styles throughout — no CSS modules, no Tailwind, no external style files
   - Each page component injects a `<style>` tag for `html, body, #root` resets — follow this pattern
   - City data lives in `src/data/` as JSON — one index file, one file per city
   - New cities added as `src/data/<cityId>.json` matching the amsterdam.json shape
5. **Session start instructions** — read `doc/architecture.md` and the last 3 entries of `doc/devlog/devlog.md` before starting work

## Out of Scope

- No TypeScript migration
- No new devlog — existing `doc/devlog/devlog.md` referenced as-is
- No additional docs beyond `architecture.md` at this stage