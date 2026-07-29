# Completion Screen — Data-Driven Buttons — Design

**Date:** 29/07/2026
**Status:** Ready for planning

## Problem

`CompletionScreen.svelte` ([`src/components/CompletionScreen.svelte:190-200`](../../../src/components/CompletionScreen.svelte#L190-L200))
renders two action buttons, but only the primary one is actually data-driven:

- `registration` (`{ text, url }`) — authored per-city in the entry YAML, renders as
  `<a class="cmpl-btn-primary">`.
- The secondary button — label `"See your answers"` and destination
  `/${project}/${cityId}/results_download` — is hardcoded in the component
  ([`CompletionScreen.svelte:142-144`](../../../src/components/CompletionScreen.svelte#L142-L144),
  [`:194-196`](../../../src/components/CompletionScreen.svelte#L194-L196)). Nothing in
  the entry's YAML or its schema
  ([`completion.schema.json`](../../../src/data/schemas/completion.schema.json))
  reflects that a second button exists at all, or lets an author change its text,
  destination, or omit/reorder it.

This was a deliberate v1 scope cut in the original completion-screen spec ("`no schema
field needed`" — [`2026-07-29-completion-screen-design.md:154-155`](2026-07-29-completion-screen-design.md#L154-L155)),
not an oversight. This spec reverses that cut: both buttons become one authored list.

## Decisions (confirmed with the user)

1. **Cardinality:** `buttons` is an arbitrary list (0..N — practically 1..N, see schema
   below), not two fixed slots. Mirrors the existing `OptionsEntry.options` pattern
   ([`data.ts:187-194`](../../../src/types/data.ts#L187-L194)) rather than inventing a
   narrower "primary + secondary" shape.
2. **Destination shape:** the results-download button is authored as a semantic target —
   `{ type: "page", value: "results" }` — not a literal path. The component still builds
   the URL from its own `project`/`cityId` props at render time, the same way
   `goToResults()` does today. A literal path (`"democrats_abroad/den_haag/results_download"`,
   as first drafted) was rejected: every city's YAML would have to spell out its own
   project/city slug correctly, and a rename would break it silently with no schema error.
3. **Color:** optional per button (`primary` | `secondary`), falling back to a
   **theme-level default** (not a hardcoded "first button primary, rest secondary"
   convention) when omitted.
4. **Reuse scope:** the user's stated intent is a *generic* full-width button used on
   other screens later ("locations" specifically named), not a completion-specific
   concept. **Decided:** build the shared component and type now, generically named, but
   wire it into `CompletionEntry` only in this pass. Adding a `buttons` field to
   `LocationEntry`/`ChallengeCard` is explicitly out of scope here — that screen's layout
   (where a button sits relative to the form) needs its own design pass.

## Design

### New shared component: `WideButton.svelte` (+ `.css`)

`src/components/WideButton.svelte` — not co-located with `CompletionScreen`, since it's
meant to be imported by more than one screen going forward (Decision #4). Same pattern as
other shared atoms in this codebase (`MarkdownText.svelte`, `ScreenHero.svelte`).

```ts
// props
{
  text: string;
  target: OptionTarget;
  color?: "primary" | "secondary";
  project: string;
  cityId: string;
}
```

- `target.type === "link"` → `<a class="wide-btn ..." href={target.value} target="_blank" rel="noopener noreferrer">`.
- `target.type === "page"` → `<button class="wide-btn ..." type="button" onclick={...}>`, resolving the destination via the shared helper below and calling `push()`.
- Resolved color: `color ?? $themeStore.theme.defaultButtonColor` selects `wide-btn--primary` or `wide-btn--secondary`.
- New CSS file `WideButton.css`, BEM prefix `wide-btn` (`wide-btn`, `wide-btn--primary`,
  `wide-btn--secondary`). Rule values are lifted verbatim from today's
  `.cmpl-btn-primary`/`.cmpl-btn-secondary`
  ([`CompletionScreen.css:125-154`](../../../src/components/CompletionScreen.css#L125-L154))
  — visual output is unchanged, only the class names and file move. Those two rule blocks
  are deleted from `CompletionScreen.css` once `WideButton` exists.

### New shared type: `WideButtonConfig`

Lives in `src/types/data.ts` next to `OptionTarget`, not nested under `CompletionEntry` —
it's the generic building block, `CompletionEntry` just happens to be the first consumer:

```ts
export interface WideButtonConfig {
  text: string;
  target: OptionTarget;
  color?: "primary" | "secondary";
}
```

### `OptionTarget` gains a `"results"` page value

`src/types/data.ts`:

```ts
export type OptionTarget =
  | { type: "link"; value: string }
  | { type: "page"; value: "title" | "project" | "start_route" | "gallery" | "continue" | "results" };
```

`"results"` resolves to `/${project}/${cityId}/results_download` — the exact string
`goToResults()` builds today
([`CompletionScreen.svelte:142-144`](../../../src/components/CompletionScreen.svelte#L142-L144)).

**Shared resolution helper**, new file `src/utils/optionTargets.ts`:

```ts
function resolvePageUrl(
  value: "title" | "project" | "start_route" | "gallery" | "results",
  ctx: { project: string; city: string; route?: string },
): string
```

Covers every `page` value that resolves to a URL. `"continue"` is excluded from this
helper's signature — it's not a URL, it invokes `OptionsScreen`'s `onContinue` callback,
and that branching stays local to `OptionsScreen.svelte`'s own `handlePageSelect`
([`OptionsScreen.svelte:51-64`](../../../src/components/OptionsScreen.svelte#L51-L64)),
which now delegates to `resolvePageUrl` for the five URL-producing cases instead of
duplicating the `if`/`else` chain. `WideButton` calls the same helper directly for its
`page`-type targets. This is extraction of genuine duplication (two real call sites), not
speculative reuse.

### Theme gains a default button color

`src/types/theme.ts` — `Theme` gains `defaultButtonColor: "primary" | "secondary"`.
`src/theme/themes.ts` — all three presets (`wireframe`, `app`, `GWC`) set
`defaultButtonColor: "primary"`, matching today's implicit behavior (the only button that
has ever rendered without an explicit color intent was the primary CTA).

### `CompletionEntry` schema change

`src/types/data.ts`:

```ts
export interface CompletionEntry {
  "template-type": "completion";
  image: string;
  title: string;
  subtitle: string;
  place: string;
  caption?: string;
  closing_text?: string;
  buttons: WideButtonConfig[];
  hint?: string;
  "nav-bar"?: NavBarConfig;
}
```

`registration` is removed entirely — replaced by `buttons`.

`src/data/schemas/completion.schema.json`:

- `registration` requirement removed; `required` becomes `["template-type", "image", "title", "subtitle", "place", "buttons"]`.
- `buttons`: `{ type: "array", minItems: 1, items: { ...WideButtonConfig shape... } }`.
- Each button item: `additionalProperties: false`, `required: ["text", "target"]`,
  `text: string`, `color: { enum: ["primary", "secondary"] }` (optional),
  `target`: `oneOf` of
  `{ type: "link", value: string }` (required `type`, `value`) and
  `{ type: "page", value: enum }`, where the `page` enum is restricted to
  `["title", "project", "gallery", "results"]` — **not** `start_route`/`continue`. Neither
  is meaningful on a screen the player only ever reaches once, at the end of the route,
  with no `onContinue` handler to call.

### `CompletionScreen.svelte` changes

- Prop `registration: { text; url }` removed. New prop `buttons: WideButtonConfig[]`.
- `goToResults()` and the hardcoded `<button class="cmpl-btn-secondary">` are deleted.
- The actions block becomes a loop:
  ```svelte
  {#each buttons as button, i (i)}
    <WideButton {...button} {project} {cityId} />
  {/each}
  ```
- `RouteScreen.svelte`'s completion branch
  ([`RouteScreen.svelte:70-84`](../../../src/components/RouteScreen.svelte#L70-L84))
  passes `buttons={entry.buttons}` instead of `registration={entry.registration}`. No new
  props needed on `RouteScreen` itself — `project`/`cityId` are already threaded through.

### Migrated YAML

`009_completion_den_haag.yaml`'s `registration` block is replaced. The second button's
copy changes from the old hardcoded `"See your answers"` to `"See your results"`,
matching the user's original request text (a deliberate copy change, not an accidental
rename):

```yaml
buttons:
  - text: "Check your voter registration"
    target: { type: link, value: "https://www.democratsabroad.org/nl" }
    color: primary
  - text: "See your results"
    target: { type: page, value: results }
    color: secondary
```

No other completion-type YAML files exist yet, so this is the only content migration.

## Testing impact

- `src/test/CompletionScreen.test.ts` — `baseProps.registration` replaced with a
  `buttons` array; the two button-specific tests (registration link, secondary
  navigation) are rewritten against the new prop shape; a new test covers the
  theme-default fallback when a button omits `color`.
- `src/test/completionSchema.test.ts` — `validDoc.registration` replaced with a minimal
  `buttons` array; "rejects missing registration" becomes "rejects missing buttons" /
  "rejects an empty buttons array"; new cases for an invalid `page` value (e.g.
  `start_route`, which must now be rejected for this template-type) and a malformed
  `target`.
- `src/test/OptionsScreen.test.ts` — unaffected in behavior (page-value resolution is
  extracted, not changed), but worth a regression pass since `handlePageSelect` now
  delegates to `resolvePageUrl`.
- New test file for `resolvePageUrl` (`src/utils/optionTargets.ts`) covering all five URL
  cases.

## Out of scope

- Adding `buttons`/`WideButton` to `LocationEntry`/`ChallengeCard` (Decision #4) — needs
  its own placement design (where a button sits relative to the challenge form).
- Migrating `OptionsScreen.svelte`'s own button list onto `WideButton`/`WideButtonConfig`
  — `OptionsScreen`'s buttons have no primary/secondary distinction today; folding it in
  is a follow-up, not required for this fix.
- Admin-editor authoring support for `buttons` (matches the existing gap for every other
  template-type field, per `doc/architecture.md`).
- Adding `start_route`/`continue` as valid completion-button targets — excluded
  deliberately (see schema section above), can be revisited if a real use case shows up.

## Reference

Builds directly on [`2026-07-29-completion-screen-design.md`](2026-07-29-completion-screen-design.md),
which shipped the `completion` template-type this spec modifies (commit `4a94b9f`,
per this session's git log). That spec's Decision #1 explicitly deferred this exact
generalization ("a fixed `'See your answers'` is fine for v1 — no schema field needed") —
this spec is that deferred work.
