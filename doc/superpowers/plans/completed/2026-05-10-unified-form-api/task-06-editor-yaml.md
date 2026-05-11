# Task 06: Create `location_form.yaml`

**Files:**
- Create: `src/data/text/en/editor/location_form.yaml`

This YAML file defines the full field structure for the location editor form. It is a flat `FormField[]` array loaded at runtime by `EditorLocationForm` via `loadText()`. It uses `type: section` for visual groupings and dotted IDs for nested fields.

---

- [ ] **Step 1: Create the file**

Create `src/data/text/en/editor/location_form.yaml`:

```yaml
- type: section
  label: Basic info

- id: identity
  type: string
  label: Id

- id: title
  type: string
  label: Title

- id: image
  type: string
  label: "Image filename (e.g. my-photo.jpg — upload separately)"

- id: name.label
  type: string
  label: Name label

- id: name.value
  type: string
  label: Name value

- id: address
  type: string
  label: Street address

- id: coordinates.latitude
  type: string
  label: Latitude

- id: coordinates.longitude
  type: string
  label: Longitude

- type: section
  label: Narrative

- id: storyline
  type: textarea
  label: Storyline

- id: breadcrumb
  type: textarea
  label: Breadcrumb clue

- type: section
  label: Challenge

- id: challenge.name
  type: string
  label: Challenge name

- id: challenge.description
  type: textarea
  label: Challenge description

- id: challenge.notes
  type: textarea
  label: "Notes (internal, not shown to participants)"
```

> `coordinates.latitude` and `coordinates.longitude` are `type: string` because the form stores them as strings and `EditorLocationForm`'s submit callback parses them to floats via `parseFloat()`. This avoids needing a separate `decimal` field type.

- [ ] **Step 2: Verify the YAML file is reachable by `loadText`**

`loadText("en", "editor/location_form")` constructs the key `../data/text/en/editor/location_form.yaml` and looks it up in Vite's `import.meta.glob("../data/text/**/*.yaml")`. The new file is in the correct location and will be picked up automatically by the glob.

Run a build to confirm:

```
npm run build
```

Expected: builds cleanly with no YAML parsing errors.

- [ ] **Step 3: Commit**

```
git add src/data/text/en/editor/location_form.yaml
git commit -m "feat: add editor/location_form.yaml — data-driven editor form definition"
```
