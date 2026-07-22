# Forms

A form is a set of questions participants answer at a location. Not every location needs a form — some just ask participants to read, reflect, and move on.

## File naming

Form files live in the same folder as the location file:

```
src/data/text/en/projects/<project-id>/<city-id>/
```

**Name the file:** `NNN_form_<slug>.yaml`

Use the **same number and slug** as the matching location file. For example, if the location is `003_loc_plein.yaml`, the form is `003_form_plein.yaml`.

## Linking a form to a location

In the location file, set `challenge.form` to the form filename (including `.yaml`):

```yaml
challenge:
  description: |
    Complete the challenge below.
  form: "003_form_plein.yaml"
```

The form file itself is just a list of fields — no wrapper key needed.

## Form file structure

A form file is a YAML list. Each item in the list is one field:

```yaml
- id: found_plaque
  type: boolean
  label: Did you find the plaque?
- id: motto_text
  type: string
  label: What motto is engraved on it?
```

Every field must have a `type` and a `label`. Every field except `section` should also have an `id`.

## Field types

### `boolean` — yes / no

Renders as a checkbox. The participant ticks it or leaves it empty.

```yaml
- id: found_marker
  type: boolean
  label: Did you find the historical marker?
```

---

### `string` — short text

Renders as a single-line text input. Good for names, short answers, single words.

```yaml
- id: year_engraved
  type: string
  label: What year is engraved on the plaque?
```

---

### `textarea` — long text

Renders as a multi-line text area. Use this for answers that need more than a sentence — reflections, descriptions, quotes.

```yaml
- id: reflection
  type: textarea
  label: In your own words, what did resistance look like here?
```

---

### `number` — numeric input

Renders as a number input. Use `min` and `max` to constrain the range.

```yaml
- id: visitor_count
  type: number
  label: Roughly how many other visitors are here right now?
  min: 0
  max: 500
```

`min` and `max` are optional.

---

### `radio` — pick one

Renders as a set of radio buttons. The participant picks exactly one option. Requires an `options` list.

```yaml
- id: time_of_day
  type: radio
  label: What time of day did you arrive?
  options:
    - Morning (before 12:00)
    - Afternoon (12:00–17:00)
    - Evening (after 17:00)
```

---

### `multiple` — pick one or more

Renders as a set of checkboxes. The participant can select multiple options. Requires an `options` list. Use `min` and `max` to constrain how many they can select.

```yaml
- id: flags
  type: multiple
  label: Which flags can you see flying right now?
  min: 1
  max: 3
  options:
    - Dutch
    - European Union
    - American
    - German
    - Other
```

`min` and `max` are optional but recommended to guide participants.

---

### `photo` — photo upload

Renders as a camera / file upload button. The participant takes or uploads a photo. Only one photo per field.

```yaml
- id: registration_screenshot
  type: photo
  label: Upload a photo of your completed voter registration screen.
```

---

### `section` — heading

Not a question — renders a visual heading inside the form to separate groups of fields. Does not produce a value. The `id` field is not needed.

```yaml
- type: section
  label: "Part 2: What you observed"
- id: observation
  type: textarea
  label: Describe what you saw.
```

---

## Complete form example

```yaml
- type: section
  label: "At the statue"
- id: found_plaque
  type: boolean
  label: Did you find the plaque at the base of the statue?
- id: motto_text
  type: string
  label: What motto is engraved on the plaque?
- id: visitor_count
  type: number
  label: Roughly how many other visitors are in the courtyard right now?
- type: section
  label: "What you observed"
- id: time_of_day
  type: radio
  label: What time of day did you arrive?
  options:
    - Morning (before 12:00)
    - Afternoon (12:00–17:00)
    - Evening (after 17:00)
- id: flags
  type: multiple
  label: What flags can you see flying?
  min: 1
  max: 4
  options:
    - Dutch
    - European Union
    - The Hague city flag
    - American
    - German
    - UK
- id: photo
  type: photo
  label: Take a photo of the plaque.
- id: reflection
  type: textarea
  label: One sentence — what does this place mean to you?
```

## Checklist for a new form

- [ ] File is named `NNN_form_<slug>.yaml` in the correct city folder
- [ ] The matching location file has `challenge.form` set to this filename (including `.yaml`)
- [ ] Every field has a `type` and a `label`
- [ ] Every field except `section` has an `id`
- [ ] `radio` and `multiple` fields have an `options` list with at least two items
- [ ] Field IDs are unique within the file (no two fields share the same `id`)
