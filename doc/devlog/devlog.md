Devlog
======

Keep track of work done. Format
`**<Date (DD/MM/YYYY)>, <Author>**: <One line overview, compatible with commit message standard. Short description, max five lines>

Latest entries go on top

## Entries:

**21/03/2026, Claude**: [FEAT] Add full location data for Berlin and Madrid; enable both cities as active hunts.
- Write berlin.json with 15 historically grounded locations (2,825 pts, ~4-5hr walk) — from Memorial to the Murdered Jews of Europe to Rathaus Schöneberg (JFK "Ich bin ein Berliner" final stop)
- Write madrid.json with 15 historically grounded locations (2,825 pts, ~4-5hr walk) — from Guernica at Reina Sofía to Casa de América final stop
- Each location has clue, historicalHook, americanConnection, challenge, votingBridge, badge, themeColor following amsterdam.json shape
- Update cities.json: Berlin and Madrid status → "active", locationCount → 15
- Build verified clean (exit 0); both cities compile to separate dynamic JS chunks

**21/03/2026, Claude**: [DOCS] Add architecture doc and Claude session context setup.
- Add `doc/architecture.md` covering project intent, stack, file structure, routing, data model, and key design decisions
- Add `.claude/CLAUDE.md` for Claude session orientation — dev commands, doc pointers, coding conventions, session start instructions
- Fix architecture doc: accurate `doc/` file tree, clarified CityPage loading states (not-found vs coming-soon)

**21/03/2026, Claude**: [FEAT] Add multi-city routing and data-driven city pages.
- Install react-router-dom; add BrowserRouter to main.jsx
- Refactor App.jsx to route `/` → LandingPage, `/:city` → CityPage
- Extract Amsterdam locations to amsterdam.json; add berlin.json and madrid.json stubs
- Add cities.json as city index; add Cities tab to landing page
- CityPage shared layout loads city data from JSON, shows graceful "coming soon" / "not found" states

**21/03/2026, FS**: [FEAT] Initial commit. Add base pages, git layout and draft.
