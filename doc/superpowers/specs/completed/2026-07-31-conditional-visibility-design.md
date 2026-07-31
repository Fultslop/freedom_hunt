# Conditional Visibility — `isVisible`

Date: 2026-07-31
Status: ready to implement
Version: v1.0
Scope: a generic, reusable conditional-visibility concept for content-authored YAML,
wired into `FormField`/`AppForm` only. Prerequisite for the upcoming consent-screen spec,
which is the first real consumer — but this concept is deliberately not built for that
screen alone.

---

## 1. Why this exists

Content in this project already conditionally reveals things — the textarea `source`
field pulls an answer from another location's form, `project.form_required` gates
navigation, checkpoints gate crossing on form-completion requirements. Each of these
is its own bespoke mechanism. The consent screen needs a field (the promo-consent
checkbox) to appear only when another field (the age question) has a specific answer,
and a different block of text to appear when it has the other answer. Rather than add a
fourth bespoke mechanism, this spec defines one generic concept — `isVisible` — that
`FormField` adopts now, and that other route-entry/component types can adopt later,
without needing to know about each other.

**Not in scope:** wiring `isVisible` into any component other than `AppForm`/`FormField`.
The type and resolver are generic on purpose, but nothing else in the codebase consumes
them yet — that happens on demand, per CLAUDE.md's "no abstractions for one-off things."

---

## 2. YAML shape

### 2.1 Basic form

```yaml
isVisible:
  initially: conditional   # visible (default) | hidden | conditional
  condition:
    source: all_sixteen_plus
    operator: "="
    value: "Yes"
```

- `isVisible` is fully optional. Omitting it is identical to `initially: visible` — the
  overwhelming majority of fields need nothing here and pay no cost.
- `initially: visible` or `initially: hidden` — static, unconditional. No `condition`/
  `any`/`all`/`not` block may be present alongside either (schema-enforced) — a static
  state with an unused condition block sitting next to it is a authoring trap, not a
  feature. `hidden` exists for "author it, keep the wiring, don't show it yet" (e.g. WIP
  content) without deleting the field.
- `initially: conditional` — exactly one of `condition` / `any` / `all` / `not` (§2.2)
  must be present; that block decides visibility every time the form's values change.

### 2.2 Combinators

Three, not four — `not_any`/`not_all` (as originally floated) are just `not` wrapping
`any`/`all`, so one recursive `not` covers both with one less concept to learn:

```yaml
isVisible:
  initially: conditional
  any:
    - all:
        - { source: has_car, operator: "=", value: "Yes" }
        - { source: parking_zone, operator: "is not null" }
    - not:
        any:
          - { source: all_sixteen_plus, operator: "=", value: "No" }
```

`any`/`all` take a list of condition nodes; each node is either a single condition
(§2.3) or another `any`/`all`/`not`. `not` wraps exactly one node (a single condition or
another combinator). Nesting is unbounded but nothing in this project's content needs
more than 2–3 levels — keep authored conditions shallow for readability, not because
anything enforces a limit.

### 2.3 A single condition

```yaml
condition:
  source: all_sixteen_plus   # required — see §3 for what this can be
  operator: "="              # required
  value: "Yes"                # required for all operators except "is null" / "is not null"
```

**Operators:** `=`, `!=`, `<`, `<=`, `>`, `>=`, `like`, `is null`, `is not null`.

- `like` is case-insensitive substring containment — `value: "voorhout"` matches
  `"Lange Voorhout"`. No wildcard syntax (`%`, `_`) to learn or escape.
- `is null` / `is not null` take no `value`; schema forbids supplying one alongside
  either. Matching is exact/case-sensitive like every other operator here — `"IS NULL"`
  or `"Is Null"` doesn't match; author it lowercase, exactly as shown.
- No implicit type coercion, anywhere. `{ source: guards_visible, operator: ">",
  value: 2 }` compares a string (radio field values are always strings) against a
  number and is a **type mismatch**, not a coercion opportunity — see §4.2. Author
  intent: `value: "2"`.

### 2.4 Worked example

Using only what this spec defines (plain `radio`, no new field types or variants —
those belong to the consent-screen spec that motivated this one, built on top of what
ships here):

```yaml
- id: all_sixteen_plus
  type: radio
  label: Is everyone in your team 16 or over?
  options: ["Yes", "No"]

- id: promo_consent
  type: boolean
  label: The organisers may use my photos and videos to promote future hunts.
  isVisible:
    initially: conditional
    condition: { source: all_sixteen_plus, operator: "=", value: "Yes" }
```

