# ChallengeCard Redesign — Design Spec

**Date:** 2026-04-29
**Status:** Approved

## Overview

Redesign the `ChallengeCard` component in-place to implement a rich, mobile-first location detail view inspired by the Google Stitch prototype. The data schema drives the layout — the Stitch design communicates visual intent, not exact field mapping.

## Scope

**In scope:**

- Redesign `src/components/ChallengeCard.jsx`
- Add an `image` field to location YAML files
- Install `leaflet` + `react-leaflet` for the interactive map
- Update `ChallengeCard` tests to match the new layout

**Out of scope:**

- Bottom navigation bar (HUNT / MAP / DIPLOMACY / PROFILE) — separate feature
- TitleBar / header — already implemented, managed by `RoutePage` via `useTitleBar`
- Answer validation for the breadcrumb riddle
- "Found it!" button or any completion/progress state

## Data Schema

### Existing fields used

| YAML field                                       | Display section                              |
| ------------------------------------------------ | -------------------------------------------- |
| `locationId`                                     | Badge number in title block                  |
| `title`                                          | Mission title in title block                 |
| `name.value`                                     | Place name below title                       |
| `address`                                        | Street address below `name.value`            |
| `storyline`                                      | Storyline section                            |
| `coordinates.latitude` / `coordinates.longitude` | Leaflet map centre + marker                  |
| `challenge.description`                          | Challenge section (below map)                |
| `breadcrumb`                                     | "Your clue to your next destination" section |

### New field to add

```yaml
image: "alireza-parpaei-den-haag-unsplash.jpg"
```

- Added to each location YAML file under `src/data/text/en/projects/…`
- Value is a filename relative to `src/data/img/`
- Component imports the image via Vite's asset pipeline (`import`)
- If `image` is absent, empty, or fails to load: `heroSrc` stays null, hero section is not rendered, and the title card renders in normal document flow (no absolute positioning)

## Layout — Five Sections (top to bottom)

### 1. Hero image

- Full-width, fixed height (~220px)
- Image source: `src/data/img/<location.image>`
- No text overlay — plain image
- If `image` field is absent, empty, or fails to load: skip the hero section entirely; the title card renders at the top of the component with no overlap/absolute positioning

### 2. Title card (overlaps hero)

- Positioned absolute over the bottom of the hero, left/right margins of 16px
- `theme.surface` background with drop shadow, 8px border radius
- Left: `locationId` in a dark-blue (#002868) square badge, 44×44px, bold numeral
- Right (stacked vertically):
  - `title` — 16px bold
  - `name.value` — 13px, secondary colour — only rendered when non-empty
  - `address` — 11px, muted colour — only rendered when non-empty
- Card extends ~48px below the hero bottom edge; content below adds top margin to clear it

### 3. Storyline

- Section label: "STORYLINE" (10px uppercase, muted)
- Body: `storyline` text, 14px, 1.65 line-height
- Separated by a 1px border

### 4. Location (map + challenge)

- Section label: "LOCATION" (10px uppercase, muted)
- Leaflet map, 180px tall, rounded corners, centred on `coordinates.latitude` / `coordinates.longitude`
- Single red (#BF0A30) marker at the location
- Coordinates displayed below map in monospace (11px)
- Below coordinates: shaded box (light grey background) containing:
  - Sub-label: "CHALLENGE" (10px uppercase, muted)
  - `challenge.description` text, 13px

### 5. Breadcrumb

- Section label: "YOUR CLUE TO YOUR NEXT DESTINATION" (10px uppercase, muted)
- `breadcrumb` text, 14px italic, with a 3px left border in red (#BF0A30) and 12px left padding
- Last section — no border below

## Component Interface

`ChallengeCard` retains its existing prop signature — `RoutePage` needs no changes:

```jsx
<ChallengeCard location={location} />
```

`location` is the object loaded by `useLocations`, which already includes all fields from the YAML.

## Dependencies

| Package         | Purpose                        |
| --------------- | ------------------------------ |
| `leaflet`       | Map tiles and marker rendering |
| `react-leaflet` | React wrapper for Leaflet      |

Leaflet requires its CSS to be imported. Since the project uses inline styles and no CSS modules, import `leaflet/dist/leaflet.css` at the top of `ChallengeCard.jsx` (this is the standard Leaflet setup — it styles map tiles and controls, not the surrounding UI).

Tile provider: OpenStreetMap (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`), attribution required per OSM terms.

## Theming

Use `useTheme()` for all colours outside the map. The locationId badge uses the DA navy (#002868) and the breadcrumb border uses DA red (#BF0A30) — these are GWC theme constants, not theme tokens, as they represent the Democrats Abroad brand identity of this specific project.

## Image loading

Vite supports dynamic `import()` for assets. Load the image in a `useEffect`:

```js
const [heroSrc, setHeroSrc] = useState(null);
useEffect(() => {
  if (!location.image) return;
  import(`../data/img/${location.image}`)
    .then((m) => setHeroSrc(m.default))
    .catch(() => setHeroSrc(null));
}, [location.image]);
```

Render a solid-colour placeholder (`theme.surface` or theme accent) when `heroSrc` is null.

## Tests

Update `src/test/ChallengeCard.test.jsx`:

- Remove tests for old fields (`clue`, `challenge` as top-level string)
- Add tests for: title renders, `name.value` renders, `address` renders, `storyline` renders, `breadcrumb` renders, map container renders, challenge description renders
- Mock `react-leaflet` (MapContainer, TileLayer, Marker) to avoid JSDOM map errors
- Mock the dynamic image import returning null — assert hero section absent and title card renders in normal flow (no absolute positioning)
