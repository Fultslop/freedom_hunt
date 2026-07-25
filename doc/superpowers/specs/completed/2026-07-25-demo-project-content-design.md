# Demo Project Content Design (Paris / New York)

**Date:** 2026-07-25
**Scope:** A new `demo` project with two cities (Paris, New York), 3 routes per city, 10 locations per route, 5 of those 10 carrying a form that always includes a photo field. Pure content authoring against the existing data model, following [sub-project 1](2026-07-25-form-submit-routing-safety-design.md)'s project-aware form-submit routing. Demo's photo gallery is verified, not built — it's already generic per project/city. Does NOT include participant auth (that's [sub-project 4](2026-07-25-demo-participant-auth-design.md)) — the `demo` project can't actually be logged into until that ships; this spec produces the content, sub-project 4 produces the door.

---

## Background

This is sub-project 3 of the [dev/test environment roadmap](2026-07-25-dev-test-environment-roadmap.md). Unlike sub-project 2 (a copy of real DA content), this is synthetic content authored fresh — real, recognizable public landmarks in Paris and New York, generic historical/civic trivia framing (no political content, unlike DA's real hunt — this is test data, not a real campaign), used purely to exercise the app's full feature surface: multi-route navigation, all 8 form field types, photo upload, and the gallery.

## Content Shape

Matches the existing data model exactly (`doc/architecture.md` → Data Model):

```
projects/demo/
  demo.yaml                — project title/description/theme
  cities.yaml               — Paris, New York
  paris/
    paris.yaml
    routes.yaml              — riverside_route, left_bank_route, montmartre_route
    001_loc_*.yaml … 010_loc_*.yaml   (×3 routes = 30 files, some shared numbering per route — see Task breakdown in the plan)
    forms for the 5-per-route locations that have one
  new_york/
    new_york.yaml
    routes.yaml              — manhattan_route, museums_parks_route, brooklyn_route
    (same shape, 30 location files + forms)
```

Each route is fully self-contained (10 distinct locations, not shared across routes, unlike DA's `short_loop`/`extended_route` which overlap) — simpler to author and simpler to reason about for testing, since exercising one route never touches another's content.

## Landmark List

Real, well-known public landmarks — safe, unproblematic content for a demo/test app, same spirit as DA's real hunt using real Den Haag sites. Locations marked **(form)** are 1 of the 5 per route that carry a form; all others are storyline-only (`challenge.form` omitted), matching how DA's own locations are a mix of both.

### Paris

**Riverside Route** — Seine & central monuments
1. Eiffel Tower
2. Trocadéro Gardens **(form)**
3. Pont Alexandre III
4. Grand Palais **(form)**
5. Place de la Concorde
6. Tuileries Garden **(form)**
7. Louvre Pyramid
8. Pont Neuf **(form)**
9. Notre-Dame de Paris (exterior)
10. Île Saint-Louis **(form)**

**Left Bank Route** — culture & academia
1. Musée d'Orsay
2. Saint-Germain-des-Prés **(form)**
3. Luxembourg Gardens
4. Panthéon **(form)**
5. Sorbonne University
6. Shakespeare and Company **(form)**
7. Rue Mouffetard
8. Arènes de Lutèce **(form)**
9. Jardin des Plantes
10. Institut du Monde Arabe **(form)**

**Montmartre Route** — hills & panoramas
1. Sacré-Cœur Basilica
2. Place du Tertre **(form)**
3. Moulin Rouge
4. Musée de Montmartre **(form)**
5. Cimetière de Montmartre
6. Arc de Triomphe **(form)**
7. Champs-Élysées
8. Place Vendôme **(form)**
9. Opéra Garnier
10. Galeries Lafayette rooftop **(form)**

### New York

**Manhattan Route** — Midtown landmarks
1. Times Square
2. Rockefeller Center **(form)**
3. St. Patrick's Cathedral
4. Grand Central Terminal **(form)**
5. New York Public Library
6. Empire State Building **(form)**
7. Flatiron Building
8. Union Square **(form)**
9. Washington Square Park
10. One World Trade Center **(form)**

**Museums & Parks Route**
1. Central Park (The Mall)
2. Bethesda Terrace **(form)**
3. Metropolitan Museum of Art
4. American Museum of Natural History **(form)**
5. Strawberry Fields
6. Belvedere Castle **(form)**
7. Columbus Circle
8. Lincoln Center **(form)**
9. Museum of Modern Art (MoMA)
10. Bryant Park **(form)**

**Brooklyn Route**
1. Brooklyn Bridge (Manhattan side)
2. South Street Seaport **(form)**
3. Brooklyn Bridge Park
4. DUMBO **(form)**
5. Brooklyn Heights Promenade
6. Domino Park **(form)**
7. Williamsburg waterfront
8. Prospect Park **(form)**
9. Brooklyn Museum
10. Coney Island boardwalk **(form)**

## Field-Type Coverage

Every form always includes a `photo` field first (per requirement: "all forms include photo upload"), plus 2–3 more fields. The same 5-slot rotation repeats in every route so the demo project as a whole exercises all 8 supported field types (`boolean`, `string`, `number`, `radio`, `multiple`, `photo`, `textarea`, `section`) many times over:

| Form slot (route position) | Fields beyond `photo` |
|---|---|
| 1st form (position 2) | `boolean`, `string` |
| 2nd form (position 4) | `number`, `radio` |
| 3rd form (position 6) | `multiple`, `textarea` |
| 4th form (position 8) | `string`, `radio` |
| 5th form (position 10) | `section`, `boolean`, `number` |

The plan's per-route tasks give the exact question text/options for each — landmark-appropriate trivia (e.g. "how many arches can you count," "what's the nearest street name"), not generic filler.

## Worked Example (locks the exact YAML shape)

`paris/002_loc_trocadero.yaml` — a location with a form:

```yaml
title: "The Best View in Paris"
image: placeholder.jpg
name:
  label: ""
  value: "Trocadéro Gardens"
address: "Place du Trocadéro, 75016 Paris"
coordinates:
  longitude: 2.2893
  latitude: 48.8620
storyline: |
  The Trocadéro terrace looks straight across the Seine at the Eiffel Tower — the classic postcard shot, and the best place in the city to see the whole tower at once.
challenge:
  name: ""
  description: |
    Stand on the terrace and count how many people you can see also taking a photo of the tower at the same time.
  notes: ""
  form: "002_form_trocadero.yaml"
breadcrumb: |
  Cross the river toward the tower itself — you'll want to see it from underneath next.
```

`paris/002_form_trocadero.yaml`:

```yaml
- id: photo
  type: photo
  label: Take a photo of the view
- id: saw_tower_lit
  type: boolean
  label: Was the tower sparkling/lit when you arrived?
- id: photo_takers_count
  type: string
  label: Roughly how many other people were photographing the tower?
```

A location without a form (`paris/001_loc_eiffel_tower.yaml`) simply omits `challenge.form` entirely, matching the existing schema (it's an optional field per `location.schema.json`).

## Out of Scope

- Participant auth / signup for `demo` — sub-project 4. Content exists and is valid YAML but isn't reachable through the app's login flow until then.
- Real photography or curated images — `image:` fields reference a single shared `placeholder.jpg` across all 60 locations (added to `src/data/img/`) rather than 60 unique sourced images; not worth the effort for test content.
- The photo gallery UI/API — already generic, verified working once real test photos exist via normal use, not modified here.
- Editor/CMS support for authoring more Demo content later — organizers already have the existing location editor (`/editor`) for that, unchanged.

## Testing / Verification

No automated tests — content only, same as sub-project 2.

1. `npm run validate:yaml` — all 60 location files + 30 form files must pass schema validation.
2. Manual: `npm run dev`, confirm `Demo` appears on the landing page (once sub-project 4's login exists) with Paris and New York cities, each showing 3 routes; spot-check one route per city end-to-end (all 10 locations render, the 5 forms render with a photo field plus their listed fields, submission succeeds).