The consent screen's actual field list (segmented radio, the conditional `note` block)
is specified in that follow-up spec.

---

## 3. Reference resolution — `source` and `value`

This section covers the string form of `source`/`value` — the only form this spec
implements. Both are typed as `Operand` (§5.1) to leave room for the reserved
`{ function, params }` form (§4.3), but resolving a function operand is out of scope
here entirely; number/boolean literals need no resolution at all.

Two different rules for the string form, resolving an asymmetry that would otherwise
be genuinely ambiguous:

**`source` is always a reference, never a literal.** There's no reason to ask "does
this field's value equal a fixed field-reference-looking string" — `source` exists
specifically to say "go get a value from here." So:

- A bare id (`all_sixteen_plus`) resolves against **this form's own live values**
  (the in-progress `$state`, not a localStorage snapshot — so a sibling field's
  not-yet-submitted answer is visible immediately).
- A dotted string matching `<location_id>.<form_id>.<field_id>` (the same shape the
  textarea `source` field already uses — `parseSourceRef` in
  `src/utils/locationFormLookup.ts`, shared by both features) resolves against
  **another location's persisted form state** via `formStorage`/`localStorage`.
  `formId` is captured for forward compatibility — a location has exactly one form
  today, always literally named `form`, so `parseSourceRef` treats anything else as
  unparseable (§4.2's "not found" error) rather than guessing. This means when
  multi-form locations eventually exist, the reference *format* doesn't need to
  change and no already-authored content needs migrating — only the `formId ===
  "form"` check and `getLocationFormValue`'s lookup grow to handle a real second
  value. `parseSourceRef` was widened to capture this now (see
  `src/utils/locationFormLookup.ts` and its tests) precisely to avoid that future
  migration; this is a small change to already-shipped code, not new to this spec.
- A bare id that matches no field in this form, and isn't dotted-shape → **error**
  (§4.2) — this is a detectable authoring typo.
- A dotted reference to a location/field that simply hasn't been answered yet
  resolves to `undefined`, which is **not an error** — it's a normal runtime state
  (the participant hasn't reached that location). The condition evaluates as not-met.
  This matches the existing `source`/textarea behavior exactly, including its
  limitation: there's no way to tell "not yet answered" apart from "location id
  doesn't exist at all" without loading that location's own YAML, which this resolver
  doesn't do (neither does the textarea feature today).

**`value` is a literal unless it has the dotted reference shape.** Literals are the
common case for `value` (`"Yes"`, `2`, `true`) — requiring explicit full qualification
(`004_loc_lange_voorhout.form.manifesto`) before treating it as a reference means a
literal can never be accidentally misread as one; a real dotted `x.form.y` string is
never going to collide with a legitimate comparison literal. `value` has **no bare-id
shorthand** — unlike `source`, a bare word in `value` is always a literal, never
resolved against this form's own fields. (If you need to compare two fields in the
same form, put the one you're testing in `source` and flip the comparison, or use two
conditions under `all`.)

---

## 4. Evaluation

### 4.1 Result shape

The resolver returns one of three states, not a boolean — callers need to distinguish
"legitimately not visible" from "something's wrong, show that, don't just hide it":

```ts
type VisibilityResult =
  | { status: "visible" }
  | { status: "hidden" }
  | { status: "error"; message: string };
```

### 4.2 Failure modes

| Situation | Result |
|---|---|
| `isVisible` absent | `visible` (zero-cost default) |
| `initially: hidden` | `hidden`, unconditionally |
| `initially: visible` | `visible`, unconditionally |
| Condition evaluates true/false | `visible` / `hidden` |
| `source` bare id not found among this form's fields | `error` |
| `source`/`value` dotted reference to an unanswered location | resolves to
  `undefined` → condition not-met → `hidden` (not an error — see §3) |
| Operator applied to mismatched types (e.g. `>` on a string vs. a number) | `error` |
| Unknown/misspelled `operator` | `error` (schema should already catch this at
  authoring time; this is the runtime backstop) |
| `source`/`value` references a `function` (reserved, unimplemented — see §4.3) |
  CI-blocked before it ships; throws in dev/test; `hidden` in the unlikely event one
  reaches production |

**`error` is a visible, in-place sentinel — the same move as `AppForm`'s existing
unknown-field-type handling (`af-field--unknown` / `unrecognized field '${id}'`), not
a thrown exception.** A live participant's screen must never crash because of a
malformed condition; the point of "fail hard, fail fast" here is that a reviewer or
tester sees the problem immediately on the screen, not that the app throws for a real
user. An errored field/node is excluded from form validation (can't block submit) but
stays visibly flagged rather than silently disappearing or silently passing.

### 4.3 `function` — reserved, not implemented

```yaml
condition:
  source: { function: team_size_over, params: [4] }
  operator: "="
  value: true
```

The shape is schema-valid so it can be authored and reviewed today, but nothing
resolves it yet. `npm run validate:yaml` rejects any YAML using it (not-yet-implemented
error, same CI gate that already blocks other schema violations) so it can't ship. If
hit directly in dev/test (bypassing CI), the resolver throws immediately. The
production code path additionally treats an unresolved `function` reference as
`hidden` rather than throwing, purely as a belt-and-suspenders fallback — CI should
make this path unreachable in practice.

`params` being `Operand[]` (not flat literals) means a later transform can take a
source reference — or another function call — as an argument, e.g. (not implemented,
illustrative only):

```yaml
# aggregate over a single multi-valued source
source: { function: max, params: [scores] }
operator: ">"
value: 10

# combine two sources before comparing
source: { function: join, params: [first_name, last_name] }
operator: like
value: "smith"
```

Whether a given function's params are interpreted as literals or as references (bare
id / dotted, per §3) is up to that function's own implementation when it's built —
`team_size_over`'s `params: [4]` wants a literal threshold, `join`'s params want
resolved source values. The generic layer doesn't need an opinion on this now; the
type already permits either per param.

Implement `function` support only when a concrete use case needs it. Do not build the
registry now.

---

## 5. Technical implementation

### 5.1 Types — `src/types/conditions.ts` (new file, generic — not form-specific)

```ts
export type ConditionOperator =
  | "=" | "!=" | "<" | "<=" | ">" | ">="
  | "like" | "is null" | "is not null";

// A reference string (bare id / dotted cross-form ref, per §3), a literal, or a
// reserved function call whose params are themselves Operands — recursive so a
// future `max`/`min`/`join`-style transform can take a source reference (or
// another function call) as an argument without changing this type again.
export type Operand =
  | string
  | number
  | boolean
  | { function: string; params?: Operand[] };

export interface ConditionLeaf {
  source: Operand;
  operator: ConditionOperator;
  value?: Operand;
}

export interface ConditionAny { any: ConditionNode[]; }
export interface ConditionAll { all: ConditionNode[]; }
export interface ConditionNot { not: ConditionNode; }

export type ConditionNode = ConditionLeaf | ConditionAny | ConditionAll | ConditionNot;

export interface VisibilityConfig {
  initially: "visible" | "hidden" | "conditional";
  condition?: ConditionNode;
  any?: ConditionNode[];
  all?: ConditionNode[];
  not?: ConditionNode;
}
```

`FormField` (`src/types/data.ts`) gains `isVisible?: VisibilityConfig`, importing the
type from `conditions.ts` rather than defining it inline — the point of the separate
file is that a future `TextEntry`/`OptionsEntry`/etc. can add the same
`isVisible?: VisibilityConfig` property without importing anything form-specific.

### 5.2 Resolver — `src/utils/visibility.ts` (new file)

```ts
export interface VisibilityContext {
  values: Record<string, unknown>;   // this form's live $state values
  fieldIds: Set<string>;             // for bare-id existence checks
  project?: string; city?: string; route?: string; // for dotted cross-form refs
}

export function evaluateVisibility(
  config: VisibilityConfig | undefined,
  ctx: VisibilityContext,
): VisibilityResult
```

Pure function, no Svelte dependency, independently testable. `getLocationFormValue`
(`src/utils/locationFormLookup.ts`) currently narrows its return to `string | undefined`
(the textarea-source feature only ever needed strings) — broaden it to return `unknown`
so the visibility resolver can compare against booleans/numbers too; move the
`typeof value === "string"` narrowing into `SourcedTextareaField`'s one call site,
which is the only place that actually needs a string.

### 5.3 `AppForm.svelte` integration

- For each field, compute `evaluateVisibility(field.isVisible, ctx)` reactively
  (`$derived`, since it must recompute as `values` changes — e.g. the moment the
  participant picks an age answer).
- `status: "hidden"` → field doesn't render at all (not just visually collapsed).
- `status: "error"` → renders the existing `af-field--unknown`-style sentinel with
  `message`, excluded from validation, same as an unrecognized field type today.
- `status: "visible"` → renders normally.
- An `$effect` clears `values[id]` (and `uploadStates[id]` for photo/video fields, if
  ever combined with `isVisible`) whenever a field's status flips from `visible` to
  `hidden`, so a hidden field can never contribute a stale value to `onSubmit`'s
  payload. This is the generic form of "switching yes→no clears any ticked consent."
- Cross-form `source`/`value` resolution needs `project`/`city`/`route` in scope,
  which `AppForm` doesn't currently receive (it's location-agnostic; `ChallengeForm`
  knows these and wraps `AppForm`). Add optional `formContext?: { project: string;
  city: string; route?: string }` to `AppForm`'s props, passed through by
  `ChallengeForm`. Left `undefined` in contexts that don't need it (editor form, team
  setup); a dotted cross-form reference used without `formContext` present is an
  `error` (can't resolve, fail hard — matches §4.2).

### 5.4 Schema — `form.schema.json`

Add `isVisible` to the field object's `properties`, `$ref`-ing a `conditionNode`
definition matching §5.1's discriminated union (`condition`/`any`/`all`/`not` as
mutually exclusive `oneOf` branches, `value` forbidden alongside `"is null"`/
`"is not null"`, `initially: visible|hidden` forbidden alongside any condition key).
`validate:yaml` additionally rejects any `source`/`value` shaped as `{ function: ... }`
(§4.3) until that's implemented — a hand-written check in
`scripts/validate-yaml.js`, since JSON Schema alone can express "this shape is
disallowed" but not "reject it with a specific not-yet-implemented message."

