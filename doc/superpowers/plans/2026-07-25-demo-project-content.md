# Demo Project Content Implementation Plan (Paris / New York)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author `src/data/text/en/projects/demo/` — Paris and New York, 3 routes each, 10 locations per route, 5 of 10 carrying a form with a photo field — following the exact schema DA's content already uses.

**Architecture:** Pure content authoring, no application code. File naming follows the existing `NNN_loc_<slug>.yaml` / `NNN_form_<slug>.yaml` convention, numbered continuously per city (not restarting per route, since all of a city's location files live in one flat directory and `routes.yaml` is what groups them into routes).

**Tech Stack:** YAML, validated by the existing `npm run validate:yaml` (ajv against `src/data/schemas/location.schema.json` / `form.schema.json`).

## Global Constraints

- Every form's first field is always `{ id: photo, type: photo, label: "Take a photo of..." }`.
- Location files with no form simply omit `challenge.form` — do not write an empty array or empty string.
- `image:` is `placeholder.jpg` for all 60 locations (added once in Task 1, referenced everywhere).
- `name.label` is always `""` (matches DA's existing files — the field exists in the schema but DA never populates it).
- File numbering is continuous within a city: Paris uses `001`–`030` across its three routes (Riverside `001`–`010`, Left Bank `011`–`020`, Montmartre `021`–`030`); New York the same (Manhattan `001`–`010`, Museums & Parks `011`–`020`, Brooklyn `021`–`030`).
- Coordinates are real-world approximate values for the actual landmark (not `0,0` placeholders) — sourced from general geographic knowledge, good enough for demo/test purposes; not survey-grade.

---

### Task 1: Demo project scaffolding

**Files:**
- Create: `src/data/text/en/projects/demo/demo.yaml`
- Create: `src/data/text/en/projects/demo/cities.yaml`
- Create: `src/data/img/placeholder.jpg` (any small placeholder image — reuse an existing image file from `src/data/img/` if one is genuinely generic, otherwise generate a minimal solid-color JPEG)
- Modify: `src/data/text/en/projects/projects.yaml`

**Interfaces:** none — content only.

- [ ] **Step 1: Write `demo.yaml`**

```yaml
style: "app"
project.title: "Demo"
project.description: "A sample scavenger hunt covering Paris and New York, used to test the app's full feature set — every question type, photo upload, and the photo gallery — without touching real event data."
project.cta: "Choose a city to start exploring."
project.image: placeholder.jpg
```

(`style: "app"` uses the app's default theme preset rather than DA's `GWC` branding — this project isn't DA's, so it shouldn't look like it.)

- [ ] **Step 2: Write `cities.yaml`**

```yaml
page.title: "Demo"
page.text: |
  A test project covering two cities. Use it to try out every question type, photo upload, and the photo gallery.
page.selectCity: "Choose a city"
page.image: placeholder.jpg
items:
  - id: paris
    name: "Paris"
    image: placeholder.jpg
    country: "France"
    description: "Three routes through the city's best-known landmarks."
    coordinates:
      longitude: 2.3522
      latitude: 48.8566
  - id: new_york
    name: "New York"
    image: placeholder.jpg
    country: "United States"
    description: "Three routes through Manhattan and Brooklyn."
    coordinates:
      longitude: -73.9857
      latitude: 40.7484
```

- [ ] **Step 3: Add a placeholder image**

Check whether a genuinely generic placeholder already exists:
```bash
ls src/data/img/ | grep -i placeholder
```
If none exists, create a minimal one — any small solid-color JPEG works, e.g. via ImageMagick if available (`convert -size 800x600 xc:#cccccc src/data/img/placeholder.jpg`), or copy any existing small image in `src/data/img/` and rename it, whichever is simpler in the environment at hand. The only requirement is that `/assets/img/placeholder.jpg` resolves to a valid image file.

- [ ] **Step 4: List `demo` in `projects.yaml`**

Add a third item to `src/data/text/en/projects/projects.yaml`'s `items` list:

```yaml
  - id: demo
    image: placeholder.jpg
    name: "Demo"
    description: "Sample content for testing — Paris and New York, with every question type and photo upload."
```

- [ ] **Step 5: Validate**

Run: `npm run validate:yaml`
Expected: exits 0 (only `demo.yaml`/`cities.yaml`/`projects.yaml` exist so far — no location/form files to validate against yet, this just confirms no syntax errors).

- [ ] **Step 6: Commit**

```bash
git add src/data/text/en/projects/demo/demo.yaml src/data/text/en/projects/demo/cities.yaml src/data/text/en/projects/projects.yaml src/data/img/placeholder.jpg
git commit -m "feat: scaffold demo project (Paris/New York cities)"
```

---

### Task 2: Paris — Riverside Route content

**Files:**
- Create: `src/data/text/en/projects/demo/paris/paris.yaml`
- Create: `src/data/text/en/projects/demo/paris/001_loc_eiffel_tower.yaml` through `010_loc_ile_saint_louis.yaml` (10 files)
- Create: `src/data/text/en/projects/demo/paris/002_form_trocadero.yaml`, `004_form_grand_palais.yaml`, `006_form_tuileries.yaml`, `008_form_pont_neuf.yaml`, `010_form_ile_saint_louis.yaml` (5 files)

**Interfaces:** none — content only. `routes.yaml` referencing these ids is written in Task 4, once all 30 Paris location ids exist.

- [ ] **Step 1: Write `paris.yaml`**

```yaml
city.title: "Paris"
city.country: "France"
city.tagline: "Three routes, thirty landmarks"
city.description: |
  A demo route through some of Paris's best-known sights, used to test every part of the app: navigation, all eight question types, photo upload, and the gallery.
```

- [ ] **Step 2: Write the 10 Riverside Route locations**

`001_loc_eiffel_tower.yaml` (no form):
```yaml
title: "The Iron Lady"
image: placeholder.jpg
name:
  label: ""
  value: "Eiffel Tower"
address: "Champ de Mars, 5 Avenue Anatole France, 75007 Paris"
coordinates:
  longitude: 2.2945
  latitude: 48.8584
storyline: |
  Built for the 1889 World's Fair, the tower was meant to stand for twenty years and then be torn down. It's still here.
challenge:
  name: ""
  description: |
    Find the base of one of the tower's four legs and note which one you're standing at (North, South, East, or West).
  notes: ""
breadcrumb: |
  Cross toward the river and look back — the best view of the tower isn't from underneath it.
```

`002_loc_trocadero.yaml` (form — exact content from the spec's worked example):
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

`003_loc_pont_alexandre.yaml` (no form):
```yaml
title: "Paris's Most Ornate Bridge"
image: placeholder.jpg
name:
  label: ""
  value: "Pont Alexandre III"
address: "Pont Alexandre III, 75008 Paris"
coordinates:
  longitude: 2.3134
  latitude: 48.8639
storyline: |
  Named for a Russian tsar, this bridge was built for the 1900 World's Fair and is covered in gilded statues and lamps.
challenge:
  name: ""
  description: |
    Count the gilded statues on the four corner pillars.
  notes: ""
breadcrumb: |
  Follow the river east toward the Grand Palais's glass roof.
```

`004_loc_grand_palais.yaml` (form):
```yaml
title: "Glass and Steel"
image: placeholder.jpg
name:
  label: ""
  value: "Grand Palais"
address: "3 Avenue du Général Eisenhower, 75008 Paris"
coordinates:
  longitude: 2.3125
  latitude: 48.8661
storyline: |
  The Grand Palais's iron-and-glass roof was, when built in 1900, the largest of its kind in the world.
challenge:
  name: ""
  description: |
    Find the main entrance and look up at the glass roof from directly underneath it.
  notes: ""
  form: "004_form_grand_palais.yaml"
breadcrumb: |
  Head toward the wide square to the south — you're looking for an obelisk.
```

`005_loc_place_concorde.yaml` (no form):
```yaml
title: "The Square That Changed Names Five Times"
image: placeholder.jpg
name:
  label: ""
  value: "Place de la Concorde"
address: "Place de la Concorde, 75008 Paris"
coordinates:
  longitude: 2.3212
  latitude: 48.8656
storyline: |
  This square has been renamed five times since the 1755. Its Egyptian obelisk is over 3,000 years old — far older than the square itself.
challenge:
  name: ""
  description: |
    Find the obelisk and note the hieroglyphs carved into its base.
  notes: ""
breadcrumb: |
  Walk into the garden ahead of you — it's the oldest formal garden in Paris.
```

`006_loc_tuileries.yaml` (form):
```yaml
title: "The King's Garden"
image: placeholder.jpg
name:
  label: ""
  value: "Tuileries Garden"
address: "Jardin des Tuileries, 75001 Paris"
coordinates:
  longitude: 2.3275
  latitude: 48.8634
storyline: |
  Laid out in the 1560s for Catherine de' Medici, this garden was the model for formal French gardens everywhere after it.
challenge:
  name: ""
  description: |
    Find one of the garden's octagonal ponds and describe what's floating or swimming in it, if anything.
  notes: ""
  form: "006_form_tuileries.yaml"
breadcrumb: |
  Continue east toward a glass pyramid — you can't miss it.
```

`007_loc_louvre_pyramid.yaml` (no form):
```yaml
title: "Glass Among Stone"
image: placeholder.jpg
name:
  label: ""
  value: "Louvre Pyramid"
address: "Rue de Rivoli, 75001 Paris"
coordinates:
  longitude: 2.3376
  latitude: 48.8606
storyline: |
  I. M. Pei's glass pyramid, completed in 1989, was controversial at the time for standing in front of a 12th-century palace. It's now one of the most photographed structures in Paris.
challenge:
  name: ""
  description: |
    Count how many smaller pyramids surround the main one.
  notes: ""
breadcrumb: |
  Follow the river downstream to the oldest bridge in Paris — despite its name.
```

`008_loc_pont_neuf.yaml` (form):
```yaml
title: "The 'New' Bridge"
image: placeholder.jpg
name:
  label: ""
  value: "Pont Neuf"
address: "Pont Neuf, 75001 Paris"
coordinates:
  longitude: 2.3412
  latitude: 48.8566
storyline: |
  Despite the name ("New Bridge"), this is the oldest standing bridge across the Seine, completed in 1607.
challenge:
  name: ""
  description: |
    Find one of the carved stone faces (mascarons) along the bridge's side and describe its expression.
  notes: ""
  form: "008_form_pont_neuf.yaml"
breadcrumb: |
  Continue downstream toward the cathedral on the island ahead.
```

`009_loc_notre_dame.yaml` (no form):
```yaml
title: "Still Standing"
image: placeholder.jpg
name:
  label: ""
  value: "Notre-Dame de Paris (exterior)"
address: "6 Parvis Notre-Dame - Place Jean-Paul II, 75004 Paris"
coordinates:
  longitude: 2.3499
  latitude: 48.8530
storyline: |
  Construction began in 1163. A 2019 fire destroyed the spire and roof, but the cathedral's towers and facade survived — this stop is exterior-only while restoration work continues nearby.
challenge:
  name: ""
  description: |
    Find the row of carved kings along the west facade and estimate how many there are.
  notes: ""
breadcrumb: |
  Cross to the small island just downstream — the last stop on this route.
```

`010_loc_ile_saint_louis.yaml` (form):
```yaml
title: "The Quiet Island"
image: placeholder.jpg
name:
  label: ""
  value: "Île Saint-Louis"
address: "Île Saint-Louis, 75004 Paris"
coordinates:
  longitude: 2.3565
  latitude: 48.8514
storyline: |
  Unlike its busier neighbor Île de la Cité, this island has stayed mostly residential since the 17th century — narrow streets, quiet quays, and a famous ice cream shop.
challenge:
  name: ""
  description: |
    Walk the length of the island's main street and note the name of any shop that catches your eye.
  notes: ""
  form: "010_form_ile_saint_louis.yaml"
breadcrumb: |
  This is the end of the Riverside Route — well done.
```

- [ ] **Step 3: Write the 5 forms for this route**

`002_form_trocadero.yaml`:
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

`004_form_grand_palais.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the glass roof from below
- id: entrance_count
  type: number
  label: How many entrance doors can you count on the main facade?
- id: current_use
  type: radio
  label: What does the building look like it's being used for right now?
  options:
    - An exhibition or art event
    - Renovation/construction
    - Nothing visible — closed
```

`006_form_tuileries.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the pond
- id: pond_life
  type: multiple
  label: What do you see in or around the pond?
  min: 0
  max: 3
  options:
    - Ducks or swans
    - People sailing toy boats
    - Fountains running
    - Nothing but water
- id: garden_notes
  type: textarea
  label: Describe the garden's layout in a sentence or two.
```

`008_form_pont_neuf.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of one of the carved stone faces
- id: face_expression
  type: string
  label: How would you describe the face's expression?
- id: bridge_side
  type: radio
  label: Which side of the bridge are you on?
  options:
    - Left Bank side
    - Right Bank side
```

`010_form_ile_saint_louis.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of your favorite shopfront on the island
- id: route_recap
  type: section
  label: Route recap
- id: enjoyed_route
  type: boolean
  label: Did you enjoy the Riverside Route?
- id: stops_completed
  type: number
  label: How many of the 10 stops did you actually visit in person?
```

- [ ] **Step 4: Commit**

```bash
git add src/data/text/en/projects/demo/paris/paris.yaml src/data/text/en/projects/demo/paris/00*_loc_*.yaml src/data/text/en/projects/demo/paris/00*_form_*.yaml src/data/text/en/projects/demo/paris/010_loc_*.yaml src/data/text/en/projects/demo/paris/010_form_*.yaml
git commit -m "feat: add Paris Riverside Route content"
```

---

### Task 3: Paris — Left Bank Route content

**Files:**
- Create: `src/data/text/en/projects/demo/paris/011_loc_musee_orsay.yaml` through `020_loc_institut_monde_arabe.yaml` (10 files)
- Create: `src/data/text/en/projects/demo/paris/012_form_saint_germain.yaml`, `014_form_pantheon.yaml`, `016_form_shakespeare_co.yaml`, `018_form_arenes_lutece.yaml`, `020_form_institut_monde_arabe.yaml` (5 files)

**Interfaces:** none.

- [ ] **Step 1: Write the 10 Left Bank Route locations**

`011_loc_musee_orsay.yaml` (no form):
```yaml
title: "A Train Station Turned Museum"
image: placeholder.jpg
name:
  label: ""
  value: "Musée d'Orsay"
address: "1 Rue de la Légion d'Honneur, 75007 Paris"
coordinates:
  longitude: 2.3266
  latitude: 48.8600
storyline: |
  Once a railway station, the Musée d'Orsay now holds one of the world's largest collections of Impressionist and Post-Impressionist art.
challenge:
  name: ""
  description: |
    Find the giant station clock inside and note what time it shows.
  notes: ""
breadcrumb: |
  Cross into the neighborhood of cafés and bookshops just south of here.
```

`012_loc_saint_germain.yaml` (form):
```yaml
title: "Existentialists and Espresso"
image: placeholder.jpg
name:
  label: ""
  value: "Saint-Germain-des-Prés"
address: "Place Saint-Germain-des-Prés, 75006 Paris"
coordinates:
  longitude: 2.3340
  latitude: 48.8539
storyline: |
  This neighborhood's cafés were once meeting places for philosophers and writers like Sartre and de Beauvoir.
challenge:
  name: ""
  description: |
    Find one of the neighborhood's famous cafés and note its name.
  notes: ""
  form: "012_form_saint_germain.yaml"
breadcrumb: |
  Head south toward the largest park on this side of the river.
```

`013_loc_luxembourg_gardens.yaml` (no form):
```yaml
title: "The Senate's Garden"
image: placeholder.jpg
name:
  label: ""
  value: "Luxembourg Gardens"
address: "Rue de Médicis - Rue de Vaugirard, 75006 Paris"
coordinates:
  longitude: 2.3372
  latitude: 48.8462
storyline: |
  These formal gardens surround the Luxembourg Palace, now home to the French Senate.
challenge:
  name: ""
  description: |
    Find the central octagonal pond and note what people are doing around it.
  notes: ""
breadcrumb: |
  Walk east toward a domed building on a hill.
```

`014_loc_pantheon.yaml` (form):
```yaml
title: "Where France Buries Its Great"
image: placeholder.jpg
name:
  label: ""
  value: "Panthéon"
address: "Place du Panthéon, 75005 Paris"
coordinates:
  longitude: 2.3464
  latitude: 48.8462
storyline: |
  Originally a church, the Panthéon now serves as a mausoleum for figures like Voltaire, Rousseau, and Marie Curie.
challenge:
  name: ""
  description: |
    Find the dome from outside and estimate its height in stories.
  notes: ""
  form: "014_form_pantheon.yaml"
breadcrumb: |
  Head downhill toward one of the world's oldest universities.
```

`015_loc_sorbonne.yaml` (no form):
```yaml
title: "800 Years of Students"
image: placeholder.jpg
name:
  label: ""
  value: "Sorbonne University"
address: "47 Rue des Écoles, 75005 Paris"
coordinates:
  longitude: 2.3438
  latitude: 48.8480
storyline: |
  Founded in 1257, the Sorbonne is one of the oldest universities in the world and gave its name to the surrounding student quarter.
challenge:
  name: ""
  description: |
    Find the main courtyard entrance and note what's carved above the door.
  notes: ""
breadcrumb: |
  Look for a famous English-language bookshop nearby.
```

`016_loc_shakespeare_co.yaml` (form):
```yaml
title: "A Bookshop With a Story"
image: placeholder.jpg
name:
  label: ""
  value: "Shakespeare and Company"
address: "37 Rue de la Bûcherie, 75005 Paris"
coordinates:
  longitude: 2.3470
  latitude: 48.8524
storyline: |
  This English-language bookshop has hosted generations of writers and still lets travelers sleep among the shelves in exchange for helping out.
challenge:
  name: ""
  description: |
    Find a book in the window display and note its title.
  notes: ""
  form: "016_form_shakespeare_co.yaml"
breadcrumb: |
  Wander into the market street just south of here.
```

`017_loc_rue_mouffetard.yaml` (no form):
```yaml
title: "One of Paris's Oldest Streets"
image: placeholder.jpg
name:
  label: ""
  value: "Rue Mouffetard"
address: "Rue Mouffetard, 75005 Paris"
coordinates:
  longitude: 2.3499
  latitude: 48.8434
storyline: |
  This winding market street follows a Roman road and has been a marketplace for centuries.
challenge:
  name: ""
  description: |
    Find a food stall or shop selling something you don't recognize and note what it is.
  notes: ""
breadcrumb: |
  Look for a hidden Roman ruin a few streets away.
```

`018_loc_arenes_lutece.yaml` (form):
```yaml
title: "A Roman Arena Hidden in Plain Sight"
image: placeholder.jpg
name:
  label: ""
  value: "Arènes de Lutèce"
address: "49 Rue Monge, 75005 Paris"
coordinates:
  longitude: 2.3532
  latitude: 48.8447
storyline: |
  This 1st-century Roman amphitheater once seated 15,000 people and was rediscovered — partly buried — in the 19th century.
challenge:
  name: ""
  description: |
    Stand in the center of the arena and note what it's being used for today.
  notes: ""
  form: "018_form_arenes_lutece.yaml"
breadcrumb: |
  Head toward the botanical garden nearby.
```

`019_loc_jardin_des_plantes.yaml` (no form):
```yaml
title: "Paris's Botanical Garden"
image: placeholder.jpg
name:
  label: ""
  value: "Jardin des Plantes"
address: "57 Rue Cuvier, 75005 Paris"
coordinates:
  longitude: 2.3590
  latitude: 48.8440
storyline: |
  Founded in 1626 as a royal medicinal garden, it now includes a botanical garden, several museums, and a small zoo.
challenge:
  name: ""
  description: |
    Find the garden's oldest tree, planted in the 1600s, if you can locate its marker.
  notes: ""
breadcrumb: |
  End this route at a striking modern building along the river.
```

`020_loc_institut_monde_arabe.yaml` (form):
```yaml
title: "A Building That Breathes"
image: placeholder.jpg
name:
  label: ""
  value: "Institut du Monde Arabe"
address: "1 Rue des Fossés Saint-Bernard, 75005 Paris"
coordinates:
  longitude: 2.3568
  latitude: 48.8467
storyline: |
  This building's south facade is covered in hundreds of mechanical apertures inspired by traditional lattice screens, which open and close to control light.
challenge:
  name: ""
  description: |
    Find the mechanical facade and describe the pattern it makes.
  notes: ""
  form: "020_form_institut_monde_arabe.yaml"
breadcrumb: |
  This is the end of the Left Bank Route.
```

- [ ] **Step 2: Write the 5 forms for this route**

`012_form_saint_germain.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the café
- id: cafe_open
  type: boolean
  label: Was the café open?
- id: cafe_name
  type: string
  label: What was the café's name?
```

`014_form_pantheon.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the dome
- id: dome_height_guess
  type: number
  label: How many stories tall would you guess the dome is?
- id: weather
  type: radio
  label: What's the weather like right now?
  options:
    - Clear/sunny
    - Cloudy
    - Rainy
```

`016_form_shakespeare_co.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the window display
- id: window_books
  type: multiple
  label: What kind of books do you see in the window?
  min: 0
  max: 3
  options:
    - Fiction
    - Poetry
    - History
    - Something else
- id: shop_notes
  type: textarea
  label: Describe the shopfront in a sentence or two.
```

`018_form_arenes_lutece.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the arena
- id: current_activity
  type: string
  label: What is the arena being used for right now (sports, sitting, nothing)?
- id: arena_side
  type: radio
  label: Which part of the arena are you standing in?
  options:
    - The stands (seating area)
    - The central floor
```

`020_form_institut_monde_arabe.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the mechanical facade
- id: route_recap
  type: section
  label: Route recap
- id: enjoyed_route
  type: boolean
  label: Did you enjoy the Left Bank Route?
- id: stops_completed
  type: number
  label: How many of the 10 stops did you actually visit in person?
```

- [ ] **Step 3: Commit**

```bash
git add src/data/text/en/projects/demo/paris/01*_loc_*.yaml src/data/text/en/projects/demo/paris/01*_form_*.yaml src/data/text/en/projects/demo/paris/020_loc_*.yaml src/data/text/en/projects/demo/paris/020_form_*.yaml
git commit -m "feat: add Paris Left Bank Route content"
```

---

### Task 4: Paris — Montmartre Route content + `paris/routes.yaml`

**Files:**
- Create: `src/data/text/en/projects/demo/paris/021_loc_sacre_coeur.yaml` through `030_loc_galeries_lafayette.yaml` (10 files)
- Create: `src/data/text/en/projects/demo/paris/022_form_place_du_tertre.yaml`, `024_form_musee_montmartre.yaml`, `026_form_arc_de_triomphe.yaml`, `028_form_place_vendome.yaml`, `030_form_galeries_lafayette.yaml` (5 files)
- Create: `src/data/text/en/projects/demo/paris/routes.yaml`

**Interfaces:** none. This task also produces `paris/routes.yaml`, which references all 30 location ids created across Tasks 2–4.

- [ ] **Step 1: Write the 10 Montmartre Route locations**

`021_loc_sacre_coeur.yaml` (no form):
```yaml
title: "The White Basilica on the Hill"
image: placeholder.jpg
name:
  label: ""
  value: "Sacré-Cœur Basilica"
address: "35 Rue du Chevalier de la Barre, 75018 Paris"
coordinates:
  longitude: 2.3431
  latitude: 48.8867
storyline: |
  Completed in 1914, this basilica sits atop Montmartre — the highest point in Paris — and offers a sweeping view over the whole city.
challenge:
  name: ""
  description: |
    Find the steps in front of the basilica and count how many people are sitting on them.
  notes: ""
breadcrumb: |
  Walk into the small square just behind the basilica.
```

`022_loc_place_du_tertre.yaml` (form):
```yaml
title: "The Artists' Square"
image: placeholder.jpg
name:
  label: ""
  value: "Place du Tertre"
address: "Place du Tertre, 75018 Paris"
coordinates:
  longitude: 2.3407
  latitude: 48.8867
storyline: |
  This small square has been a gathering place for painters since the late 1800s and is still full of working artists today.
challenge:
  name: ""
  description: |
    Find an artist at work and note what they're painting or drawing.
  notes: ""
  form: "022_form_place_du_tertre.yaml"
breadcrumb: |
  Head downhill toward a famous red windmill.
```

`023_loc_moulin_rouge.yaml` (no form):
```yaml
title: "The Red Windmill"
image: placeholder.jpg
name:
  label: ""
  value: "Moulin Rouge"
address: "82 Boulevard de Clichy, 75018 Paris"
coordinates:
  longitude: 2.3322
  latitude: 48.8841
storyline: |
  Opened in 1889, this cabaret is famous for popularizing the modern form of the can-can dance.
challenge:
  name: ""
  description: |
    Find the red windmill sails and note how many blades you can count.
  notes: ""
breadcrumb: |
  Head back uphill toward a small museum dedicated to the neighborhood's artists.
```

`024_loc_musee_montmartre.yaml` (form):
```yaml
title: "Where the Painters Lived"
image: placeholder.jpg
name:
  label: ""
  value: "Musée de Montmartre"
address: "12 Rue Cortot, 75018 Paris"
coordinates:
  longitude: 2.3407
  latitude: 48.8875
storyline: |
  Housed in the oldest building in Montmartre, this museum occupies a former studio used by Renoir and other painters.
challenge:
  name: ""
  description: |
    Find the museum's garden and note what's growing in it.
  notes: ""
  form: "024_form_musee_montmartre.yaml"
breadcrumb: |
  Head to the cemetery a short walk downhill.
```

`025_loc_cimetiere_montmartre.yaml` (no form):
```yaml
title: "A Cemetery of Artists"
image: placeholder.jpg
name:
  label: ""
  value: "Cimetière de Montmartre"
address: "20 Avenue Rachel, 75018 Paris"
coordinates:
  longitude: 2.3297
  latitude: 48.8867
storyline: |
  This cemetery is the resting place of many painters, writers, and musicians who once lived in Montmartre.
challenge:
  name: ""
  description: |
    Find the cemetery's entrance gate and note what's carved or written on it.
  notes: ""
breadcrumb: |
  Head south toward a monumental arch.
```

`026_loc_arc_de_triomphe.yaml` (form):
```yaml
title: "Napoleon's Arch"
image: placeholder.jpg
name:
  label: ""
  value: "Arc de Triomphe"
address: "Place Charles de Gaulle, 75008 Paris"
coordinates:
  longitude: 2.2950
  latitude: 48.8738
storyline: |
  Commissioned by Napoleon in 1806, the arch honors those who fought for France and now sits at the center of twelve converging avenues.
challenge:
  name: ""
  description: |
    Count how many avenues you can see radiating out from the arch's traffic circle.
  notes: ""
  form: "026_form_arc_de_triomphe.yaml"
breadcrumb: |
  Walk down the wide avenue leading away from the arch.
```

`027_loc_champs_elysees.yaml` (no form):
```yaml
title: "The Most Beautiful Avenue in the World"
image: placeholder.jpg
name:
  label: ""
  value: "Champs-Élysées"
address: "Avenue des Champs-Élysées, 75008 Paris"
coordinates:
  longitude: 2.3078
  latitude: 48.8698
storyline: |
  This avenue has been a place for parades, protests, and shopping since the 19th century, and hosts the finish line of the Tour de France.
challenge:
  name: ""
  description: |
    Find a flagship store you recognize and note its name.
  notes: ""
breadcrumb: |
  Turn toward a square known for its jewelers.
```

`028_loc_place_vendome.yaml` (form):
```yaml
title: "The Jewelers' Square"
image: placeholder.jpg
name:
  label: ""
  value: "Place Vendôme"
address: "Place Vendôme, 75001 Paris"
coordinates:
  longitude: 2.3291
  latitude: 48.8683
storyline: |
  This elegant square is home to some of the world's most famous jewelry and watch houses, and a column built from melted-down cannons.
challenge:
  name: ""
  description: |
    Find the central column and note what statue stands on top of it.
  notes: ""
  form: "028_form_place_vendome.yaml"
breadcrumb: |
  Head toward the ornate opera house nearby.
```

`029_loc_opera_garnier.yaml` (no form):
```yaml
title: "The Phantom's Opera House"
image: placeholder.jpg
name:
  label: ""
  value: "Opéra Garnier"
address: "Place de l'Opéra, 75009 Paris"
coordinates:
  longitude: 2.3316
  latitude: 48.8719
storyline: |
  Completed in 1875, this opulent opera house inspired the setting for "The Phantom of the Opera" and still hosts ballet and opera performances.
challenge:
  name: ""
  description: |
    Find the facade's sculptures and note one figure you can identify.
  notes: ""
breadcrumb: |
  Finish this route at a department store with a famous rooftop view.
```

`030_loc_galeries_lafayette.yaml` (form):
```yaml
title: "Shopping Under a Dome"
image: placeholder.jpg
name:
  label: ""
  value: "Galeries Lafayette rooftop"
address: "40 Boulevard Haussmann, 75009 Paris"
coordinates:
  longitude: 2.3323
  latitude: 48.8737
storyline: |
  This department store's stained-glass dome is a Paris landmark in its own right, and its rooftop terrace offers a free view over the city.
challenge:
  name: ""
  description: |
    Ride to the rooftop terrace and note which landmark from earlier in this route you can spot from up here.
  notes: ""
  form: "030_form_galeries_lafayette.yaml"
breadcrumb: |
  This is the end of the Montmartre Route — and of all three Paris routes.
```

- [ ] **Step 2: Write the 5 forms for this route**

`022_form_place_du_tertre.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of an artist at work
- id: artist_present
  type: boolean
  label: Was at least one artist actively painting?
- id: subject_matter
  type: string
  label: What were they painting or drawing?
```

`024_form_musee_montmartre.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the garden
- id: garden_plant_count
  type: number
  label: Roughly how many distinct types of plants can you see?
- id: garden_season
  type: radio
  label: How would you describe the garden right now?
  options:
    - In full bloom
    - Green but not flowering
    - Bare/wintering
```

`026_form_arc_de_triomphe.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the arch
- id: visible_avenues
  type: multiple
  label: How many avenues can you count radiating from the circle?
  min: 1
  max: 3
  options:
    - "Fewer than 6"
    - "6 to 10"
    - "More than 10"
- id: arch_notes
  type: textarea
  label: Describe the carvings on the arch in a sentence or two.
```

`028_form_place_vendome.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the column
- id: column_top
  type: string
  label: What's on top of the column?
- id: storefronts
  type: radio
  label: What kind of storefronts dominate the square?
  options:
    - Jewelry/watches
    - Fashion
    - Hotels
```

`030_form_galeries_lafayette.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the view from the rooftop
- id: route_recap
  type: section
  label: Route recap
- id: enjoyed_route
  type: boolean
  label: Did you enjoy the Montmartre Route?
- id: stops_completed
  type: number
  label: How many of the 10 stops did you actually visit in person?
```

- [ ] **Step 3: Write `paris/routes.yaml`**

```yaml
riverside_route:
  description: "A route along the Seine through the Eiffel Tower, Louvre, and Notre-Dame — 10 stops."
  locations:
    - 001_loc_eiffel_tower
    - 002_loc_trocadero
    - 003_loc_pont_alexandre
    - 004_loc_grand_palais
    - 005_loc_place_concorde
    - 006_loc_tuileries
    - 007_loc_louvre_pyramid
    - 008_loc_pont_neuf
    - 009_loc_notre_dame
    - 010_loc_ile_saint_louis

left_bank_route:
  description: "A route through the Left Bank's museums, university quarter, and bookshops — 10 stops."
  locations:
    - 011_loc_musee_orsay
    - 012_loc_saint_germain
    - 013_loc_luxembourg_gardens
    - 014_loc_pantheon
    - 015_loc_sorbonne
    - 016_loc_shakespeare_co
    - 017_loc_rue_mouffetard
    - 018_loc_arenes_lutece
    - 019_loc_jardin_des_plantes
    - 020_loc_institut_monde_arabe

montmartre_route:
  description: "A route up to Montmartre's hilltop basilica and back down the Champs-Élysées — 10 stops."
  locations:
    - 021_loc_sacre_coeur
    - 022_loc_place_du_tertre
    - 023_loc_moulin_rouge
    - 024_loc_musee_montmartre
    - 025_loc_cimetiere_montmartre
    - 026_loc_arc_de_triomphe
    - 027_loc_champs_elysees
    - 028_loc_place_vendome
    - 029_loc_opera_garnier
    - 030_loc_galeries_lafayette
```

- [ ] **Step 4: Validate all of Paris**

Run: `npm run validate:yaml`
Expected: exits 0 — all 30 Paris location files, 15 form files, and `routes.yaml` pass schema validation.

- [ ] **Step 5: Commit**

```bash
git add src/data/text/en/projects/demo/paris/02*_loc_*.yaml src/data/text/en/projects/demo/paris/02*_form_*.yaml src/data/text/en/projects/demo/paris/030_loc_*.yaml src/data/text/en/projects/demo/paris/030_form_*.yaml src/data/text/en/projects/demo/paris/routes.yaml
git commit -m "feat: add Paris Montmartre Route content and paris/routes.yaml"
```

---

### Task 5: New York — Manhattan Route content

**Files:**
- Create: `src/data/text/en/projects/demo/new_york/new_york.yaml`
- Create: `src/data/text/en/projects/demo/new_york/001_loc_times_square.yaml` through `010_loc_one_wtc.yaml` (10 files)
- Create: `src/data/text/en/projects/demo/new_york/002_form_rockefeller_center.yaml`, `004_form_grand_central.yaml`, `006_form_empire_state.yaml`, `008_form_union_square.yaml`, `010_form_one_wtc.yaml` (5 files)

**Interfaces:** none.

- [ ] **Step 1: Write `new_york.yaml`**

```yaml
city.title: "New York"
city.country: "United States"
city.tagline: "Three routes, thirty landmarks"
city.description: |
  A demo route through Manhattan and Brooklyn's best-known sights, used to test every part of the app: navigation, all eight question types, photo upload, and the gallery.
```

- [ ] **Step 2: Write the 10 Manhattan Route locations**

`001_loc_times_square.yaml` (no form):
```yaml
title: "The Crossroads of the World"
image: placeholder.jpg
name:
  label: ""
  value: "Times Square"
address: "Times Square, Manhattan, NY 10036"
coordinates:
  longitude: -73.9855
  latitude: 40.7580
storyline: |
  Named for the New York Times building that once stood here, Times Square is famous for its towering electronic billboards and New Year's Eve ball drop.
challenge:
  name: ""
  description: |
    Count how many electronic billboards you can see from where you're standing.
  notes: ""
breadcrumb: |
  Walk a few blocks to a plaza with a golden statue and a famous skating rink.
```

`002_loc_rockefeller_center.yaml` (form):
```yaml
title: "Skating Under Gold"
image: placeholder.jpg
name:
  label: ""
  value: "Rockefeller Center"
address: "45 Rockefeller Plaza, New York, NY 10111"
coordinates:
  longitude: -73.9787
  latitude: 40.7587
storyline: |
  Built during the Great Depression, this complex hosts the city's famous Christmas tree and an ice rink that's open most of the year.
challenge:
  name: ""
  description: |
    Find the golden statue overlooking the plaza and note who it depicts, if you can tell.
  notes: ""
  form: "002_form_rockefeller_center.yaml"
breadcrumb: |
  Head a block east to a cathedral with twin spires.
```

`003_loc_st_patricks.yaml` (no form):
```yaml
title: "Twin Spires on Fifth Avenue"
image: placeholder.jpg
name:
  label: ""
  value: "St. Patrick's Cathedral"
address: "5th Ave, New York, NY 10022"
coordinates:
  longitude: -73.9759
  latitude: 40.7585
storyline: |
  Completed in 1878, this is the largest Gothic Revival Catholic cathedral in North America, wedged between Fifth Avenue's shops.
challenge:
  name: ""
  description: |
    Find the cathedral's front doors and count how many steps lead up to them.
  notes: ""
breadcrumb: |
  Head south toward a train station with a famous ceiling.
```

`004_loc_grand_central.yaml` (form):
```yaml
title: "A Ceiling Full of Stars"
image: placeholder.jpg
name:
  label: ""
  value: "Grand Central Terminal"
address: "89 E 42nd St, New York, NY 10017"
coordinates:
  longitude: -73.9772
  latitude: 40.7527
storyline: |
  Grand Central's main concourse ceiling is painted with a mural of the night sky — though famously painted backwards, showing the constellations mirror-reversed.
challenge:
  name: ""
  description: |
    Stand in the main concourse and look up — find the famous four-faced clock above the information booth.
  notes: ""
  form: "004_form_grand_central.yaml"
breadcrumb: |
  Walk a few blocks to a library guarded by two stone lions.
```

`005_loc_nypl.yaml` (no form):
```yaml
title: "Patience and Fortitude"
image: placeholder.jpg
name:
  label: ""
  value: "New York Public Library"
address: "476 5th Ave, New York, NY 10018"
coordinates:
  longitude: -73.9822
  latitude: 40.7532
storyline: |
  The two marble lions guarding the library's entrance are nicknamed "Patience" and "Fortitude," names given by Mayor Fiorello La Guardia during the Great Depression.
challenge:
  name: ""
  description: |
    Find the two lion statues and note which one is on the north side.
  notes: ""
breadcrumb: |
  Head toward the tallest building on this route.
```

`006_loc_empire_state.yaml` (form):
```yaml
title: "King of the Skyline"
image: placeholder.jpg
name:
  label: ""
  value: "Empire State Building"
address: "20 W 34th St, New York, NY 10001"
coordinates:
  longitude: -73.9857
  latitude: 40.7484
storyline: |
  Completed in 1931 in just over a year, the Empire State Building held the title of world's tallest building for nearly 40 years.
challenge:
  name: ""
  description: |
    Stand at the base and look straight up — describe what the top of the building looks like from here.
  notes: ""
  form: "006_form_empire_state.yaml"
breadcrumb: |
  Head south toward a triangular building.
```

`007_loc_flatiron.yaml` (no form):
```yaml
title: "The Building Shaped Like an Iron"
image: placeholder.jpg
name:
  label: ""
  value: "Flatiron Building"
address: "175 5th Ave, New York, NY 10010"
coordinates:
  longitude: -73.9897
  latitude: 40.7411
storyline: |
  Completed in 1902, this triangular building's unusual shape comes from the sharp intersection of Fifth Avenue and Broadway.
challenge:
  name: ""
  description: |
    Find the building's narrowest point and estimate how wide it is.
  notes: ""
breadcrumb: |
  Continue south to a park with a famous farmers market.
```

`008_loc_union_square.yaml` (form):
```yaml
title: "A Park With a Market"
image: placeholder.jpg
name:
  label: ""
  value: "Union Square"
address: "Union Square, New York, NY 10003"
coordinates:
  longitude: -73.9911
  latitude: 40.7359
storyline: |
  Union Square has long been a gathering place for protests, markets, and public speeches, and still hosts a large greenmarket several days a week.
challenge:
  name: ""
  description: |
    Find the statue of George Washington on horseback in the square.
  notes: ""
  form: "008_form_union_square.yaml"
breadcrumb: |
  Head further south to a park with a famous arch.
```

`009_loc_washington_square.yaml` (no form):
```yaml
title: "The Village's Living Room"
image: placeholder.jpg
name:
  label: ""
  value: "Washington Square Park"
address: "Washington Square, New York, NY 10012"
coordinates:
  longitude: -73.9973
  latitude: 40.7308
storyline: |
  This park's marble arch, modeled after the Arc de Triomphe, has marked the entrance to Greenwich Village since 1892.
challenge:
  name: ""
  description: |
    Find the central fountain and note whether it's running.
  notes: ""
breadcrumb: |
  Finish this route downtown, at the tallest building in the city.
```

`010_loc_one_wtc.yaml` (form):
```yaml
title: "Freedom Tower"
image: placeholder.jpg
name:
  label: ""
  value: "One World Trade Center"
address: "285 Fulton St, New York, NY 10007"
coordinates:
  longitude: -74.0134
  latitude: 40.7127
storyline: |
  Standing 1,776 feet tall — a height chosen to reference the year of American independence — One World Trade Center is the tallest building in the Western Hemisphere.
challenge:
  name: ""
  description: |
    Look up at the building's spire and note its shape compared to the rest of the tower.
  notes: ""
  form: "010_form_one_wtc.yaml"
breadcrumb: |
  This is the end of the Manhattan Route.
```

- [ ] **Step 3: Write the 5 forms for this route**

`002_form_rockefeller_center.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the plaza
- id: rink_open
  type: boolean
  label: Is the ice rink open/in use right now?
- id: statue_figure
  type: string
  label: Who does the golden statue depict?
```

`004_form_grand_central.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the ceiling mural
- id: clock_faces_visible
  type: number
  label: How many of the clock's four faces can you see from where you're standing?
- id: concourse_busy
  type: radio
  label: How busy is the main concourse right now?
  options:
    - Very crowded
    - Moderately busy
    - Nearly empty
```

`006_form_empire_state.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo looking straight up at the building
- id: visible_features
  type: multiple
  label: What can you see from the base?
  min: 0
  max: 3
  options:
    - The antenna/spire
    - Setback terraces
    - Lit-up windows
- id: building_notes
  type: textarea
  label: Describe the building's facade in a sentence or two.
```

`008_form_union_square.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the statue or market
- id: market_present
  type: string
  label: Is the greenmarket set up today? Describe what's for sale if so.
- id: square_activity
  type: radio
  label: What's the square mostly being used for right now?
  options:
    - Market/shopping
    - Skateboarding/recreation
    - Just passing through
```

`010_form_one_wtc.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the tower's spire
- id: route_recap
  type: section
  label: Route recap
- id: enjoyed_route
  type: boolean
  label: Did you enjoy the Manhattan Route?
- id: stops_completed
  type: number
  label: How many of the 10 stops did you actually visit in person?
```

- [ ] **Step 4: Commit**

```bash
git add src/data/text/en/projects/demo/new_york/new_york.yaml src/data/text/en/projects/demo/new_york/00*_loc_*.yaml src/data/text/en/projects/demo/new_york/00*_form_*.yaml src/data/text/en/projects/demo/new_york/010_loc_*.yaml src/data/text/en/projects/demo/new_york/010_form_*.yaml
git commit -m "feat: add New York Manhattan Route content"
```

---

### Task 6: New York — Museums & Parks Route content

**Files:**
- Create: `src/data/text/en/projects/demo/new_york/011_loc_central_park_mall.yaml` through `020_loc_bryant_park.yaml` (10 files)
- Create: `src/data/text/en/projects/demo/new_york/012_form_bethesda_terrace.yaml`, `014_form_amnh.yaml`, `016_form_belvedere_castle.yaml`, `018_form_lincoln_center.yaml`, `020_form_bryant_park.yaml` (5 files)

**Interfaces:** none.

- [ ] **Step 1: Write the 10 Museums & Parks Route locations**

`011_loc_central_park_mall.yaml` (no form):
```yaml
title: "The Park's Grand Promenade"
image: placeholder.jpg
name:
  label: ""
  value: "Central Park (The Mall)"
address: "The Mall, Central Park, New York, NY 10024"
coordinates:
  longitude: -73.9724
  latitude: 40.7712
storyline: |
  This straight, tree-lined promenade is one of the only formal, symmetrical parts of Central Park's otherwise naturalistic design.
challenge:
  name: ""
  description: |
    Walk the length of the Mall and count how many street performers or musicians you pass.
  notes: ""
breadcrumb: |
  Head north toward a terrace overlooking a lake.
```

`012_loc_bethesda_terrace.yaml` (form):
```yaml
title: "The Angel of the Waters"
image: placeholder.jpg
name:
  label: ""
  value: "Bethesda Terrace"
address: "Central Park, New York, NY 10024"
coordinates:
  longitude: -73.9701
  latitude: 40.7735
storyline: |
  This terrace's fountain, topped by the "Angel of the Waters" statue, was one of the first public artworks by a woman in New York City.
challenge:
  name: ""
  description: |
    Find the fountain and note what the angel statue is holding.
  notes: ""
  form: "012_form_bethesda_terrace.yaml"
breadcrumb: |
  Head to the museum with the grand staircase, on the park's east side.
```

`013_loc_met.yaml` (no form):
```yaml
title: "The Met"
image: placeholder.jpg
name:
  label: ""
  value: "Metropolitan Museum of Art"
address: "1000 5th Ave, New York, NY 10028"
coordinates:
  longitude: -73.9632
  latitude: 40.7794
storyline: |
  One of the largest art museums in the world, the Met's collection spans 5,000 years of human creativity.
challenge:
  name: ""
  description: |
    Find the museum's front steps and note how many people are sitting on them.
  notes: ""
breadcrumb: |
  Cross the park to a museum famous for its dinosaurs and blue whale.
```

`014_loc_amnh.yaml` (form):
```yaml
title: "Dinosaurs and a Blue Whale"
image: placeholder.jpg
name:
  label: ""
  value: "American Museum of Natural History"
address: "200 Central Park West, New York, NY 10024"
coordinates:
  longitude: -73.9740
  latitude: 40.7813
storyline: |
  This museum's Hall of Ocean Life features a 94-foot model of a blue whale suspended from the ceiling.
challenge:
  name: ""
  description: |
    Find the museum's main entrance on Central Park West and note what statue stands in front.
  notes: ""
  form: "014_form_amnh.yaml"
breadcrumb: |
  Head back into the park toward a memorial for a famous musician.
```

`015_loc_strawberry_fields.yaml` (no form):
```yaml
title: "Imagine"
image: placeholder.jpg
name:
  label: ""
  value: "Strawberry Fields"
address: "Central Park West & 72nd St, New York, NY 10023"
coordinates:
  longitude: -73.9755
  latitude: 40.7756
storyline: |
  This quiet memorial, named after a Beatles song, honors John Lennon, who lived nearby and was killed in 1980.
challenge:
  name: ""
  description: |
    Find the "IMAGINE" mosaic set into the pavement.
  notes: ""
breadcrumb: |
  Head north to a stone tower with a view over the park.
```

`016_loc_belvedere_castle.yaml` (form):
```yaml
title: "A Tiny Castle in the Park"
image: placeholder.jpg
name:
  label: ""
  value: "Belvedere Castle"
address: "Central Park, New York, NY 10024"
coordinates:
  longitude: -73.9691
  latitude: 40.7794
storyline: |
  This small Victorian folly, built in 1869, sits atop the park's second-highest natural point and houses an official weather station.
challenge:
  name: ""
  description: |
    Climb to the highest point you can reach and describe the view.
  notes: ""
  form: "016_form_belvedere_castle.yaml"
breadcrumb: |
  Exit the park at the traffic circle to the southwest.
```

`017_loc_columbus_circle.yaml` (no form):
```yaml
title: "Where Manhattan's Streets Meet"
image: placeholder.jpg
name:
  label: ""
  value: "Columbus Circle"
address: "Columbus Circle, New York, NY 10019"
coordinates:
  longitude: -73.9819
  latitude: 40.7681
storyline: |
  This traffic circle, marking the official center point from which distances to New York City are measured, is topped by a statue of Christopher Columbus.
challenge:
  name: ""
  description: |
    Find the column and note how tall the statue on top looks compared to the buildings around it.
  notes: ""
breadcrumb: |
  Head to the performing arts complex a short walk north.
```

`018_loc_lincoln_center.yaml` (form):
```yaml
title: "Fountains and the Arts"
image: placeholder.jpg
name:
  label: ""
  value: "Lincoln Center"
address: "10 Lincoln Center Plaza, New York, NY 10023"
coordinates:
  longitude: -73.9835
  latitude: 40.7725
storyline: |
  This performing arts complex is home to the Metropolitan Opera, New York Philharmonic, and New York City Ballet, arranged around a central plaza fountain.
challenge:
  name: ""
  description: |
    Find the central plaza fountain and note whether it's running.
  notes: ""
  form: "018_form_lincoln_center.yaml"
breadcrumb: |
  Head south to a museum known simply by its initials.
```

`019_loc_moma.yaml` (no form):
```yaml
title: "MoMA"
image: placeholder.jpg
name:
  label: ""
  value: "Museum of Modern Art (MoMA)"
address: "11 W 53rd St, New York, NY 10019"
coordinates:
  longitude: -73.9776
  latitude: 40.7614
storyline: |
  MoMA's collection includes some of the most famous works of modern art in the world, including van Gogh's "The Starry Night."
challenge:
  name: ""
  description: |
    Find the museum's entrance and note the color and material of its facade.
  notes: ""
breadcrumb: |
  Finish this route at a quiet park behind the public library.
```

`020_loc_bryant_park.yaml` (form):
```yaml
title: "The Library's Backyard"
image: placeholder.jpg
name:
  label: ""
  value: "Bryant Park"
address: "Bryant Park, New York, NY 10018"
coordinates:
  longitude: -73.9832
  latitude: 40.7536
storyline: |
  Once a run-down and unsafe park in the 1970s and 80s, Bryant Park was redesigned in the 1990s and is now one of the city's most popular green spaces.
challenge:
  name: ""
  description: |
    Find the park's central lawn and note what people are doing on it.
  notes: ""
  form: "020_form_bryant_park.yaml"
breadcrumb: |
  This is the end of the Museums & Parks Route.
```

- [ ] **Step 2: Write the 5 forms for this route**

`012_form_bethesda_terrace.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the fountain
- id: fountain_running
  type: boolean
  label: Is the fountain running?
- id: angel_holding
  type: string
  label: What is the angel statue holding?
```

`014_form_amnh.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the entrance
- id: statue_out_front
  type: number
  label: How many statues can you count near the entrance?
- id: entrance_side
  type: radio
  label: Which entrance are you at?
  options:
    - Central Park West (main)
    - Columbus Avenue
```

`016_form_belvedere_castle.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the view from the castle
- id: visible_landmarks
  type: multiple
  label: What can you see from up here?
  min: 0
  max: 3
  options:
    - The lake/pond below
    - Skyscrapers beyond the park
    - The Great Lawn
- id: view_notes
  type: textarea
  label: Describe the view in a sentence or two.
```

`018_form_lincoln_center.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the plaza fountain
- id: fountain_state
  type: string
  label: Describe the fountain's current state (running, still, decorated, etc).
- id: buildings_visible
  type: radio
  label: How many performance halls can you see from the plaza?
  options:
    - "1"
    - "2"
    - "3 or more"
```

`020_form_bryant_park.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the central lawn
- id: route_recap
  type: section
  label: Route recap
- id: enjoyed_route
  type: boolean
  label: Did you enjoy the Museums & Parks Route?
- id: stops_completed
  type: number
  label: How many of the 10 stops did you actually visit in person?
```

- [ ] **Step 3: Commit**

```bash
git add src/data/text/en/projects/demo/new_york/01*_loc_*.yaml src/data/text/en/projects/demo/new_york/01*_form_*.yaml src/data/text/en/projects/demo/new_york/020_loc_*.yaml src/data/text/en/projects/demo/new_york/020_form_*.yaml
git commit -m "feat: add New York Museums & Parks Route content"
```

---

### Task 7: New York — Brooklyn Route content + `new_york/routes.yaml`

**Files:**
- Create: `src/data/text/en/projects/demo/new_york/021_loc_brooklyn_bridge.yaml` through `030_loc_coney_island.yaml` (10 files)
- Create: `src/data/text/en/projects/demo/new_york/022_form_south_street_seaport.yaml`, `024_form_dumbo.yaml`, `026_form_domino_park.yaml`, `028_form_prospect_park.yaml`, `030_form_coney_island.yaml` (5 files)
- Create: `src/data/text/en/projects/demo/new_york/routes.yaml`

**Interfaces:** none. This task also produces `new_york/routes.yaml`, referencing all 30 New York location ids created across Tasks 5–7.

- [ ] **Step 1: Write the 10 Brooklyn Route locations**

`021_loc_brooklyn_bridge.yaml` (no form):
```yaml
title: "The Bridge That Took 14 Years"
image: placeholder.jpg
name:
  label: ""
  value: "Brooklyn Bridge (Manhattan side)"
address: "Brooklyn Bridge, New York, NY 10038"
coordinates:
  longitude: -73.9969
  latitude: 40.7061
storyline: |
  Completed in 1883 after 14 years of construction, the Brooklyn Bridge was the longest suspension bridge in the world at the time.
challenge:
  name: ""
  description: |
    Find the pedestrian walkway entrance and count how many of the bridge's stone towers you can see from here.
  notes: ""
breadcrumb: |
  Head to the historic seaport just south of the bridge.
```

`022_loc_south_street_seaport.yaml` (form):
```yaml
title: "Tall Ships and Cobblestones"
image: placeholder.jpg
name:
  label: ""
  value: "South Street Seaport"
address: "19 Fulton St, New York, NY 10038"
coordinates:
  longitude: -74.0021
  latitude: 40.7075
storyline: |
  This historic district preserves some of Manhattan's oldest cobblestone streets and once served as the city's main seaport in the 1800s.
challenge:
  name: ""
  description: |
    Find a historic ship docked at the pier and note its name.
  notes: ""
  form: "022_form_south_street_seaport.yaml"
breadcrumb: |
  Cross the bridge into Brooklyn and head to the park underneath it.
```

`023_loc_brooklyn_bridge_park.yaml` (no form):
```yaml
title: "A Park Built on Old Piers"
image: placeholder.jpg
name:
  label: ""
  value: "Brooklyn Bridge Park"
address: "334 Furman St, Brooklyn, NY 11201"
coordinates:
  longitude: -73.9967
  latitude: 40.7024
storyline: |
  Built on a series of former shipping piers, this park offers some of the best views of the Manhattan skyline from across the river.
challenge:
  name: ""
  description: |
    Find a spot with a clear view of Manhattan and count how many bridges you can see.
  notes: ""
breadcrumb: |
  Walk into the cobblestone neighborhood just north of here.
```

`024_loc_dumbo.yaml` (form):
```yaml
title: "Down Under the Manhattan Bridge Overpass"
image: placeholder.jpg
name:
  label: ""
  value: "DUMBO"
address: "Washington St, Brooklyn, NY 11201"
coordinates:
  longitude: -73.9903
  latitude: 40.7033
storyline: |
  DUMBO's name is an acronym for its location, and its cobblestone streets frame one of the most photographed views of the Manhattan Bridge in the city.
challenge:
  name: ""
  description: |
    Stand on Washington Street and find the famous framed view of the bridge between the buildings.
  notes: ""
  form: "024_form_dumbo.yaml"
breadcrumb: |
  Walk south along the water to a quiet promenade.
```

`025_loc_brooklyn_heights_promenade.yaml` (no form):
```yaml
title: "Brooklyn's Balcony"
image: placeholder.jpg
name:
  label: ""
  value: "Brooklyn Heights Promenade"
address: "Brooklyn Heights Promenade, Brooklyn, NY 11201"
coordinates:
  longitude: -73.9967
  latitude: 40.6969
storyline: |
  This elevated walkway offers unobstructed views of the Manhattan skyline and sits above a highway that runs underneath it.
challenge:
  name: ""
  description: |
    Find a bench along the promenade and note what's directly across the water from it.
  notes: ""
breadcrumb: |
  Head north along the water to a park known for its sunset views.
```

`026_loc_domino_park.yaml` (form):
```yaml
title: "A Sugar Factory Turned Park"
image: placeholder.jpg
name:
  label: ""
  value: "Domino Park"
address: "300 Kent Ave, Brooklyn, NY 11249"
coordinates:
  longitude: -73.9635
  latitude: 40.7150
storyline: |
  Built on the site of the former Domino Sugar Refinery, this waterfront park keeps some of the old factory's machinery as public art.
challenge:
  name: ""
  description: |
    Find a piece of old factory equipment on display and describe what it looks like.
  notes: ""
  form: "026_form_domino_park.yaml"
breadcrumb: |
  Continue north along the waterfront.
```

`027_loc_williamsburg_waterfront.yaml` (no form):
```yaml
title: "Brooklyn's Waterfront Neighborhood"
image: placeholder.jpg
name:
  label: ""
  value: "Williamsburg waterfront"
address: "Kent Ave, Brooklyn, NY 11249"
coordinates:
  longitude: -73.9626
  latitude: 40.7181
storyline: |
  Once an industrial waterfront, Williamsburg has become one of Brooklyn's most popular neighborhoods for its views, restaurants, and nightlife.
challenge:
  name: ""
  description: |
    Find a spot with a clear view across the river and note which Manhattan landmarks you can identify.
  notes: ""
breadcrumb: |
  Head south to the borough's largest park.
```

`028_loc_prospect_park.yaml` (form):
```yaml
title: "Brooklyn's Central Park"
image: placeholder.jpg
name:
  label: ""
  value: "Prospect Park"
address: "Prospect Park, Brooklyn, NY 11225"
coordinates:
  longitude: -73.9690
  latitude: 40.6602
storyline: |
  Designed by the same architects behind Central Park, many New Yorkers consider Prospect Park's landscape design to be even better.
challenge:
  name: ""
  description: |
    Find the Long Meadow and note what people are doing on it.
  notes: ""
  form: "028_form_prospect_park.yaml"
breadcrumb: |
  Head to the art museum near the park's entrance.
```

`029_loc_brooklyn_museum.yaml` (no form):
```yaml
title: "One of the Largest Art Museums in the Country"
image: placeholder.jpg
name:
  label: ""
  value: "Brooklyn Museum"
address: "200 Eastern Pkwy, Brooklyn, NY 11238"
coordinates:
  longitude: -73.9636
  latitude: 40.6712
storyline: |
  This museum's collection spans ancient Egyptian artifacts to contemporary art, and its front steps and fountain are a popular local gathering spot.
challenge:
  name: ""
  description: |
    Find the fountain in front of the museum and note whether it's running.
  notes: ""
breadcrumb: |
  Finish this route at the boardwalk, a longer trip south by subway.
```

`030_loc_coney_island.yaml` (form):
```yaml
title: "The People's Playground"
image: placeholder.jpg
name:
  label: ""
  value: "Coney Island boardwalk"
address: "Riegelmann Boardwalk, Brooklyn, NY 11224"
coordinates:
  longitude: -73.9846
  latitude: 40.5749
storyline: |
  Coney Island has been a beachside amusement destination since the late 1800s and is home to the historic Wonder Wheel and Cyclone roller coaster.
challenge:
  name: ""
  description: |
    Find the Wonder Wheel and note whether it's running.
  notes: ""
  form: "030_form_coney_island.yaml"
breadcrumb: |
  This is the end of the Brooklyn Route — and of all three New York routes.
```

- [ ] **Step 2: Write the 5 forms for this route**

`022_form_south_street_seaport.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of a docked ship
- id: ship_present
  type: boolean
  label: Is a historic ship docked at the pier right now?
- id: ship_name
  type: string
  label: What is the ship's name (if visible)?
```

`024_form_dumbo.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the framed bridge view
- id: bridge_visible
  type: number
  label: How many bridge towers/pillars can you count in the framed view?
- id: street_surface
  type: radio
  label: What's the street surface like?
  options:
    - Cobblestone
    - Paved
    - Mixed
```

`026_form_domino_park.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the old factory equipment
- id: equipment_types
  type: multiple
  label: What kind of old equipment do you see on display?
  min: 0
  max: 3
  options:
    - Cranes or gantries
    - Pipes or tanks
    - Gears/mechanical parts
- id: equipment_notes
  type: textarea
  label: Describe the equipment in a sentence or two.
```

`028_form_prospect_park.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the Long Meadow
- id: meadow_activity
  type: string
  label: What are people doing on the meadow?
- id: crowd_level
  type: radio
  label: How busy is the park right now?
  options:
    - Very busy
    - Moderately busy
    - Quiet
```

`030_form_coney_island.yaml`:
```yaml
- id: photo
  type: photo
  label: Take a photo of the Wonder Wheel
- id: route_recap
  type: section
  label: Route recap
- id: enjoyed_route
  type: boolean
  label: Did you enjoy the Brooklyn Route?
- id: stops_completed
  type: number
  label: How many of the 10 stops did you actually visit in person?
```

- [ ] **Step 3: Write `new_york/routes.yaml`**

```yaml
manhattan_route:
  description: "A route through Midtown Manhattan's biggest landmarks — 10 stops."
  locations:
    - 001_loc_times_square
    - 002_loc_rockefeller_center
    - 003_loc_st_patricks
    - 004_loc_grand_central
    - 005_loc_nypl
    - 006_loc_empire_state
    - 007_loc_flatiron
    - 008_loc_union_square
    - 009_loc_washington_square
    - 010_loc_one_wtc

museums_parks_route:
  description: "A route through Central Park and its surrounding museums — 10 stops."
  locations:
    - 011_loc_central_park_mall
    - 012_loc_bethesda_terrace
    - 013_loc_met
    - 014_loc_amnh
    - 015_loc_strawberry_fields
    - 016_loc_belvedere_castle
    - 017_loc_columbus_circle
    - 018_loc_lincoln_center
    - 019_loc_moma
    - 020_loc_bryant_park

brooklyn_route:
  description: "A route across the Brooklyn Bridge and along the waterfront to Coney Island — 10 stops."
  locations:
    - 021_loc_brooklyn_bridge
    - 022_loc_south_street_seaport
    - 023_loc_brooklyn_bridge_park
    - 024_loc_dumbo
    - 025_loc_brooklyn_heights_promenade
    - 026_loc_domino_park
    - 027_loc_williamsburg_waterfront
    - 028_loc_prospect_park
    - 029_loc_brooklyn_museum
    - 030_loc_coney_island
```

- [ ] **Step 4: Validate all of New York**

Run: `npm run validate:yaml`
Expected: exits 0 — all 30 New York location files, 15 form files, and `routes.yaml` pass schema validation.

- [ ] **Step 5: Commit**

```bash
git add src/data/text/en/projects/demo/new_york/02*_loc_*.yaml src/data/text/en/projects/demo/new_york/02*_form_*.yaml src/data/text/en/projects/demo/new_york/030_loc_*.yaml src/data/text/en/projects/demo/new_york/030_form_*.yaml src/data/text/en/projects/demo/new_york/routes.yaml
git commit -m "feat: add New York Brooklyn Route content and new_york/routes.yaml"
```

---

### Task 8: Full validation and manual verification

**Files:** none — verification only.

- [ ] **Step 1: Full YAML validation**

Run: `npm run validate:yaml`
Expected: exits 0. This is the first point all 60 locations + 30 forms + both `routes.yaml` files + `cities.yaml`/`demo.yaml` exist together — confirms no cross-file issues (e.g. a `challenge.form` reference to a form file that doesn't exist would still validate per-file successfully since the schema only checks that the value is a string, so also grep-check references resolve):

```bash
for f in $(grep -rl "form: " src/data/text/en/projects/demo/); do
  formfile=$(grep "form: " "$f" | sed 's/.*form: "\(.*\)"/\1/')
  dir=$(dirname "$f")
  if [ ! -f "$dir/$formfile" ]; then
    echo "MISSING: $f references $formfile"
  fi
done
```
Expected: no output (every `challenge.form` reference resolves to a real file in the same directory).

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: both clean (content-only changes shouldn't affect either, but confirms nothing was accidentally left in a `.ts`/`.svelte` file).

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, and:
- Confirm `Demo` appears on the landing page (login will 404/fail until sub-project 4 ships — that's expected; if sub-project 4 is already implemented, log in and continue below).
- Once logged in: confirm Paris and New York both show 3 routes each.
- Walk one full route per city end-to-end (all 10 locations navigate correctly, all 5 forms render with a photo field plus their listed fields, at least one form submits successfully).
- Confirm the breadcrumb text reads coherently stop-to-stop within at least one route (each stop's breadcrumb should sensibly point toward the next stop's theme).

- [ ] **Step 4: Commit** (only if Steps 1–2 required fixes; otherwise nothing to commit)

```bash
git add -A
git commit -m "chore: final validation pass for demo project content"
```
