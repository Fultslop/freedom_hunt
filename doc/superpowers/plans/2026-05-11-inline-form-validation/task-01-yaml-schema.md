# Task 01 — YAML Schema + VS Code wiring

**Files:**
- Create: `src/data/schemas/location.schema.json`
- Create: `.vscode/settings.json`

No automated tests — verification is manual in VS Code.

---

- [ ] **Step 1: Create the JSON Schema**

Create `src/data/schemas/location.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Location",
  "type": "object",
  "additionalProperties": false,
  "required": ["title", "name", "coordinates", "storyline", "breadcrumb", "challenge"],
  "properties": {
    "title": { "type": "string" },
    "image": { "type": "string" },
    "themeColor": { "type": "string" },
    "name": {
      "type": "object",
      "additionalProperties": false,
      "required": ["value"],
      "properties": {
        "label": { "type": "string" },
        "value": { "type": "string" }
      }
    },
    "address": { "type": "string" },
    "coordinates": {
      "type": "object",
      "additionalProperties": false,
      "required": ["latitude", "longitude"],
      "properties": {
        "latitude":  { "type": "number" },
        "longitude": { "type": "number" }
      }
    },
    "storyline":  { "type": "string" },
    "breadcrumb": { "type": "string" },
    "challenge": {
      "type": "object",
      "additionalProperties": false,
      "required": ["description", "form"],
      "properties": {
        "name":        { "type": "string" },
        "description": { "type": "string" },
        "notes":       { "type": "string" },
        "form": {
          "type": "string",
          "description": "Filename of the form YAML, e.g. 001_form_binnenhof.yaml"
        }
      }
    }
  }
}
```

- [ ] **Step 2: Wire the schema in VS Code settings**

Create `.vscode/settings.json`:

```json
{
  "yaml.schemas": {
    "./src/data/schemas/location.schema.json": "*_loc_*.yaml"
  }
}
```

The `redhat.vscode-yaml` extension reads this and associates the schema with any
file whose name matches `*_loc_*.yaml`, regardless of directory.

- [ ] **Step 3: Verify in VS Code**

Open any Oslo location file, e.g.
`src/data/text/en/projects/democrats_abroad/oslo/001_loc_royal_palace.yaml`.

You should see a red squiggle on the `form:` line inside `challenge:`, with a hover
message like `Incorrect type. Expected "string"` or similar. (Requires the
`redhat.vscode-yaml` extension to be installed.)

- [ ] **Step 4: Verify Den Haag passes**

Open `src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml`.

No squiggles should appear — `form: "001_form_binnenhof.yaml"` is a string. ✓

- [ ] **Step 5: Commit**

```
git add src/data/schemas/location.schema.json .vscode/settings.json
git commit -m "feat: add JSON schema for location YAML files; wire VS Code YAML validation"
```