---

## 6. Testing

- `src/test/visibility.test.ts` (new, pure-function tests — no Svelte rendering
  needed): each operator, each combinator, bare-id vs. dotted resolution, the
  existence-vs-unanswered distinction for `source`, type-mismatch → error, `function`
  → error outside production / hidden fallback in production (mock the env check).
- `AppForm.test.ts`: hidden field excluded from DOM and from `onSubmit` payload;
  switching a driving field's answer clears a dependent field's value; error state
  renders the sentinel and doesn't block submit of the rest of the form.

---

## 7. Acceptance checklist

- [ ] `isVisible` absent on a field behaves identically to today (no regression for
      every existing form YAML).
- [ ] `initially: visible` / `initially: hidden` are unconditional; schema rejects a
      condition block alongside either.
- [ ] `initially: conditional` requires exactly one of `condition`/`any`/`all`/`not`.
- [ ] `any`/`all`/`not` compose recursively to arbitrary depth.
- [ ] `source` bare id resolves against this form's live values; dotted resolves
      cross-form via existing `formStorage` persistence.
- [ ] `value` is a literal unless dotted-shape; no bare-id shorthand for `value`.
- [ ] No implicit type coercion on any operator; mismatched-type comparisons render a
      visible error, never a silent `false`.
- [ ] `like` is case-insensitive substring containment, no wildcards.
- [ ] `"is null"`/`"is not null"` reject an accompanying `value`; matching is exact/
      case-sensitive like every other operator.
