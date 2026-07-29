# Form field prefill value — design

**Date:** 2026-07-29
**Status:** Approved

## Motivation

Content authors currently have no way to prefill a challenge-form field (e.g. an
explanatory default, a suggested answer). `AppForm.svelte` already supports
pre-filled values structurally via its `initialValues` prop — this design adds
the YAML authoring surface and the "does accepting the default count as an
answer" semantics on top of that existing mechanism.

## Scope

Applies to `FormField` types: `string`, `textarea`, `number`, `boolean`,
`radio`, `multiple`.

Not applicable to: `photo`, `section`, `image-picker`, `coord-picker`,
`random_value`.

## 1. Schema & type changes

Two new optional `FormField` keys:

- `value: string | number | boolean | string[]` — the prefill. Array form only
  valid for `multiple`.
- `storeDefaultValue: boolean` (default `true`) — whether accepting the
  default counts as an answer (see §3).

```yaml
- id: textfield_001
  type: string
  label: Describe textfield
  value: This is the prefilled value

- id: interests
  type: multiple
  label: What are you interested in?
  options: [History, Food, Art, Nature]
  min: 1
  max: 2
  value: [History, Art]
  storeDefaultValue: false # participant must actively confirm/edit before Submit enables
```

Changes required:
- `src/data/schemas/form.schema.json` — add `value` and `storeDefaultValue`
  properties.
- `src/types/data.ts` — add `value?: string | number | boolean | string[];`
  and `storeDefaultValue?: boolean;` to `FormField`.

## 2. Loader validation (`src/utils/loadLocations.ts`) — single tier

Extends the existing `withValidatedFields` unknown-key mechanism
(`loadLocations.ts:27-42`) with the same treatment for these new cases — any
of them replaces the whole field with a visible `schema_error` field (the
error message goes in `label`), exactly like an unknown YAML key does today:

- `value` and/or `storeDefaultValue` present on an unsupported type (`photo`,
  `section`, `image-picker`, `coord-picker`, `random_value`).
- `value`'s JS shape doesn't match the field type (string/number/boolean
  mismatch, or a non-array for `multiple`).
- `radio`: `value` is not present in `options`.
- `multiple`: any entry in the `value` array is not present in `options`.

There is no console-only warning tier and no partial-array filtering (e.g. a
`multiple` field with one misspelled option among several valid ones still
becomes a full `schema_error`, not a partially-seeded field) — one consistent,
visible failure mode, matching how unknown keys are already handled.

`KNOWN_FORM_FIELD_KEYS` must include `value` and `storeDefaultValue`, or
authoring either key on a valid field/type combination would itself be
flagged as an unknown-key error.

## 3. Runtime behavior (`src/components/AppForm.svelte`)

No changes needed in `ChallengeForm.svelte` or `formStorage.ts` — this is
fully containable in `AppForm`'s existing `initialValues`/`baseValues`
machinery.

- **Never-stored field** (`initialValues[id] === undefined` — exactly what an
  untouched field already looks like from `ChallengeForm`'s
  localStorage-backed props): seed `values[id]` from `field.value` at
  state-init time.
- **Previously-stored field** (key present in `initialValues`, including
  `""`): the stored value wins; `field.value` is ignored. (Stored answer
  always wins over the YAML default.)
- **`storeDefaultValue: true` (default):** leave `baseValues[id]` unset for
  that field. The existing per-field `hasChanges` logic
  (`AppForm.svelte:124-134`) then naturally evaluates
  `curr (= field.value) !== baseline (= undefined)` → `true`, enabling Submit
  immediately — no changes needed to that comparison logic itself.
- **`storeDefaultValue: false`:** also seed `baseValues[id]` to `field.value`,
  so `hasChanges` stays `false` until the participant edits away from the
  default.

`validateValues()` needs no changes — a prefilled value already satisfies
`isRequired` checks as-is, correct under either `storeDefaultValue` setting.

## Out of scope

- `EditorLocationForm.svelte` reuses `AppForm` for unrelated
  location-authoring fields (`editor/location_form.yaml`) and inherits this
  capability for free since `AppForm` is generic, but no changes are needed
  there, and no existing editor YAML uses `value` today so there is no
  behavior change for it.
- `multiple`-array partial validation/dropping was considered and rejected in
  favor of the single hard-error tier (see §2).

## Testing

- `loadLocations.test.ts`: new cases for each `schema_error` trigger in §2,
  plus valid `value` passing through unchanged for each of the 6 supported
  types.
- `AppForm.test.ts`: seeding from `field.value` when unset; a stored value
  overriding `field.value`; `hasChanges` true/false per `storeDefaultValue`.
