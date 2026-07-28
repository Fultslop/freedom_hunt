# `random_value` Form Field — Design

## Problem

`003_loc_jewish_children_museum.yaml`'s challenge description tells the team to "click HERE" to find a name on the monument, but there is no interactive element behind that instruction — it's inert copy. The intent is that clicking assigns each team a semi-random name (from a list of the monument's engraved children) that they then have to physically find and read aloud, rather than everyone reading whichever name is easiest to spot.

## Approach

Add a new form field type, `random_value`, to the existing extensible `AppForm` field-type system — the same mechanism previously used to add `image-picker` and `coord-picker`. A `random_value` field carries a `values: string[]` list; on first render it shows a "reveal" button (reusing the `Dice5` icon/interaction already established by the team-name picker on `JoinTeamPage`). Tapping it picks one random entry and writes it into the field's value, same as any other field. There is no reroll — once rolled, the value is locked, satisfying the "can't pick an easy name" requirement, and it persists across reloads for free because it's stored through the same `values[id]` / localStorage path every other form field already uses.

This keeps the roll in the challenge's form section (below the description), not literally inline inside the markdown at the word "HERE" — inlining it would require extending the separate `MarkdownText`/`Storyline` rendering pipeline, which is out of scope for this feature. The location's description copy is reworded instead to point at the new field.

### Alternatives considered

- **Inline interactive block inside `challenge.description`** (reusing/extending the `storylineBlocks` `[+]`-style parser that today only powers `storyline`, not `challenge.description`): rejected — bigger surface area (new block type, wiring `challenge.description` through the block parser) for a cosmetic difference in where the button sits.
- **Unlimited reroll** (mirror `JoinTeamPage` exactly): rejected per product decision — a team could keep rerolling until they got a name near them, defeating the point of the exercise.

## Data Model Changes

`src/types/data.ts`:
- `FormFieldType` gains `"random_value"`.
- `FormField` gains optional `values?: string[]`.

`src/data/schemas/form.schema.json`:
- Add `"random_value"` to the `type` enum.
- Add `values: { "type": "array", "items": { "type": "string" } }` to `properties`.

No changes to `Challenge`, `Location`, `RouteEntry`, or any store/route type — the field slots into the existing `FormField[]` array exactly like every other type.

## Component Changes — `AppForm.svelte`

- Add `STR_RANDOM_VALUE = "random_value"` alongside the other type constants; add it to `VALID_TYPES`.
- `checkDefinition`: a `random_value` field with a missing/empty `values` array returns a new `MSG_RANDOM_VALUE_MISSING = 'random_value field missing values'`, mirroring the existing `radio`/`multiple` → `options` check.
- `validateValues`: treat `random_value` like `string` for the required check (non-empty value required if `field.isRequired`).
- Template branch (new `{:else if field.type === "random_value"}` case, alongside the existing `string`/`radio`/etc. branches):
  - `field.label` renders above the control via the shared `af-label`, same as every other field type (e.g. "Tap to reveal the name you'll look for").
  - If `values[id]` is unset: render a button below the label with the `Dice5` icon (imported from `lucide-svelte`, already used in `JoinTeamPage`) and static text "Reveal a name".
  - `onclick`: pick `field.values[Math.floor(Math.random() * field.values.length)]` and set `values[id]` to it.
  - If `values[id]` is set: render it as static text (no input, no reroll control) — e.g. a `<p class="af-random-value-result">`.
- No changes to `buildNestedValues`/`flattenValues` — a `random_value` field's stored value is a plain string, identical in shape to a `string` field's value, so the existing dotted-path nesting logic handles it unchanged.

## Data Files

**New `003_form_jewish_children_museum.yaml`** (referenced by filename per the existing `challenge.form: string` convention):

```yaml
- id: assigned_child
  type: random_value
  label: "Tap to reveal the name you'll look for"
  values:
    - "Erna Aalsvel (15 years old)"
    - "David Abrahams (13 years old)"
    - "Elfrieda Abrahams (4 years old)"
    - "Helene Abrahams (10 years old)"
    - "Helene Minna Abrahams (17 years old)"
    - "Henri Abrahams (10 years old)"
    - "Isidor Abrahams (2 years old)"
    - "Jacob Abrahams (10 years old)"
    - "Judith Abrahams (5 years old)"
    - "Machiel Abrahams (7 years old)"
    - "Menno Samuël Abrahams (8 years old)"
    - "Michel Abrahams (18 years old)"
    - "Mirjam Minne Abrahams (9 years old)"
    - "Raphaël Abrahams (2 years old)"
    - "Abram Abram (13 years old)"
    - "Meyer Abram (16 years old)"
    - "Mietje Abram (11 years old)"
    - "Mozes Abram (8 years old)"
    - "Regina Abram (4 years old)"
    - "Willy Abram (4 years old)"
    - "Abraham Abramowicz (17 years old)"
    - "Heinrich Adler (10 years old)"
    - "Hanna Agsterribbe (3 years old)"
    - "Jozef Agsterribbe (4 years old)"
    - "Rachel Agsterribbe (18 months old)"
    - "Rachel Hanna Agsterribbe (5 years old)"
```

**`003_loc_jewish_children_museum.yaml`** changes:
- Add `challenge.form: "003_form_jewish_children_museum"`.
- Reword the description's instruction line from:
  > When your team arrives at the monument, click HERE. Find the name on the monument.

  to:
  > When your team arrives at the monument, tap **Reveal a name** below. Find that name on the monument.

## Validation

The three-layer YAML validation already covers this automatically once the schema/enum change lands:
- IDE: `.vscode/settings.json` already wires `form.schema.json` to `*_form_*.yaml` globs.
- CI: `scripts/validate-yaml.js` already validates every `*_form_*.yaml` against `form.schema.json`.

No new validation code needed — just the enum/property addition above.

## Testing

Extend `src/test/AppForm.test.ts` with a `random_value` field fixture:
- Renders a reveal button (not an input) when no value is set.
- Clicking the button sets the field's value to one of the entries in `values` and removes the button, showing the picked value as text.
- Re-rendering with an `initialValues` entry already set for that field id renders the locked value directly (no button) — proving reload-persistence needs no special-casing.
- A `random_value` field with an empty/missing `values` array renders the existing unknown/definition-error state, consistent with `radio`/`multiple`.

## Out of Scope

- Inline rendering inside `challenge.description`/`storyline` markdown.
- Admin editor support for authoring `random_value` fields (the editor's `location_form.yaml` already doesn't cover every field type — same gap as other recently-added types).
- Weighting/no-repeat-across-teams logic for the random pick — plain uniform `Math.random()` per team, no cross-team coordination.
