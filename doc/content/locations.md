# Locations

A location is one stop on a hunt route — a place participants visit, read about, and complete a challenge at.

## File naming

Location files live in the city folder:

```
src/data/text/en/projects/<project-id>/<city-id>/
```

For example, Den Haag locations for the Democrats Abroad project live in:

```
src/data/text/en/projects/democrats_abroad/den_haag/
```

**Name the file:** `NNN_loc_<slug>.yaml`

- `NNN` is a zero-padded three-digit number: `001`, `002`, `003`, etc.
- `<slug>` is a short, lowercase, underscore-separated description of the location.
- Examples: `001_loc_binnenhof.yaml`, `005_loc_vigeland_park.yaml`

The number determines the sort order in the editor. It does not have to match the order locations appear in a route.

After creating the file, add the location to a route — see [Routes and cities](routes-and-cities.md).

## Fields

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | The title shown at the top of the location card. Usually the name of the place. |
| `name.value` | string | A secondary name shown below the title. Can be a fuller formal name or left empty (`""`). |
| `coordinates.latitude` | number | Latitude in decimal degrees (e.g. `52.0877`). |
| `coordinates.longitude` | number | Longitude in decimal degrees (e.g. `4.2951`). |
| `storyline` | multiline string | The narrative shown on the card. Sets the historical and political context for the location. Markdown is supported. |
| `breadcrumb` | multiline string | Navigation clue or reflective prompt shown below the challenge. Guides participants to the next stop or invites reflection. Markdown is supported. |
| `challenge.description` | multiline string | The task participants must complete at this location. |

### Optional fields

| Field | Type | Description |
|-------|------|-------------|
| `image` | string | Filename of the location photo (e.g. `peace-palace.jpg`). See [Images](images.md). |
| `name.label` | string | A label shown above `name.value` (e.g. `"also known as"`). Leave as `""` if not needed. |
| `address` | string | Street address of the location. |
| `challenge.name` | string | A short name for the challenge. Rarely used; leave as `""` if not needed. |
| `challenge.notes` | string | Internal notes or hints for organisers. Not shown to participants. |
| `challenge.form` | string | Filename of the form YAML file for this location (e.g. `"001_form_binnenhof.yaml"`). See [Forms](forms.md). Omit this field entirely if the location has no form. |

## Complete example

```yaml
title: "The Peace Palace"
image: rafael-ishkhanyan-peace-palace.jpg
name:
  label: ""
  value: "Home of the International Court of Justice"
address: "Carnegieplein 2, The Hague"
coordinates:
  latitude: 52.0877
  longitude: 4.2951
storyline: |
  Built in 1913 to house the Permanent Court of Arbitration, the Peace Palace is now
  home to the International Court of Justice — the principal judicial organ of the
  United Nations. It stands on the premise that disputes between nations can be
  settled by law, not war.

  The United States was one of its founding supporters. That was then.
challenge:
  name: ""
  description: |
    The US donated a gift to this building when it still believed in international
    institutions. Find it at the main gate. What does it depict, and which state
    commissioned it? Write one sentence: what does American leadership in
    international law mean to you today?
  notes: "Ask the security guard if you can't find the mosaic."
  form: "002_form_vredespaleis.yaml"
breadcrumb: |
  From here, walk east toward the old city centre. You are looking for a building
  that once served as a courthouse for a different kind of justice.
```

## Location without a form

If a location has no form (participants just read and reflect), simply omit the `challenge.form` field entirely:

```yaml
title: "The Resistance Museum"
image: resistance-museum.jpg
name:
  label: ""
  value: ""
address: "Plantage Kerklaan 61, Amsterdam"
coordinates:
  latitude: 52.3662
  longitude: 4.9126
storyline: |
  The museum documents how ordinary Dutch people responded to the Nazi occupation:
  collaboration, adaptation, and resistance.
challenge:
  name: ""
  description: |
    Find the exhibit on the February Strike of 1941. What triggered it, and who
    organised it? Share what you learn with your group.
  notes: ""
breadcrumb: |
  Leave the museum and walk to the nearby park. Look for the memorial that faces
  the water.
```

## Checklist for a new location

- [ ] File is named `NNN_loc_<slug>.yaml` in the correct city folder
- [ ] `title` is filled in
- [ ] `name.value` is filled in (can be `""`)
- [ ] `coordinates.latitude` and `coordinates.longitude` are decimal numbers (not strings)
- [ ] `storyline` is written
- [ ] `challenge.description` is written
- [ ] `breadcrumb` is written
- [ ] If the location has a form: `challenge.form` is set to the form filename and the form file exists
- [ ] If the location has an image: the file is in `src/data/img/` and `image` matches the filename
- [ ] The location ID (filename without `.yaml`) is added to the right route in `routes.yaml`

## Finding coordinates

Open [maps.google.com](https://maps.google.com), right-click the exact spot on the map, and click the coordinates at the top of the menu. They copy to your clipboard in `latitude, longitude` order.
