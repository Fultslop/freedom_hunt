# Claude Context Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `doc/architecture.md` and `.claude/CLAUDE.md` so every new Claude session starts with full project context.

**Architecture:** Two files — an architecture doc in `doc/` (alongside the existing devlog) that captures project intent and structure, and a thin CLAUDE.md in `.claude/` that orients Claude and points to the docs.

**Tech Stack:** Markdown only. No code changes.

**Spec:** `doc/superpowers/specs/2026-03-21-claude-context-setup-design.md`

---

### Task 1: Write `doc/architecture.md`

**Files:**
- Create: `doc/architecture.md`

> Note: The file content below contains fenced code blocks (` ``` `). Write these as literal content — they are part of the Markdown file being created, not plan formatting.

- [ ] **Step 1: Create the file with this exact content**

```
# The Freedom Hunt — Architecture

## What Is This Project

The Freedom Hunt is a gamified, digitally-run scavenger hunt across European cities for American expats. Run by Democrats Abroad chapters, it drives voter registration while building community and political consciousness.

Inspired by Zohran Mamdani's August 2025 NYC scavenger hunt (2M views, credited as part of his path to winning the NYC mayoral race), this version is built for the expat context: longer lead time, digital clue delivery, and a deeper historical curriculum connecting anti-fascism history to the stakes of American democracy.

Target audience: American citizens living in or visiting European cities who are eligible to vote in US federal elections. Primary target: unregistered expats.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 19 |
| Build tool | Vite 8 |
| Routing | React Router v7 |
| Language | JSX (no TypeScript) |
| Styling | Inline styles throughout (no CSS modules, no Tailwind) |
| Data | Static JSON files in `src/data/` |
| Deployment | GitHub Pages via `gh-pages` |
| Fonts | Playfair Display (headings), Lora (body) — loaded via Google Fonts |

## File Structure

~~~
src/
  pages/
    LandingPage.jsx   — Landing page + full product spec (tabbed: Overview, Mechanics, Technical, Voting, Cities)
    CityPage.jsx      — Shared city hunt page, loads data dynamically by city ID
  data/
    cities.json       — City index (all cities, active + coming-soon)
    amsterdam.json    — Amsterdam hunt data (active)
    berlin.json       — Berlin stub (coming-soon)
    madrid.json       — Madrid stub (coming-soon)
  main.jsx            — App entry point, BrowserRouter wrapper
  App.jsx             — Route definitions
doc/
  architecture.md     — This file
  devlog/
    devlog.md         — Session-by-session development log
  superpowers/
    specs/            — Brainstorming design specs
    plans/            — Implementation plans
~~~

## Routing

| Path | Component | Notes |
|------|-----------|-------|
| `/` | `LandingPage` | Static spec/overview page |
| `/:city` | `CityPage` | Dynamic — loads `src/data/<cityId>.json` via `import()` |

CityPage handles three states: loading, not-found (no matching JSON), and data-loaded. Coming-soon cities have a JSON stub with an empty `locations` array — CityPage renders a "Hunt Under Construction" state for these.

## Data Model

### `src/data/cities.json` — City index

Array of city summary objects:

~~~json
{
  "id": "amsterdam",          // used as URL segment and JSON filename
  "name": "Amsterdam",
  "country": "Netherlands",
  "flag": "🇳🇱",
  "tagline": "Where resistance became history",
  "description": "...",
  "status": "active",         // "active" | "coming-soon"
  "locationCount": 15
}
~~~

### `src/data/<cityId>.json` — City detail

~~~json
{
  "city": {
    "id": "amsterdam",
    "name": "Amsterdam",
    "country": "Netherlands",
    "flag": "🇳🇱",
    "description": "...",
    "totalLocations": 15,
    "totalPoints": 2825,
    "walkTime": "~4 hours",
    "suggestedRoute": "Jordaan → Plantage → ..."
  },
  "locations": [
    {
      "id": 1,
      "name": "Anne Frank House",
      "neighborhood": "Jordaan",
      "coords": "52.3752° N, 4.8840° E",
      "theme": "Silence & Complicity",
      "themeColor": "#8B1A1A",
      "clue": "...",
      "historicalHook": "...",
      "americanConnection": "...",
      "challenge": "...",
      "votingBridge": "...",
      "points": 200,
      "badge": "🕯️ The Witness",
      "isFinal": false
    }
  ]
}
~~~

Reference: `src/data/amsterdam.json` is the canonical complete example.

## Key Design Decisions

**Inline styles throughout.** No CSS modules, no Tailwind. Styles are co-located with components as JS objects. Each page component also injects a `<style>` tag for `html, body, #root` resets — this is intentional, follow this pattern when adding new pages.

**PWA intent.** The app is designed as a mobile-first Progressive Web App — no app store download required. Participants access via a shared link. Offline-capable clue viewing is a goal; the current build is the prototype foundation for this.

**Data-driven cities.** Adding a new city = adding one JSON file to `src/data/` matching the shape above, plus an entry in `cities.json`. No code changes needed.

**LandingPage doubles as the product spec.** The landing page at `/` is a tabbed document covering the full product vision (Overview, Game Mechanics, Technical Spec, Voting Integration, Cities). It serves both as the live app entry point and as the canonical product specification for the project.

**Voter registration funnel.** Every location has a `votingBridge` field — a specific voter registration CTA tied to the history of that stop. The hunt moves participants through: Awareness → Motivation → Friction Removal → Action → Social Proof → Retention.
```

- [ ] **Step 2: Verify**

```bash
grep -c "^##" doc/architecture.md
```
Expected output: `6`

- [ ] **Step 3: Commit**

```bash
git add doc/architecture.md
git commit -m "docs: add architecture document"
```

---

### Task 2: Write `.claude/CLAUDE.md`

**Files:**
- Create: `.claude/CLAUDE.md`

- [ ] **Step 1: Create the `.claude/` directory**

```bash
mkdir -p .claude
```

- [ ] **Step 2: Create the file with this exact content**

```
# The Freedom Hunt — Claude Context

## Project

A gamified voter registration scavenger hunt for American expats across European cities. Built for Democrats Abroad chapters. Participants visit historical anti-fascism sites, complete challenges, and register to vote. Currently a prototype with Amsterdam live; Berlin and Madrid are stubs.

See `doc/architecture.md` for full project context.

## Dev Commands

    npm run dev       # local dev server
    npm run build     # production build
    npm run preview   # preview production build
    npm run lint      # ESLint

## Key Docs

- **Architecture:** `doc/architecture.md` — project intent, stack, routing, data model
- **Devlog:** `doc/devlog/devlog.md` — dated log of decisions and changes

## Coding Conventions

- **JSX only** — no TypeScript, no `.tsx` files
- **Inline styles** — all styling via JS style objects on elements. No CSS modules, no Tailwind, no external stylesheets
- **Global resets** — each page component injects a `<style>` tag for `html, body, #root` resets at the top of its return. Follow this pattern for new pages
- **City data** — lives in `src/data/` as JSON. New cities = new `<cityId>.json` file + entry in `cities.json`. See `src/data/amsterdam.json` for the full shape
- **No abstractions for one-off things** — keep it simple, follow existing patterns

## Session Start

Before starting work, read:
1. `doc/architecture.md` — understand the project structure
2. Last 3 entries in `doc/devlog/devlog.md` — know what's changed recently
```

- [ ] **Step 3: Verify**

```bash
grep -c "^##" .claude/CLAUDE.md
```
Expected output: `5`

- [ ] **Step 4: Commit**

```bash
git add .claude/CLAUDE.md
git commit -m "docs: add CLAUDE.md for session context"
```
