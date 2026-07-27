# Storyline Blocks & Progressive Disclosure — Design

**Date:** 27/07/2026
**Status:** Draft (revises an external v0.1 draft against this repo's actual stack)

## Problem

Location storylines are one long markdown string (`storyline: |` in each
`*_loc_*.yaml`) rendered as-is through `marked.parse()` inside
[MarkdownText.svelte](../../../src/components/MarkdownText.svelte). Longer
stops (e.g.
[001_loc_right_to_read.yaml](../../../src/data/text/en/projects/democrats_abroad/den_haag/001_loc_right_to_read.yaml))
read as a wall of text with no visual hierarchy and no way to separate the
summary a player needs from the background they can optionally dig into.

This spec introduces a **closed set of six content blocks** — `prose`,
`hook`, `stats`, `reveal`, `callout`, `detail` — authored as lightweight
directives inside the same `storyline` string. Authors keep writing markdown;
the renderer, not the author, owns layout. `detail` is the load-bearing piece:
it marks the fold, so any location can go from wall-of-text to
summary-plus-optional-detail by wrapping its back half in one directive.

## Corrections to the original draft

An earlier pass at this spec (v0.1, pasted into this conversation) assumed a
remark/mdsvex pipeline and a Svelte-4-or-5 fork. Neither matches this repo.
Concretely:

1. **No mdsvex, no remark, no `remark-directive`.** The only markdown
   dependency is `marked@18` ([package.json](../../../package.json)), used
   in exactly one place —
   [MarkdownText.svelte](../../../src/components/MarkdownText.svelte):
   `{@html marked.parse(text)}`. `marked` has no directive/container-block
   concept. Directive parsing has to be a small hand-rolled tokenizer that
   runs *before* `marked`, splitting the raw `storyline` string into blocks;
   `marked.parse()` still runs per-block on prose-bearing bodies (see
   "Parsing"). No new dependency is added.
2. **Svelte is 5-only here** (`CLAUDE.md`: "Reactivity uses Svelte 5 runes
   ... Do not use Svelte 4 `$:`"). The original spec's Svelte-4 fallback
   notes are dead weight — dropped entirely below.
3. **No zod/valibot/typebox in this repo.** The only schema-validation
   library is `ajv` (`^8.20.0`), and it validates the *outer* YAML shape
   (`src/data/schemas/location.schema.json` etc.) at CI time — it isn't
   suited to a discriminated union with cross-field rules like "at most one
   `detail`". Block validation below is a small hand-written TS function,
   consistent with the fact nothing heavier is used for in-app data anywhere
   else in this codebase.
4. **`storyline` stays `{ "type": "string" }` in `location.schema.json` —
   unchanged.** Directive text is still just a string as far as the JSON
   Schema / ajv layer is concerned. Block-level validation is a second,
   separate stage (see "CI integration"), not a schema change.
5. **This repo already has a two-layer pattern for exactly this problem**
   (`doc/architecture.md` § YAML Data Validation): a CI script
   (`scripts/validate-yaml.js`, Layer 3) that fails loudly on bad content,
   and a runtime fallback (`AppForm.svelte` rendering
   `unrecognized field '${id}'` instead of crashing, Layer 2) for anything
   that slips through. Sections below plug into these two existing layers
   rather than inventing a third validation mechanism.
6. **No `Prose` component is needed.** `MarkdownText.svelte` already is the
   "render a markdown string" component the original spec asked `Prose` to
   be. Plain-prose blocks, and the markdown body inside `callout`/inside
   `detail`'s leaf blocks, reuse `MarkdownText` directly.

Everything else in the original draft — the six-block vocabulary, the
directive attribute shapes, the "at most one `detail`" rule, the degrade-
never-crash principle, the phased migration order — holds up and is kept.

## Block vocabulary (unchanged from v0.1)

| Block | Purpose | Authored as |
|---|---|---|
| `prose` | Ordinary paragraph(s) | plain markdown (no directive) |
| `hook` | Display lead line | `:::hook` |
| `stats` | Grid of value/label pairs | `:::stats` |
| `reveal` | Tap-to-reveal answer behind a cover | `:::reveal` |
| `callout` | Labelled soft card (task, quote, note) | `:::callout` |
| `detail` | The fold — collapsed below-the-line content | `:::detail` |

Rule, enforced by validation: **at most one `detail` per storyline**, and
`detail` may contain any other block except another `detail`.

### Authoring syntax

```markdown
:::hook{accent="just about books"}
Book bans are not just about books.
:::

They are about who gets to be seen, and what young people are allowed to encounter.

:::stats{caption="Recorded by PEN America, 2024–2025 school year."}
- 6,870 | school book bans
- 23 | states
- 87 | school districts
:::

:::reveal{answer="6,870" cover="redaction" hint="in a single school year"}
Guess how many bans that was last year, then check yourself:
:::

:::callout{label="Your job" tone="task"}
Find one of those books **in the wild** — not in a display, not in a hearing,
but on a shelf in The Hague.
:::

:::detail
The American Library Association tracks the same wave in public libraries...
:::
```

Per-directive attributes (unchanged from v0.1):

- **`hook`** — `accent?` (substring of the body to render in accent colour).
- **`stats`** — body is a markdown list, `- value | label` per line.
  `caption?`. 1–4 items.
- **`reveal`** — `answer` **required**; `cover?` ∈ `redaction | blur | card`
  (default `card`); `hint?`.
- **`callout`** — `label?`; `tone?` ∈ `default | task | quote` (default
  `default`). Body is markdown.
- **`detail`** — no attributes. Body is any blocks except `detail`.

This is plain text inside the existing YAML `storyline: |` block scalar — no
YAML shape change, and it's the same text the editor already exposes as a
`textarea` field (`location_form.yaml:43`, field type `textarea`; see
"Editor impact" below).

## Typed content model

`src/types/storyline.ts` (new file, parallel to `src/types/results.ts`):

```ts
export type Cover = "redaction" | "blur" | "card";
export type CalloutTone = "default" | "task" | "quote";

export interface StatItem {
  value: string; // "6,870" — never coerced to number, must round-trip verbatim
  label: string;
}

export type StoryBlock =
  | { type: "prose"; markdown: string }
  | { type: "hook"; text: string; accent?: string }
  | { type: "stats"; items: StatItem[]; caption?: string }
  | { type: "reveal"; prompt: string; answer: string; cover: Cover; hint?: string }
  | { type: "callout"; markdown: string; label?: string; tone: CalloutTone }
  | { type: "detail"; blocks: LeafBlock[] };

export type LeafBlock = Exclude<StoryBlock, { type: "detail" }>;
```

## Parsing

`src/utils/storylineBlocks.ts` (new file, alongside `resultsMarkdown.ts` /
`routeEntries.ts` — same "pure function over a string/data, independently
unit-testable" shape those already use):

```ts
export function parseStoryline(text: string): StoryBlock[];
export function validateStoryline(blocks: StoryBlock[]): string[]; // returns warning strings, [] = clean
```

`parseStoryline` is a line-based tokenizer, **not** a `marked`/remark
extension:

1. Scan lines for a top-level `^:::(\w+)(\{[^}]*\})?\s*$` open fence and a
   matching `^:::\s*$` close fence. Everything between two directive fences
   (or before the first / after the last) is a `prose` run.
2. Attributes inside `{...}` are `key="value"` pairs — a single
   `/(\w+)="([^"]*)"/g` regex pass is sufficient; no attribute value needs
   nesting or escaping beyond a literal `"`.
3. `detail`'s body is tokenized the same way, recursively, but a `detail`
   fence encountered inside that recursive pass is treated as unknown/inert
   (never nests) — enforced again explicitly in `validateStoryline`.
4. `stats` body lines matching `^-\s*(.+?)\s*\|\s*(.+)$` become
   `{ value, label }`; a line without `|` is skipped (never crashes the
   parse).
5. Blank prose runs (whitespace-only) are dropped rather than emitted as
   empty `prose` blocks.
6. `marked.parse()` is **not** called inside the tokenizer — it runs later,
   per-block, only where a block carries a `markdown` field (`prose`,
   `callout`), via the existing `MarkdownText` component. The tokenizer's
   only job is structure.

`validateStoryline` checks, returning human-readable warning strings (no
dependency, plain TS — see "Corrections" #3):

1. At most one top-level `detail`.
2. No `detail` inside a `detail`'s blocks (belt-and-suspenders with parsing
   rule 3 above).
3. `reveal.answer` non-empty.
4. `stats.items.length` between 1 and 4.
5. `hook.accent`, if present, is a substring of `hook.text` (`text.includes(accent)`).
6. `cover` / `tone` are within their literal unions.

### Degradation (never crash, mirrors the existing Layer 2 pattern)

Same principle as `AppForm.svelte` rendering
`unrecognized field '${id}'` instead of throwing on an unrecognised form
field type:

- **Unknown directive name** (`:::whatever`) → its body becomes a `prose`
  block. `console.warn` in dev only.
- **Missing required attr** (`reveal` with no `answer`) → drop the reveal
  interaction, render the prompt as `prose`. `console.warn` in dev only.
- **Malformed `stats` line** → skip that line, keep the rest.
- **Zero directives in a storyline** → output is a single `prose` block
  containing the whole string — byte-for-byte what `MarkdownText` renders
  today. This is the regression safety net for all ~90 existing
  `*_loc_*.yaml` files across `den_haag`, `oslo`, `paris`, `new_york`, and
  `demo`.

## Rendering

New components, flat in `src/components/` (this repo has no `src/lib`; the
one existing subfolder, `components/effects/`, is the only precedent for
grouping — not used here since these are ordinary components). Each gets a
co-located `.css` file per convention, full BEM
(`component-name__element--modifier`) per `CLAUDE.md`:

- **`Storyline.svelte`** (+ `.css`) — new entry point. Takes `{ text: string }`,
  calls `parseStoryline` + `validateStoryline` inside a `$derived`, renders
  each block via `StoryBlockRenderer`. **Replaces**
  `<MarkdownText text={location.storyline} />` at
  [ChallengeCard.svelte:129](../../../src/components/ChallengeCard.svelte#L129).
  `MarkdownText`'s own call site in `TextScreen.svelte` (the generic `text`
  template-type) is untouched — this feature only touches the `storyline`
  field on `Location`.
- **`StoryBlockRenderer.svelte`** — the dispatcher. Svelte 5 component-map +
  dynamic component, per the original spec's approach (this part was already
  framework-correct):

  ```svelte
  <script lang="ts">
    import type { StoryBlock } from "../types/storyline";
    import MarkdownText from "./MarkdownText.svelte";
    import StoryHook from "./StoryHook.svelte";
    import StoryStats from "./StoryStats.svelte";
    import StoryReveal from "./StoryReveal.svelte";
    import StoryCallout from "./StoryCallout.svelte";
    import StoryFold from "./StoryFold.svelte";

    let { block }: { block: StoryBlock } = $props();
  </script>

  {#if block.type === "prose"}
    <MarkdownText text={block.markdown} />
  {:else if block.type === "hook"}
    <StoryHook {block} />
  {:else if block.type === "stats"}
    <StoryStats {block} />
  {:else if block.type === "reveal"}
    <StoryReveal {block} />
  {:else if block.type === "callout"}
    <StoryCallout {block} />
  {:else if block.type === "detail"}
    <StoryFold {block} />
  {/if}
  ```

  An `if/else-if` chain (not a `MAP` + `<Comp {block} />`) is used because
  this repo's ESLint config enforces `complexity: 10` and `curly: all` on
  every branch, and the chain keeps exhaustiveness checkable with a trailing
  `default: { const _exhaustive: never = block; }`-style guard in a plain
  `.ts` switch helper (`blockKind(block)`) that TypeScript, not ESLint, is
  responsible for catching — same "new `type` fails to compile until mapped"
  guarantee the original spec wanted, achieved without introducing a runtime
  `MAP` object this codebase has no other precedent for.
- **`StoryHook.svelte`**, **`StoryStats.svelte`**, **`StoryReveal.svelte`**,
  **`StoryCallout.svelte`**, **`StoryFold.svelte`** — one per remaining
  block kind, each with its own co-located `.css`.
  - `StoryReveal`: local `let revealed = $state(false)`; cover chosen by
    `block.cover` via a class (`.story-reveal__cover--redaction` /
    `--blur` / `--card`), not a sub-component per cover — three CSS
    treatments of one element, not three components.
  - `StoryFold`: local `let open = $state(false)`; when open, recurses back
    through `StoryBlockRenderer` for each of `block.blocks`. State is
    component-local — no store, matching how the rest of this app avoids
    global stores for view-local toggle state.
  - `StoryCallout`'s body (`block.markdown`) renders via `<MarkdownText
    text={block.markdown} />`, same reuse as `prose`.

Accessibility (new pattern in this codebase — no existing
`aria-expanded`/`prefers-reduced-motion` usage to match against, so this is
an explicit addition, not a convention-following one): `StoryFold`'s toggle
and `StoryReveal`'s cover are real `<button>` elements with
`aria-expanded`/`aria-pressed`; fold/reveal transitions are wrapped in
`@media (prefers-reduced-motion: no-preference)`.

## CI integration

Extends the existing **Layer 3** step
([scripts/validate-yaml.js](../../../scripts/validate-yaml.js), `npm run
validate:yaml`) rather than adding a new script or CI job: after a
`*_loc_*.yaml` file passes its `ajv` structural check, additionally run
`parseStoryline(doc.storyline)` → `validateStoryline(...)` and print any
warnings through the same `ERROR: <path>: <message>` stderr format the
script already uses for schema errors, so a bad `:::detail` nesting or a
`reveal` with no `answer` fails CI the same way a bad YAML shape does today.
This is the "loud in dev" half of the original spec's validation
requirement, mapped onto a mechanism that already exists instead of a
framework-level throw (there is no dev/prod build-mode branch to hook in
this app the way the original spec assumed).

The runtime half (component never crashes on bad input) is the degradation
behaviour described above, always active — CI failing is what should
normally prevent bad content from being merged, not something the renderer
depends on to stay safe.

## Editor impact

[EditorLocationForm.svelte](../../../src/pages/editor/EditorLocationForm.svelte)
renders `storyline` as a plain `type: textarea` field
(`src/data/text/en/editor/location_form.yaml:43`). Directives are just text
typed into that existing textarea — **no editor changes required for v1**.
A directive-aware editing UI (live block preview, attribute picker, etc.) is
explicitly out of scope, same as the original draft's stance, just now
confirmed rather than assumed.

## Migration plan

Same phased order as the original draft, now concrete about scope:

1. **Ship parser, components, validation, CI check.** Zero content changes;
   every existing `*_loc_*.yaml` (den_haag, oslo, paris, new_york, demo —
   ~90 files) renders identically via the "zero directives → one `prose`
   block" fallback.
2. **Roll out `:::detail`** to each location, picking the natural
   summary/detail split. Content-only change, one YAML file at a time,
   each independently reviewable and revertable.
3. **Add `:::hook`** to each location's opening line.
4. **Add `:::stats`** only where a stop already has numbers (e.g. the PEN
   America stats in `001_loc_right_to_read.yaml`) — don't invent stats.
5. **Add `:::reveal`** only where thematically apt (book bans → `redaction`;
   elsewhere → `blur`/`card`/skip).

## Edge cases

- **A `detail` block with zero inner blocks** (author wrote `:::detail\n:::`)
  — renders the fold toggle with an empty body. Not a validation error;
  harmless, so not worth special-casing.
- **A `reveal.hint` with no `answer`** already covered by validation rule 3
  (degrades to prose); a `reveal` with `answer` but no prompt body renders
  an empty prompt above a working cover — allowed, since `answer` is the
  only required piece.
- **Storyline containing literal `:::` inside a code span or as prose**
  (e.g. `` `:::` `` in backticks) — the tokenizer matches on raw lines, not
  markdown-aware parsing, so a bare `:::` line outside backticks would be
  misread as a fence. Not currently a problem in any existing storyline
  content (verified by grep — no `:::` occurs in current YAML); flagged
  here rather than solved, since solving it (context-aware fencing) adds
  complexity for a case that doesn't exist yet.
- **`stats` with 5+ items** — validation warns (rule 4); renderer still
  renders all of them rather than truncating, since silently dropping
  authored content is worse than an ugly grid CI already warned about.

## Non-goals (v1)

Audio/TTS; swipeable card carousels; author-defined block types or covers at
runtime; a directive-aware editor UI; animation beyond fold/reveal
transitions; theming tokens beyond the existing `--color-*`/`--font-size-*`
custom properties; changes to `location.schema.json` or the ajv layer;
changes to `MarkdownText.svelte`'s other call site (`TextScreen.svelte`).

## Acceptance criteria

- [ ] A `storyline` with zero directives renders byte-identical output to
      today's `MarkdownText`-only path (regression check).
- [ ] Each of the five directives renders through its dedicated component
      with the attributes above.
- [ ] A storyline with one `:::detail` shows above-fold content plus a
      working, keyboard-operable "Read the full story" toggle; nested blocks
      render correctly when open.
- [ ] `reveal` shows the prompt + cover; activating it reveals `answer`;
      `cover` swaps `redaction`/`blur`/`card` via CSS class only.
- [ ] Two `:::detail` blocks, `:::detail` nested inside `:::detail`, or a
      `reveal` with no `answer` are caught by `npm run validate:yaml` and
      degrade (never crash) if they somehow reach the renderer anyway.
- [ ] `StoryFold`/`StoryReveal` expose `aria-expanded`/`aria-pressed` and
      honour `prefers-reduced-motion`.
- [ ] `ChallengeCard.svelte` uses `Storyline` in place of the direct
      `MarkdownText` call; `TextScreen.svelte` is unchanged.
- [ ] Adding a location authored with `:::detail`/`:::hook`/`:::stats` (e.g.
      re-authoring `001_loc_right_to_read.yaml`) renders correctly end to
      end as a manual smoke test.
