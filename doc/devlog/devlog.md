Devlog
======

Keep track of work done. Format
`**<Date (DD/MM/YYYY)>, <Author>**: <One line overview, compatible with commit message standard. Short description, max five lines>

Latest entries go on top

## Entries:

**21/03/2026, Claude**: [FEAT] Add multi-city routing and data-driven city pages.
- Install react-router-dom; add BrowserRouter to main.jsx
- Refactor App.jsx to route `/` → LandingPage, `/:city` → CityPage
- Extract Amsterdam locations to amsterdam.json; add berlin.json and madrid.json stubs
- Add cities.json as city index; add Cities tab to landing page
- CityPage shared layout loads city data from JSON, shows graceful "coming soon" / "not found" states

**21/03/2026, FS**: [FEAT] Initial commit. Add base pages, git layout and draft.