- [ ] A same-form `source` referencing a nonexistent field id renders a visible error.
- [ ] A dotted reference to an unanswered (not-yet-visited) location resolves to
      hidden, not an error.
- [ ] A field flipping visible→hidden has its stored value cleared, not just hidden.
- [ ] Hidden and errored fields are excluded from validation; errored fields still
      render their sentinel and don't silently disappear.
- [ ] `function` references are rejected by `validate:yaml`, throw in dev/test, and
      fall back to hidden (never throw) in production.
- [ ] No component other than `AppForm`/`FormField` consumes `isVisible` yet.

---

## 8. Non-goals / deferred

- Wiring `isVisible` into any route-entry type (`TextEntry`, `OptionsEntry`,
  `SplashEntry`, `CompletionEntry`) or into individual buttons/options within them —
  build this only when a concrete screen needs it.
- Implementing `function` conditions — including transform/aggregate-style ones
  (`max`, `min`, `join`, etc.) as well as arbitrary predicates (`team_size_over`).
  The type (`Operand`, §5.1) is already shaped to accommodate these without a future
  breaking change; only the registry and resolver logic are deferred.
- Multi-field references inside `value` beyond the dotted cross-form shape (no
  same-form bare-id shorthand for `value`).
- SQL wildcard semantics for `like`.
- Any editor/visual-authoring UI for `isVisible` — hand-authored YAML only, same as
  every other template-type today.
- `variant: segmented` on `radio` and the `note` field type — real, but they belong to
  the consent-screen spec that motivated this one, not to this spec's implementation.
