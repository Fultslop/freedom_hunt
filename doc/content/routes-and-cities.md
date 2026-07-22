# Routes and Cities

## Routes

A route is a named sequence of locations within a city. Routes are defined in `routes.yaml` inside the city folder:

```
src/data/text/en/projects/<project-id>/<city-id>/routes.yaml
```

### Structure

`routes.yaml` is a map of route IDs to route definitions. Each route has a `description` and a `locations` list:

```yaml
short_loop:
  description: "A 2.5–3 hour walk through the city centre."
  locations:
    - 001_loc_binnenhof
    - 002_loc_vredespaleis

extended_route:
  description: |
    A 3.5–4.5 hour extended route toward Scheveningen, with tram or bike return.
    This longer route requires either bike or tram access.
  locations:
    - 004_loc_american_bookstore
    - 001_loc_binnenhof
    - 002_loc_vredespaleis
    - 003_loc_plein
```

**Location IDs** are the filename without `.yaml` — so `001_loc_binnenhof.yaml` becomes `001_loc_binnenhof`.

The **order of the list** is the order participants visit the locations. The same location can appear in multiple routes.

### Adding a location to an existing route

Find the route in `routes.yaml` and add the location ID to the `locations` list in the right position:

```yaml
short_loop:
  description: "A 2.5–3 hour walk through the city centre."
  locations:
    - 001_loc_binnenhof
    - 005_loc_new_stop      # ← added here
    - 002_loc_vredespaleis
```

### Creating a new route

Add a new key at the top level of `routes.yaml`:

```yaml
memorial_walk:
  description: "A 2-hour route focused on wartime memorials."
  locations:
    - 007_loc_oranjehotel
    - 008_loc_peace_memorial
```

Route IDs use lowercase letters and underscores. The ID becomes part of the URL (`/democrats_abroad/den_haag/memorial_walk`), so keep it short and descriptive.

---

## Cities

Cities are listed in `cities.yaml` inside the project folder:

```
src/data/text/en/projects/<project-id>/cities.yaml
```

### Structure

`cities.yaml` has some page-level text fields and an `items` list. Each item in the list is one city:

```yaml
page.title: "Yes.We.Vote"
page.text: |
  This scavenger hunt connects the history of European resistance to fascism
  with the stakes of American democracy today.
page.selectCity: "Choose a city"
page.image: da_abroad_logo.png
items:
  - id: den_haag
    name: "Den Haag"
    image: den-haag-logo.jpg
    country: "Netherlands"
    description: "The seat of Dutch government and international justice."
    coordinates:
      longitude: 4.3133
      latitude: 52.0799
  - id: oslo
    name: "Oslo"
    image: oslo-hero.jpg
    country: "Norway"
    description: "Where democracy was tested, resistance was born, and peace is celebrated every December."
    coordinates:
      latitude: 59.9169
      longitude: 10.7274
```

### Adding a new city

1. Add an entry to the `items` list in `cities.yaml`:

```yaml
  - id: amsterdam
    name: "Amsterdam"
    image: amsterdam-hero.jpg
    country: "Netherlands"
    description: "A city built on tolerance, trade, and the courage to resist."
    coordinates:
      latitude: 52.3676
      longitude: 4.9041
```

2. Create the city folder:

```
src/data/text/en/projects/<project-id>/amsterdam/
```

3. Create `amsterdam.yaml` in that folder (the city description page):

```yaml
page.title: "Amsterdam"
page.description: |
  A brief description of the city shown on the route-picker page.
```

4. Create `routes.yaml` in that folder (start with at least one route — see [Routes](#routes) above).

5. Add location files to the folder.

The city `id` must match the folder name exactly.

---

## Projects

Projects are the top-level organisations running a hunt. Most work will happen within an existing project. If you need to add a new project, `projects.yaml` lives at:

```
src/data/text/en/projects/projects.yaml
```

### Structure

```yaml
page.title: "Choose a project"
page.subtitle: "Select an organisation to explore with"
items:
  - id: democrats_abroad
    image: da_abroad_logo.png
    name: "Democrats Abroad / Global Women's Caucus"
    description: "Democrats Abroad is the official arm of the US Democratic Party for Americans living outside the U.S."
```

### Adding a new project

1. Add an entry to `items` in `projects.yaml`.
2. Create the project folder: `src/data/text/en/projects/<project-id>/`
3. Create `<project-id>.yaml` in that folder (project description text).
4. Create `cities.yaml` in that folder.
5. Add city folders and their content.

The project `id` must match the folder name exactly.
