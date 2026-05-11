# Design: Inline Form Validation

**Date:** 2026-05-11
**Status:** Approved

## Context

Location YAML files (`*_loc_*.yaml`) should reference their challenge form data via a
filename string (e.g. `form: "001_form_binnenhof.yaml"`). The Den Haag city already
follows this pattern. Oslo location files were written with inline `form:` arrays and
have not been migrated.

This design adds three validation layers to enforce the string-reference convention,
then migrates the Oslo files.

## Layer 1 — VS Code YAML Schema

**File:** `src/data/schemas/location.schema.json`

A JSON Schema (draft-07) describing the expected shape of any `*_loc_*.yaml` file.
The critical constraint is on the `challenge` object:

```json
"challenge": {
  "type": "object",
  "properties": {
    "name":        { "type": "string" },
    "description": { "type": "string" },
    "notes":       { "type": "string" },
    "form":        { "type": "string",
                     "description": "Filename of the form YAML (e.g. 001_form_binnenhof.yaml)" }
  },
  "required": ["description", "form"],
  "additionalProperties": false
}
```

`form` is typed as `string` only. An inline array will be flagged as a type mismatch.

**Wiring:** `.vscode/settings.json` (new file) uses the `redhat.vscode-yaml` extension
key to associate the schema with the file glob:

```json
{
  "yaml.schemas": {
    "./src/data/schemas/location.schema.json": "*_loc_*.yaml"
  }
}
```

VS Code users with the YAML extension installed will see red squiggles on any
`*_loc_*.yaml` that has an inline `form` array.

## Layer 2 — Runtime "unrecognized field" display

Two changes work together.

### 2a — `src/utils/loadLocations.ts`

When `raw.challenge.form` is an array (inline data, not a filename), replace the entire
array with a single sentinel field before the location is returned:

```ts
{ id: 'form', type: 'inline_form' as FormFieldType, label: 'challenge.form' }
```

`'inline_form'` is not a member of `VALID_TYPES` in `AppForm`, so it will be treated as
an unknown type by the renderer.

### 2b — `src/components/AppForm.svelte`

Add an unknown-type branch at the top of the `{#each fields}` loop:

```svelte
{#if !VALID_TYPES.includes(field.type)}
  <div class="af-field af-field--unknown">
    unrecognized field '{field.id ?? field.label}'
  </div>
{:else if field.type === "section"}
  ...existing...
{:else}
  ...existing...
{/if}
```

Add a corresponding `.af-field--unknown` CSS rule in `AppForm.css` (warning colour,
monospace text).

**Effect:** Oslo location pages in the running app show
`unrecognized field 'form'` in place of the challenge form, until the inline data is
migrated.

## Layer 3 — Build validate script + CI

**File:** `scripts/validate-yaml.js` (plain ESM, no extra tooling needed)

- Recursively globs `src/data/text/en/**/*_loc_*.yaml`
- Parses each file with `js-yaml` (already a project dependency)
- Checks that `data?.challenge?.form` is `typeof === 'string'`
- Any failure → `console.error(...)` (writes to stderr) with the file path and
  a human-readable message
- Exits with code 1 if any errors were found

**npm script** added to `package.json`:

```json
"validate:yaml": "node scripts/validate-yaml.js"
```

**CI step** added to `.github/workflows/ci.yml` after `Install dependencies`,
before `Run Typecheck`:

```yaml
- name: Validate YAML
  run: npm run validate:yaml
```

Stderr output is captured by GitHub Actions and displayed in the step log.

## Oslo migration

**7 new form files** (identical structure to `001_form_binnenhof.yaml`):

| New file                               | Referenced from                          |
|----------------------------------------|------------------------------------------|
| `oslo/001_form_royal_palace.yaml`      | `oslo/001_loc_royal_palace.yaml`         |
| `oslo/002_form_stortinget.yaml`        | `oslo/002_loc_stortinget.yaml`           |
| `oslo/003_form_national_theatre.yaml`  | `oslo/003_loc_national_theatre.yaml`     |
| `oslo/004_form_akershus.yaml`          | `oslo/004_loc_akershus.yaml`             |
| `oslo/005_form_resistance_museum.yaml` | `oslo/005_loc_resistance_museum.yaml`    |
| `oslo/006_form_nobel_center.yaml`      | `oslo/006_loc_nobel_center.yaml`         |
| `oslo/007_form_city_hall.yaml`         | `oslo/007_loc_city_hall.yaml`            |

Each `*_loc_*.yaml` has its `form:` block replaced with a string reference, e.g.:

```yaml
challenge:
  form: "001_form_royal_palace.yaml"
```

Migration happens **after** layers 1–3 are in place and the user has confirmed
that the errors are visible. Once migrated, all three validation layers should
report no errors.

## Files changed

| File | Action |
|------|--------|
| `src/data/schemas/location.schema.json` | Create |
| `.vscode/settings.json` | Create |
| `src/utils/loadLocations.ts` | Modify — inline array → sentinel |
| `src/components/AppForm.svelte` | Modify — unknown-type branch |
| `src/components/AppForm.css` | Modify — `.af-field--unknown` style |
| `scripts/validate-yaml.js` | Create |
| `package.json` | Modify — add `validate:yaml` script |
| `.github/workflows/ci.yml` | Modify — add Validate YAML step |
| `oslo/001_form_royal_palace.yaml` … `007_form_city_hall.yaml` | Create (×7) |
| `oslo/001_loc_royal_palace.yaml` … `007_loc_city_hall.yaml` | Modify (×7) |
