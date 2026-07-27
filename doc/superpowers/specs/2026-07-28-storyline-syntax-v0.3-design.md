# Storyline Syntax v0.3 — Design

**Date:** 28/07/2026
**Status:** Approved (pending user review of this doc)

## Problem

The `:::name{attr="value"}` fence syntax from v0.1/v0.2 (already shipped, see
[2026-07-27-storyline-blocks-design.md](2026-07-27-storyline-blocks-design.md))
is unreadable in raw source and asks non-technical authors to write
config-object attributes. This revision, proposed by the user, replaces it
with markdown-native constructs (`##`/`==mark==`/`[+]`/`{{type: file}}`) —
same design principles (closed vocabulary, degrade-never-crash,
cheapest-universal-first), different authoring syntax.

The user's proposal (reproduced in full in this session's transcript) is
adopted as-is for vocabulary and semantics. This doc records the
**architecture decisions needed to actually build it against this repo**,
made where the proposal was silent or where two implementations were
possible, per answers given when this was scoped:

1. **`==highlight==` is storyline-scoped, not global.** A dedicated `Marked`
   instance (`marked` v18 exports a `Marked` class for exactly this —
   verified: `new Marked().use({ extensions: [...] })` works in isolation
   from the global `marked` singleton `MarkdownText.svelte` already uses).
   `challenge.description`, breadcrumbs, and everything else rendered
   through `MarkdownText.svelte` keep today's behavior unchanged.
2. **Count-up animation and locale-aware number formatting are deferred.**
   `value: number` renders via `.toLocaleString("en-US")` (fixed locale —
   this content tree is English-only today, and an unpinned locale would
   make rendering, and therefore tests, depend on the host machine's ICU
   config). No animation.
3. **The mobile hero-number responsive layout is deferred.** Ship the flat
   `auto-fit` grid already built in the previous pass; the narrow-viewport
   promoted-first-item treatment is a follow-up.
