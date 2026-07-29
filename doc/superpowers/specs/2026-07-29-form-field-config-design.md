# Form field `config` property — design

**Date:** 2026-07-29
**Status:** Approved

## Motivation

Some field types need type-specific rendering configuration that doesn't fit
the existing generic `FormField` keys (`options`, `min`, `max`, etc.). The
first case: a `textarea` field's visible line count should be
author-configurable per field, defaulting to 5 lines when not set.

## Scope

A new optional `FormField.config` object. Today only `textarea` reads it, via
a single sub-key: `lineCount`.

```yaml
- id: story
  type: textarea
  label: Tell us your story
  config:
    lineCount: 8
```

`config` is intentionally a flat `{ lineCount?: number }` shape, not a
discriminated union keyed by field type — only `textarea` has config today
(YAGNI). When a second type needs its own config, the shape can grow into a
union at that point; this design doesn't need to anticipate it.

## 1. Schema & type changes

- `src/types/data.ts` — add `config?: { lineCount?: number };` to `FormField`.
- `src/data/schemas/form.schema.json` — add:
  ```json
  "config": {
    "type": "object",
    "properties": { "lineCount": { "type": "number" } },
    "additionalProperties": false
  }
  ```
  `additionalProperties: false` on the nested object mirrors how the
  top-level field object is already locked down, so `ajv`
  (`npm run validate:yaml`) rejects unknown `config` sub-keys at
  authoring/CI time, in addition to the runtime check in §2.

## 2. Loader validation (`src/utils/loadLocations.ts`) — single tier, same as `value`/`storeDefaultValue`

Extends the existing `withValidatedFields` message-joining mechanism
(established by the `value`/`storeDefaultValue` work) with:

- `config` present on any type other than `textarea` → `schema_error`
  ("'config' not supported on type '&lt;type&gt;'").
- Any key inside `config` other than `lineCount` → `schema_error`, naming the
  unknown key(s).
- `config.lineCount` present but not a positive integer
  (`Number.isInteger(v) && v > 0`) → `schema_error`
  ("'config.lineCount' must be a positive integer").

As with `value`/`storeDefaultValue`, there is no separate warning tier and no
partial acceptance — any of the above replaces the whole field with a visible
`schema_error` field, exactly like an unknown top-level YAML key does today.

## 3. Runtime rendering (`src/components/AppForm.svelte`, `src/components/AppForm.css`)

- The `textarea` branch renders a native `rows={field.config?.lineCount ?? 5}`
  attribute. `AppForm.svelte` currently sets no `rows` at all.
- `.af-textarea`'s current `min-height: 80px` is replaced with
  `min-height: var(--field-min-height)` — the same floor token `.af-input`
  already uses. `rows` becomes the primary height driver; `min-height` is
  just an accessible-tap-target floor for very small `lineCount` values.
  `resize: vertical` is unchanged — participants can still manually stretch
  the field.

**Explicitly accepted side effect:** since no existing content sets `config`
today, every existing `textarea` field's default rendered height changes from
the current CSS-driven ~80px box to a browser-computed 5-row box. These
should look close in practice but are not pixel-identical. This was
confirmed as intended during design review — the whole point of `rows`
driving height is that a low `lineCount` (e.g. `2`) must actually render
short, which the old fixed `80px` floor would have prevented.

## Out of scope

- Config for any field type other than `textarea` — no other type has a need
  for it yet.
- A discriminated-union `config` type keyed by field type — deferred until a
  second type actually needs config (see "Scope" above).

## Testing

- `loadText.test.ts`: valid `config.lineCount` on `textarea` passes through
  unchanged; `config` on a non-`textarea` type, an unknown `config` sub-key,
  and a non-positive/non-integer `lineCount` each produce a `schema_error`.
- `AppForm.test.ts`: a `textarea` field with `config.lineCount` renders with
  the matching `rows` attribute; a `textarea` field with no `config` renders
  with `rows="5"`.
