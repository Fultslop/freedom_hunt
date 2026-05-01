# Multi-City Freedom Hunt — Implementation Plan

## Context
The app currently shows a single-page spec for "The Amsterdam Freedom Hunt" with tab navigation (Overview, Locations, Game Mechanics, Technical Spec, Voting Integration). The goal is to expand to multiple cities (Amsterdam, Berlin, Madrid, …), add a landing page at `/` with a "Cities" tab, and give each city its own URL (`/amsterdam`, `/berlin`, `/madrid`). City data (description, locations, count) must be data-driven via JSON files so new cities can be added without touching React code.

---

## Architecture

### Routing
Install `react-router-dom` and configure two routes:
- `/` → `LandingPage` (Overview, Game Mechanics, Technical Spec, Voting Integration, **Cities** tabs)
- `/:city` → `CityPage` (shared layout; reads `src/data/{city}.json`)

### Data files
```
src/data/
  cities.json          # list of all cities (id, name, description, link)
  amsterdam.json       # { city: {...}, locations: [...] }
  berlin.json          # stub — city overview only, empty locations array
  madrid.json          # stub — city overview only, empty locations array
```

**`cities.json` shape:**
```json
[
  {
    "id": "amsterdam",
    "name": "Amsterdam",
    "country": "Netherlands",
    "tagline": "Short city tagline",
    "description": "1-2 sentence city card description",
    "status": "active"   // or "coming-soon"
  }
]
```

**`{city}.json` shape:**
```json
{
  "city": {
    "id": "amsterdam",
    "name": "Amsterdam",
    "country": "Netherlands",
    "description": "Longer overview paragraph shown at top of city page",
    "totalLocations": 15,
    "suggestedRoute": "Jordaan → Plantage → Oost → Centrum (~6.5km)"
  },
  "locations": [
    {
      "id": 1,
      "name": "...",
      "neighborhood": "...",
      "coords": "...",
      "theme": "...",
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
```

---

## File Changes

### 1. `package.json` — add dependency
```
react-router-dom  (v7, matching React 19)
```

### 2. `src/main.jsx` — wrap in `BrowserRouter`
```jsx
import { BrowserRouter } from 'react-router-dom'
// wrap <App /> in <BrowserRouter>
```

### 3. `src/App.jsx` — add router + split into pages
Replace the single `HuntSpec` export with a router-aware root:
```jsx
// Routes:
//   /          → <LandingPage />
//   /:city     → <CityPage />
```
Keep all existing tab content (Overview, Game Mechanics, Technical Spec, Voting Integration) in `LandingPage`. Extract Locations tab content into `CityPage`.

### 4. `src/pages/LandingPage.jsx` (new)
- 5 tabs: Overview, Game Mechanics, Technical Spec, Voting Integration, **Cities**
- "Cities" tab: renders a grid of city cards from `cities.json`
  - Each card: city name, country, tagline, short description, "Explore →" link to `/{id}`
  - Coming-soon cities shown with a muted badge

### 5. `src/pages/CityPage.jsx` (new)
Shared layout for every city:
```
[Back to cities]
<City name + country header>
<City overview paragraph>
<Stats row: X locations · suggested route>
<Locations list> (expandable cards — same UI as current Locations tab)
```
On mount: `fetch(`/src/data/${cityId}.json`)` (or static import via Vite glob) to load city data. Show 404-style message if city not found.

### 6. `src/data/cities.json` (new)
Three cities: amsterdam (active), berlin (coming-soon), madrid (coming-soon).

### 7. `src/data/amsterdam.json` (new)
Extract all 15 locations + city meta from the `LOCATIONS` array in App.jsx.

### 8. `src/data/berlin.json` + `src/data/madrid.json` (new)
Stub files with city meta and empty `locations` array.

### 9. `vite.config.js` — enable SPA fallback
```js
server: { historyApiFallback: true }  // dev
build: { /* handled by hosting; document this in README */  }
```

---

## Implementation Order
1. Install `react-router-dom`
2. Create `src/data/` files (extract Amsterdam data, stubs for Berlin/Madrid)
3. Add router to `main.jsx`
4. Create `src/pages/LandingPage.jsx` (move existing tabs, add Cities tab)
5. Create `src/pages/CityPage.jsx` (shared city layout)
6. Simplify `src/App.jsx` to just wire routes
7. Update `vite.config.js`

---

## Verification
1. `npm run dev` — app starts without errors
2. `/` shows landing page with 5 tabs including Cities
3. Cities tab shows Amsterdam (active), Berlin + Madrid (coming soon)
4. `/amsterdam` loads all 15 locations from `amsterdam.json`
5. `/berlin` and `/madrid` load stubs (0 locations, city overview visible)
6. Unknown city URL (e.g. `/paris`) shows a graceful "city not found" message
7. Browser back button from city page returns to `/`
8. `npm run build` completes without errors