4. **Callout is removed entirely**, per the user's answer to §7 of their own
   proposal ("Callout was later dropped as a feature, remove from
   parsing"). `StoryCallout.svelte` is deleted.
5. **The standalone `:::reveal` block (for answers not in a stats grid) has
   no v0.3 authoring syntax.** The proposal's vocabulary table (§1) lists
   exactly five constructs — hook, accent, prose, fold, stats transclusion —
   and none of them is a general-purpose reveal. `StoryReveal.svelte` is
   therefore unreachable and deleted along with it. **This is my inference,
   not something explicitly stated** — flagging it because it's a real
   capability loss (a spoiler-safe answer that isn't a stat number can no
   longer be authored at all) — correct me if a future registered
   transclusion type is meant to cover this.
6. **`{{stats: file.yaml}}` resolves at load time, not render time** —
   mirroring the existing `challenge.form: string → FormField[]` resolution
   already in `loadLocations.ts` (`loadAndResolveLocation`, verified at
   [src/utils/loadLocations.ts:46-64](../../../src/utils/loadLocations.ts#L46-L64)).
   `loadText()` is already `async`, already resolves a sibling filename in
   the same directory, already returns `null` gracefully on a missing file —
   the exact shape `{{stats: ...}}` needs. `parseStoryline` itself stays
   **synchronous** (no ripple into `Storyline.svelte`'s `$derived`
   reactivity): the loader resolves referenced files into a
   `Record<string, StatsDoc>` up front and hands that map to the parser as
   a plain lookup argument, the same way it already hands `FormField[]` to
   `ChallengeForm`.
7. **Renamed `detail` → `fold`** as the `StoryBlock` type discriminant, to
   match the proposal's own vocabulary naming (§1 calls it "Fold", not
   "Detail"). `StoryFold.svelte`'s name already matched; only the type tag
   changes.
8. **No dual-parser transition period.** The proposal's §9 migration plan
   assumes many locations need gradual conversion. This repo has exactly
   one (`012_loc_right_to_read_blocks.yaml`, itself only a stakeholder
   preview, not live content). Converting it atomically in the same change
   that ships the parser is simpler and lower-risk than maintaining two
   parsers side by side for a single file.

## Data model

`src/types/storyline.ts` (full replacement):

```ts
export type StatVisibility = "visible" | "click_to_reveal";

export interface StatItem {
  value: number | string;
  label: string;
  visibility?: StatVisibility;
}

export interface StatsDoc {
  prompt?: string;
  footnote?: string;
  items: StatItem[];
}

export type StoryBlock =
  | { type: "prose"; markdown: string }
  | { type: "hook"; markdown: string }
  | { type: "stats"; doc: StatsDoc; ref: string }
  | { type: "fold"; label: string; blocks: FoldBlock[] };

// Everything a fold may contain — no nested fold, no hook (hook is a
// whole-document concept: "the first ## anywhere", not a per-region one).
export type FoldBlock = Extract<StoryBlock, { type: "prose" } | { type: "stats" }>;
```

`value: number | string` on `StatItem` matches the proposal exactly: a
number gets `.toLocaleString("en-US")`; a string (`"1 in 4"`) renders
verbatim.

## New content file kind — `*_stats_*.yaml`

Same tier as `*_form_*.yaml`: its own JSON Schema, its own CI validation
pass, referenced by filename from a parent document (a `storyline` field
instead of a `challenge.form` field).

`src/data/schemas/stats.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Stats",
  "type": "object",
  "additionalProperties": false,
  "required": ["items"],
  "properties": {
    "prompt": { "type": "string" },
    "footnote": { "type": "string" },
    "items": {
      "type": "array",
      "minItems": 1,
      "maxItems": 4,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["value", "label"],
        "properties": {
          "value": { "type": ["number", "string"] },
          "label": { "type": "string" },
          "visibility": { "type": "string", "enum": ["visible", "click_to_reveal"] }
        }
      }
    }
  }
}
```

`minItems`/`maxItems` are expressible directly in draft-07 — ajv catches the
"1–4 items" rule structurally, same tier as `location.schema.json`'s
existing structural checks. **At most one `click_to_reveal`** and **a
`prompt` requires a hidden item** are cross-field rules draft-07 can't
express cleanly (no `maxContains`/`if`/`then` support at this draft level,
matching every other schema already in this repo) — those stay hand-written
functions, same pattern as `validateStoryline`'s existing rules.

## Parsing pipeline

`parseStoryline(text: string, elements: Record<string, StatsDoc>): { blocks: StoryBlock[]; warnings: string[] }`
— stays a pure, synchronous function. Order:

1. **Mask fenced code blocks.** A per-line boolean array (toggles on
   ` ``` `/`~~~`) — hook/fold/transclusion detection skips masked lines.
2. **Extract the hook.** First `^##\s+(.*)$` line found outside a masked
   region, anywhere in the document — not necessarily line 1, though every
   real example has it first. Removed from the stream; becomes
   `{ type: "hook", markdown }`. A second `##` later is untouched — it's
   just a heading inside whatever prose block it falls in.
3. **Split the fold.** First `^\s*\[\+\]\s*(.*)$` line outside a masked
   region: everything after it (to end of document) becomes the raw fold
   region; everything before it (minus the already-extracted hook line) is
   the above-fold region. A second `[+]`-shaped line, now necessarily
   *inside* the fold region, is left as literal text (renders as-is) and
   produces a warning — the parser can't retroactively un-consume it
   without breaking rule "fold runs to end of document."
4. **Dedent the fold region** — strip the minimum common leading whitespace
   across its non-blank lines before further processing, so 2-space,
   4-space, and unindented authoring all behave identically (the proposal's
   explicit reason: 4-space indent is a CommonMark code block).
5. **Extract transclusions** in each region independently: a line matching
   `^\s*\{\{\s*([a-z_]+)\s*:\s*([^}]+?)\s*\}\}\s*$` on its own line, outside
   masked regions. `stats` is the only registered type. Looked up in
   `elements`; found → `{ type: "stats", doc, ref: filename }`; not
   found/unregistered type → dropped (renders nothing, matching the
   proposal's explicit "render nothing" degradation, not a prose fallback)
   with a warning.
6. **Remaining runs become `prose` blocks** (raw markdown string, rendered
   later by the storyline-scoped `Marked` instance — parsing produces
   strings, not HTML, same separation of concerns as v0.1/v0.2).

## Rendering

- `src/utils/storylineMarked.ts` — an isolated `Marked` instance with a
  custom inline `mark` extension (`==text==` → `<mark>text</mark>`).
- `StoryProse.svelte` (new, replaces `MarkdownText` for storyline prose —
  imports `MarkdownText.css` directly for identical paragraph styling, adds
  one rule for `mark`).
- `StoryHook.svelte` — now renders `storylineMarked.parseInline(block.markdown)`
  (inline parse, no wrapping `<p>`, avoiding a `<p>` nested in the
  component's own `<div class="story-hook">`) instead of the old manual
  accent-substring splitting. Simpler: the `<mark>` tag does the visual
  separation marked already computed, instead of hand-rolled string slicing.
- `StoryStats.svelte` — reworked prop (`block.doc`, `block.ref`), `visible`/
  `click_to_reveal` per item (was `hidden`), `footnote` (was `caption`), no
  `cover` skin choice (redaction/blur/card go away — one fixed dark-chip
  treatment, matching what pass 2 already settled on visually). Locale
  formatting for numeric values via `.toLocaleString("en-US")`.
- `StoryFold.svelte` — same toggle mechanics as before; iterates
  `FoldBlock[]` (prose | stats only).
- `StoryBlockRenderer.svelte` — four-way dispatch (prose/hook/stats/fold),
  down from six.
- Deleted: `StoryCallout.svelte`/`.css`/test, `StoryReveal.svelte`/`.css`/test.

## Data loading

`loadLocations.ts` gains a stats-transclusion resolution step, structurally
identical to the existing form-resolution block:

```ts
if (rawLocation.storyline) {
  const refs = findStatsRefs(rawLocation.storyline);
  const dir = path.substring(0, path.lastIndexOf("/") + 1);
  const entries = await Promise.all(
    refs.map(async (ref) => {
      const doc = await loadText<StatsDoc>(lang, dir + ref.replace(/\.yaml$/, ""));
      return [ref, doc] as const;
    }),
  );
  storylineElements = Object.fromEntries(
    entries.filter((entry): entry is [string, StatsDoc] => entry[1] !== null),
  );
}
```

`findStatsRefs(text: string): string[]` is exported from
`storylineBlocks.ts` and shared by both `loadLocations.ts` (browser,
resolves via `loadText`) and `scripts/validate-yaml.ts` (Node, resolves via
`readFileSync`), so the extraction regex lives in exactly one place.

`Location`/`LocationEntry` (`types/data.ts`) gain
`storylineElements?: Record<string, StatsDoc>`. `Storyline.svelte` gains an
`elements` prop, passed through from `ChallengeCard.svelte`.

## CI

`scripts/validate-yaml.ts`:
- New `STATS_PATTERN = /^\d+_stats_.*\.yaml$/`, validated against
  `stats.schema.json` (ajv) plus the hand-written cross-field checks,
  independent of whether any storyline currently references the file —
  catches orphaned/malformed stats docs too.
- `checkStoryline` resolves `{{stats: ...}}` refs the same way
  `loadLocations.ts` does, then runs `parseStoryline` + `validateStoryline`
  against the resolved map.
- New check: a literal `:::` anywhere in a `storyline` field is now itself
  a CI error — guards against the retired v0.1/v0.2 syntax creeping back in
  (there is no fallback parser for it anymore).

## Content migration

`012_loc_right_to_read_blocks.yaml`'s `storyline` field is rewritten in the
new syntax (the proposal's own §8 worked example already matches this
location's real content almost verbatim). A new
`013_stats_right_to_read.yaml` (numbering just avoids collision with the
existing `001_form_abc.yaml`; file-prefix numbers are cosmetic, confirmed in
the previous pass) holds the extracted stats document.
