# Storyline Syntax v0.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `:::name{attr}` fence syntax with markdown-native
constructs (`##`/`==mark==`/`[+]`/`{{stats: file.yaml}}`), per
`doc/superpowers/specs/2026-07-28-storyline-syntax-v0.3-design.md`.

**Architecture:** `storylineBlocks.ts` is fully rewritten around a
line-based pipeline (mask code fences → extract hook → split fold → dedent
→ extract transclusions → build blocks), staying synchronous. Stats data
moves to its own YAML file kind (`*_stats_*.yaml`), resolved at load time in
`loadLocations.ts` — mirroring the existing `challenge.form` resolution —
into a `Record<string, StatsDoc>` handed to the parser as a plain argument.
`==highlight==` renders through a new, storyline-scoped `Marked` instance;
`MarkdownText.svelte` (used elsewhere) is untouched. `StoryCallout` and
`StoryReveal` are deleted (no v0.3 authoring path reaches them).

**Tech Stack:** Svelte 5 (runes), TypeScript, `marked@18` (isolated
`Marked` instance for storyline prose), `ajv`, Vitest + `@testing-library/svelte/svelte5`.

## Global Constraints

- TypeScript only in `src/`. Co-located `.css` per component, `var(--color-*)`/
  `var(--font-size-*)` tokens, full BEM (`component-name__element--modifier`).
- Svelte 5 runes only.
- ESLint: `complexity` max 10/function, `max-len` 100 (`.svelte` ignores
  lines starting with `<`), `curly: all`, `id-length` min 3, `no-restricted-syntax`
  bans naked `return;`, `unused-imports/no-unused-imports` error.
- Tests: Vitest globals (`test`/`expect` need no import), files at
  `src/test/<Name>.test.ts`. Svelte tests via `@testing-library/svelte/svelte5`.
- No new dependency: `marked@18` already exports a `Marked` class for
  isolated instances (verified working in this session).
- `location.schema.json`'s `storyline` field is unchanged (`{ "type": "string" }`).

---

### Task 1: Types — `storyline.ts` rewrite + `Location.storylineElements`

**Files:**
- Modify: `src/types/storyline.ts` (full replacement)
- Modify: `src/types/data.ts` (add `storylineElements` to `Location`)

**Interfaces:**
- Produces: `StatVisibility`, `StatItem`, `StatsDoc`, `StoryBlock`, `FoldBlock` (`src/types/storyline.ts`)
- Produces: `Location.storylineElements?: Record<string, StatsDoc>` (`src/types/data.ts`)

- [ ] **Step 1: Replace `src/types/storyline.ts`**

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
// whole-document concept, not a per-region one).
export type FoldBlock = Extract<StoryBlock, { type: "prose" } | { type: "stats" }>;
```

- [ ] **Step 2: Add `storylineElements` to `Location` in `src/types/data.ts`**

Add the import and field:

```ts
import type { StatsDoc } from "./storyline";
```

In the `Location` interface, add after `storyline: string;`:

```ts
  storylineElements?: Record<string, StatsDoc>;
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: errors in every file still referencing the old `Cover`/`CalloutTone`/
`LeafBlock`/callout/reveal shapes — this is expected at this point in the
plan; each error's file is fixed in a later task. Confirm the errors are
**only** in the files this plan touches later (`storylineBlocks.ts`,
`Story*.svelte`, their tests) — if `tsc` reports an error anywhere else,
stop and investigate before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/types/storyline.ts src/types/data.ts
git commit -m "feat: replace storyline block types for v0.3 syntax"
```

---

### Task 2: Storyline-scoped Marked instance (`==highlight==`)

**Files:**
- Create: `src/utils/storylineMarked.ts`
- Test: `src/test/storylineMarked.test.ts`

**Interfaces:**
- Produces: `storylineMarked: Marked` (an instance, not a class) — `.parse(text): string`,
  `.parseInline(text): string`.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the failing test**

Create `src/test/storylineMarked.test.ts`:

```ts
import { storylineMarked } from "../utils/storylineMarked";

test("wraps a ==marked== span in a <mark> tag", () => {
  const html = storylineMarked.parseInline("Book bans are not ==just about books==.");
  expect(html).toContain("<mark>just about books</mark>");
});

test("leaves an unclosed == as literal text", () => {
  const html = storylineMarked.parseInline("Half open == here");
  expect(html).toContain("==");
  expect(html).not.toContain("<mark>");
});

test("still supports ordinary bold and italic", () => {
  const html = storylineMarked.parseInline("**bold** and *italic*");
  expect(html).toContain("<strong>bold</strong>");
  expect(html).toContain("<em>italic</em>");
});

test("parse() renders block-level markdown normally, including headings", () => {
  const html = storylineMarked.parse("Intro.\n\n## A heading\n\nMore text.");
  expect(html).toContain("<h2>A heading</h2>");
  expect(html).toContain("<p>Intro.</p>");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/storylineMarked.test.ts`
Expected: FAIL — cannot find `../utils/storylineMarked`.

- [ ] **Step 3: Write `src/utils/storylineMarked.ts`**

```ts
import { Marked } from "marked";

interface MarkToken {
  type: "mark";
  raw: string;
  text: string;
}

export const storylineMarked = new Marked();

storylineMarked.use({
  extensions: [
    {
      name: "mark",
      level: "inline",
      start(src: string): number | undefined {
        const index = src.indexOf("==");
        return index >= 0 ? index : undefined;
      },
      tokenizer(src: string): MarkToken | undefined {
        const match = /^==([^=]+)==/.exec(src);
        if (!match) {
          return undefined;
        }
        return { type: "mark", raw: match[0], text: match[1] };
      },
      renderer(token): string {
        const markToken = token as MarkToken;
        return `<mark>${markToken.text}</mark>`;
      },
    },
  ],
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/storylineMarked.test.ts`
Expected: PASS, all four tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/storylineMarked.ts src/test/storylineMarked.test.ts
git commit -m "feat: add storyline-scoped Marked instance with ==highlight== support"
```

---

### Task 3: Parser + validator rewrite — `storylineBlocks.ts`

The highest-risk task, same role Task 1 played in the v0.1 plan. Full
replacement of `src/utils/storylineBlocks.ts` and `src/test/storylineBlocks.test.ts`.

**Files:**
- Modify: `src/utils/storylineBlocks.ts` (full replacement)
- Modify: `src/test/storylineBlocks.test.ts` (full replacement)

**Interfaces:**
- Consumes: `StoryBlock`, `FoldBlock`, `StatsDoc` (Task 1).
- Produces:
  `parseStoryline(text: string, elements: Record<string, StatsDoc>): { blocks: StoryBlock[]; warnings: string[] }`,
  `validateStoryline(blocks: StoryBlock[]): string[]`,
  `validateStatsDoc(doc: StatsDoc): string[]`,
  `findStatsRefs(text: string): string[]`.
  All four are consumed by Task 4 (`loadLocations.ts`), Task 5
  (`scripts/validate-yaml.ts`), and Task 11 (`Storyline.svelte`).

- [ ] **Step 1: Write the failing tests**

Replace `src/test/storylineBlocks.test.ts`:

```ts
import { parseStoryline, validateStoryline, validateStatsDoc, findStatsRefs } from "../utils/storylineBlocks";
import type { StoryBlock, StatsDoc } from "../types/storyline";

function blocksOf(text: string, elements: Record<string, StatsDoc> = {}): StoryBlock[] {
  return parseStoryline(text, elements).blocks;
}

const SAMPLE_STATS: StatsDoc = {
  footnote: "Recorded by PEN America.",
  items: [
    { value: 6870, label: "school book bans", visibility: "click_to_reveal" },
    { value: 23, label: "states" },
  ],
};

test("returns a single prose block for text with no constructs", () => {
  expect(blocksOf("Just a paragraph.")).toEqual([{ type: "prose", markdown: "Just a paragraph." }]);
});

test("extracts the first ## line anywhere as the hook", () => {
  const blocks = blocksOf("Intro line.\n\n## Book bans are not ==just about books==.\n\nMore text.");
  expect(blocks).toEqual([
    { type: "prose", markdown: "Intro line." },
    { type: "hook", markdown: "Book bans are not ==just about books==." },
    { type: "prose", markdown: "More text." },
  ]);
});

test("treats a second ## as an ordinary heading, not another hook", () => {
  const blocks = blocksOf("## First hook\n\nBody with a ## second heading inline in prose.");
  expect(blocks).toEqual([
    { type: "hook", markdown: "First hook" },
    { type: "prose", markdown: "Body with a ## second heading inline in prose." },
  ]);
});

test("does not treat a ## inside a fenced code block as a hook", () => {
  const blocks = blocksOf("```\n## not a hook\n```\n\n## Real hook");
  expect(blocks).toEqual([
    { type: "hook", markdown: "Real hook" },
    { type: "prose", markdown: "```\n## not a hook\n```" },
  ]);
});

test("splits above/below the [+] fold marker, defaulting the label", () => {
  const blocks = blocksOf("Above.\n\n[+]\n\nBelow.");
  expect(blocks).toEqual([
    { type: "prose", markdown: "Above." },
    { type: "fold", label: "Read the full story", blocks: [{ type: "prose", markdown: "Below." }] },
  ]);
});

test("uses a custom fold label when given", () => {
  const blocks = blocksOf("[+] See more\n\nBelow.");
  expect(blocks).toEqual([
    { type: "fold", label: "See more", blocks: [{ type: "prose", markdown: "Below." }] },
  ]);
});

test("dedents the fold region regardless of indentation depth", () => {
  const twoSpace = blocksOf("[+]\n\n  Line one.\n  Line two.");
  const fourSpace = blocksOf("[+]\n\n    Line one.\n    Line two.");
  const none = blocksOf("[+]\n\nLine one.\nLine two.");
  const expected = [
    { type: "fold", label: "Read the full story", blocks: [{ type: "prose", markdown: "Line one.\nLine two." }] },
  ];
  expect(twoSpace).toEqual(expected);
  expect(fourSpace).toEqual(expected);
  expect(none).toEqual(expected);
});

test("resolves a {{stats: ref}} transclusion against the elements map", () => {
  const blocks = blocksOf("Intro.\n\n{{stats: 013_stats_right_to_read.yaml}}\n\nOutro.", {
    "013_stats_right_to_read.yaml": SAMPLE_STATS,
  });
  expect(blocks).toEqual([
    { type: "prose", markdown: "Intro." },
    { type: "stats", doc: SAMPLE_STATS, ref: "013_stats_right_to_read.yaml" },
    { type: "prose", markdown: "Outro." },
  ]);
});

test("resolves a transclusion inside the fold", () => {
  const blocks = blocksOf("[+]\n\n{{stats: 013_stats_right_to_read.yaml}}", {
    "013_stats_right_to_read.yaml": SAMPLE_STATS,
  });
  expect(blocks).toEqual([
    {
      type: "fold",
      label: "Read the full story",
      blocks: [{ type: "stats", doc: SAMPLE_STATS, ref: "013_stats_right_to_read.yaml" }],
    },
  ]);
});

test("drops an unresolved transclusion and warns", () => {
  const result = parseStoryline("{{stats: missing.yaml}}", {});
  expect(result.blocks).toEqual([]);
  expect(result.warnings).toEqual(['could not resolve "{{stats: missing.yaml}}" — dropped']);
});

test("drops an unregistered transclusion type and warns", () => {
  const result = parseStoryline("{{banner: whatever.yaml}}", {});
  expect(result.blocks).toEqual([]);
  expect(result.warnings).toEqual(['unknown transclusion type "banner" for "whatever.yaml" — dropped']);
});

test("warns on a second [+] marker but keeps it as literal text", () => {
  const result = parseStoryline("[+]\n\nFirst.\n\n[+] Ignored\n\nMore text.", {});
  expect(result.blocks).toEqual([
    {
      type: "fold",
      label: "Read the full story",
      blocks: [{ type: "prose", markdown: "First.\n\n[+] Ignored\n\nMore text." }],
    },
  ]);
  expect(result.warnings).toEqual([
    'a second "[+]" marker was found inside the fold — only the first is treated as the boundary',
  ]);
});

test("findStatsRefs finds every stats reference outside code fences", () => {
  const refs = findStatsRefs(
    "{{stats: a.yaml}}\n\n```\n{{stats: fake.yaml}}\n```\n\n[+]\n\n{{stats: b.yaml}}",
  );
  expect(refs).toEqual(["a.yaml", "b.yaml"]);
});

test("validateStatsDoc flags more than one click_to_reveal item", () => {
  const doc: StatsDoc = {
    items: [
      { value: 1, label: "a", visibility: "click_to_reveal" },
      { value: 2, label: "b", visibility: "click_to_reveal" },
    ],
  };
  expect(validateStatsDoc(doc)).toEqual([
    'stats doc has 2 "click_to_reveal" items, at most one is allowed',
  ]);
});

test("validateStatsDoc flags a prompt with no click_to_reveal item", () => {
  const doc: StatsDoc = { prompt: "Guess it", items: [{ value: 1, label: "a" }] };
  expect(validateStatsDoc(doc)).toEqual([
    'stats doc has a "prompt" but no "click_to_reveal" item — the prompt has nothing to guess and will not render',
  ]);
});

test("validateStatsDoc is clean for a well-formed doc", () => {
  expect(validateStatsDoc(SAMPLE_STATS)).toEqual([]);
});

test("validateStoryline surfaces stats doc warnings, tagged with the ref, including inside a fold", () => {
  const badDoc: StatsDoc = { prompt: "Guess it", items: [{ value: 1, label: "a" }] };
  const blocks: StoryBlock[] = [
    { type: "stats", doc: badDoc, ref: "bad.yaml" },
    { type: "fold", label: "More", blocks: [{ type: "stats", doc: badDoc, ref: "bad2.yaml" }] },
  ];
  expect(validateStoryline(blocks)).toEqual([
    '"bad.yaml": stats doc has a "prompt" but no "click_to_reveal" item — the prompt has nothing to guess and will not render',
    '"bad2.yaml": stats doc has a "prompt" but no "click_to_reveal" item — the prompt has nothing to guess and will not render',
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/storylineBlocks.test.ts`
Expected: FAIL — old exports don't match this shape.

- [ ] **Step 3: Replace `src/utils/storylineBlocks.ts`**

```ts
import type { StoryBlock, FoldBlock, StatsDoc } from "../types/storyline";

const HOOK_LINE = /^##\s+(.*)$/;
const FOLD_LINE = /^\s*\[\+\]\s*(.*)$/;
const CODE_FENCE_LINE = /^(```|~~~)/;
const TRANSCLUSION_LINE = /^\s*\{\{\s*([a-z_]+)\s*:\s*([^}]+?)\s*\}\}\s*$/;

function maskCodeFences(lines: string[]): boolean[] {
  const masked: boolean[] = [];
  let inFence = false;
  for (const line of lines) {
    if (CODE_FENCE_LINE.test(line)) {
      masked.push(true);
      inFence = !inFence;
    } else {
      masked.push(inFence);
    }
  }
  return masked;
}

function extractHook(lines: string[]): { hook?: string; rest: string[] } {
  const masked = maskCodeFences(lines);
  const index = lines.findIndex((line, lineIndex) => !masked[lineIndex] && HOOK_LINE.test(line));
  if (index < 0) {
    return { rest: lines };
  }
  const match = HOOK_LINE.exec(lines[index]) as RegExpExecArray;
  return {
    hook: match[1].trim(),
    rest: [...lines.slice(0, index), ...lines.slice(index + 1)],
  };
}

function splitFold(lines: string[]): { above: string[]; foldLabel?: string; below: string[] } {
  const masked = maskCodeFences(lines);
  const index = lines.findIndex((line, lineIndex) => !masked[lineIndex] && FOLD_LINE.test(line));
  if (index < 0) {
    return { above: lines, below: [] };
  }
  const match = FOLD_LINE.exec(lines[index]) as RegExpExecArray;
  return {
    above: lines.slice(0, index),
    foldLabel: match[1].trim() || "Read the full story",
    below: lines.slice(index + 1),
  };
}

function dedent(lines: string[]): string[] {
  const nonBlank = lines.filter((line) => line.trim().length > 0);
  const minIndent =
    nonBlank.length > 0
      ? Math.min(...nonBlank.map((line) => line.length - line.trimStart().length))
      : 0;
  return lines.map((line) => line.slice(Math.min(minIndent, line.length)));
}

type RegionSegment = { prose: string } | { transclusionType: string; ref: string };

function extractTransclusions(lines: string[]): RegionSegment[] {
  const masked = maskCodeFences(lines);
  const segments: RegionSegment[] = [];
  let proseLines: string[] = [];

  const flushProse = (): void => {
    const prose = proseLines.join("\n").trim();
    if (prose.length > 0) {
      segments.push({ prose });
    }
    proseLines = [];
  };

  lines.forEach((line, index) => {
    const match = masked[index] ? null : TRANSCLUSION_LINE.exec(line);
    if (match) {
      flushProse();
      segments.push({ transclusionType: match[1], ref: match[2] });
    } else {
      proseLines.push(line);
    }
  });
  flushProse();
  return segments;
}

function toFoldBlocks(
  segments: RegionSegment[],
  elements: Record<string, StatsDoc>,
  warnings: string[],
): FoldBlock[] {
  return segments.flatMap((segment): FoldBlock[] => {
    if ("prose" in segment) {
      return [{ type: "prose", markdown: segment.prose }];
    }
    if (segment.transclusionType !== "stats") {
      warnings.push(
        `unknown transclusion type "${segment.transclusionType}" for "${segment.ref}" — dropped`,
      );
      return [];
    }
    const doc = elements[segment.ref];
    if (!doc) {
      warnings.push(`could not resolve "{{stats: ${segment.ref}}}" — dropped`);
      return [];
    }
    return [{ type: "stats", doc, ref: segment.ref }];
  });
}

export function parseStoryline(
  text: string,
  elements: Record<string, StatsDoc>,
): { blocks: StoryBlock[]; warnings: string[] } {
  const warnings: string[] = [];
  const { hook, rest } = extractHook(text.split("\n"));
  const { above, foldLabel, below } = splitFold(rest);

  const blocks: StoryBlock[] = [];
  if (hook !== undefined) {
    blocks.push({ type: "hook", markdown: hook });
  }
  blocks.push(...toFoldBlocks(extractTransclusions(above), elements, warnings));

  if (foldLabel !== undefined) {
    const dedented = dedent(below);
    const dedentedMasked = maskCodeFences(dedented);
    const hasSecondMarker = dedented.some(
      (line, index) => !dedentedMasked[index] && FOLD_LINE.test(line),
    );
    if (hasSecondMarker) {
      warnings.push(
        'a second "[+]" marker was found inside the fold — only the first is treated as the boundary',
      );
    }
    blocks.push({
      type: "fold",
      label: foldLabel,
      blocks: toFoldBlocks(extractTransclusions(dedented), elements, warnings),
    });
  }

  return { blocks, warnings };
}

export function findStatsRefs(text: string): string[] {
  const lines = text.split("\n");
  const masked = maskCodeFences(lines);
  return lines
    .map((line, index) => (masked[index] ? null : TRANSCLUSION_LINE.exec(line)))
    .filter((match): match is RegExpExecArray => match !== null && match[1] === "stats")
    .map((match) => match[2]);
}

export function validateStatsDoc(doc: StatsDoc): string[] {
  const warnings: string[] = [];
  const hiddenCount = doc.items.filter((item) => item.visibility === "click_to_reveal").length;
  if (hiddenCount > 1) {
    warnings.push(`stats doc has ${hiddenCount} "click_to_reveal" items, at most one is allowed`);
  }
  if (doc.prompt && hiddenCount === 0) {
    warnings.push(
      'stats doc has a "prompt" but no "click_to_reveal" item — the prompt has nothing ' +
        "to guess and will not render",
    );
  }
  return warnings;
}

function flatten(blocks: StoryBlock[]): StoryBlock[] {
  return blocks.flatMap((block) => (block.type === "fold" ? block.blocks : [block]));
}

export function validateStoryline(blocks: StoryBlock[]): string[] {
  return flatten(blocks)
    .filter((block): block is Extract<StoryBlock, { type: "stats" }> => block.type === "stats")
    .flatMap((block) => validateStatsDoc(block.doc).map((msg) => `"${block.ref}": ${msg}`));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/storylineBlocks.test.ts`
Expected: PASS, all 19 tests.

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors from `storylineBlocks.ts`/`storylineBlocks.test.ts`
specifically (other files still mid-migration will still error — confirm
the error set shrank and no *new* file outside this plan's scope appears).

- [ ] **Step 6: Commit**

```bash
git add src/utils/storylineBlocks.ts src/test/storylineBlocks.test.ts
git commit -m "feat: rewrite storyline parser for v0.3 markdown-native syntax"
```

---

### Task 4: Stats schema + `loadLocations.ts` resolution

**Files:**
- Create: `src/data/schemas/stats.schema.json`
- Modify: `src/utils/loadLocations.ts`
- Test: `src/test/loadLocations.test.ts` (extend existing)

**Interfaces:**
- Consumes: `findStatsRefs` (Task 3), `loadText` (existing,
  `src/utils/loadText.ts`), `StatsDoc` (Task 1).
- Produces: `loadAndResolveLocation` now also populates `storylineElements`
  on the returned `RouteEntry` when it's a location with `{{stats: ...}}`
  references.

- [ ] **Step 1: Write `src/data/schemas/stats.schema.json`**

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

- [ ] **Step 2: Add the failing test cases**

`src/test/loadLocations.test.ts` already defines a shared `rawLocation`
fixture (`challenge.form: []`, an inline array — takes the sentinel path
with **no** extra `loadText` call) and mocks `loadText` via sequential
`mockLoadText.mockResolvedValueOnce(...)` calls, in the exact order
`loadAndResolveLocation` calls `loadText` (verified by reading the file:
1st call loads the raw location; a 2nd call only happens for a
string-filename `challenge.form`, which `rawLocation` doesn't have).
Append, reusing that fixture and that ordering convention:

```ts
test("resolves {{stats: ...}} references in the storyline into storylineElements", async () => {
  mockLoadText
    .mockResolvedValueOnce({ ...rawLocation, storyline: "{{stats: 002_stats_example.yaml}}" })
    .mockResolvedValueOnce({ items: [{ value: 1, label: "one" }] });
  const [entry] = await loadLocations("en", ["projects/x/y/001_loc_example"]);
  expect((entry as unknown as LocationEntry).storylineElements).toEqual({
    "002_stats_example.yaml": { items: [{ value: 1, label: "one" }] },
  });
});

test("omits storylineElements when the storyline has no transclusions", async () => {
  mockLoadText.mockResolvedValueOnce(rawLocation);
  const [entry] = await loadLocations("en", ["projects/x/y/001_loc_example"]);
  expect((entry as unknown as LocationEntry).storylineElements).toBeUndefined();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/test/loadLocations.test.ts`
Expected: FAIL — `storylineElements` is never set yet, and the first new
test's second `mockResolvedValueOnce` is never consumed (no stats
resolution call happens yet either).

- [ ] **Step 4: Update `src/utils/loadLocations.ts`**

Add the import:

```ts
import { findStatsRefs } from "./storylineBlocks";
import type { StatsDoc } from "../types/storyline";
```

The function's current tail (everything from `if (resolvedForm !== undefined) {`
to the closing `}` of `loadAndResolveLocation`) is:

```ts
  if (resolvedForm !== undefined) {
    return {
      ...rawLocation,
      challenge: { ...rawLocation.challenge, form: resolvedForm },
    } as RouteEntry;
  }

  return rawLocation as RouteEntry;
}
```

Replace that entire tail (both `return` statements and everything between
them) with:

```ts
  let storylineElements: Record<string, StatsDoc> | undefined;
  if (rawLocation.storyline) {
    const refs = findStatsRefs(rawLocation.storyline);
    if (refs.length > 0) {
      const dir = path.substring(0, path.lastIndexOf("/") + 1);
      const entries = await Promise.all(
        refs.map(async (ref) => {
          const doc = await loadText<StatsDoc>(lang, dir + ref.replace(/\.yaml$/, ""));
          return [ref, doc] as const;
        }),
      );
      const resolved = Object.fromEntries(
        entries.filter((entry): entry is [string, StatsDoc] => entry[1] !== null),
      );
      if (Object.keys(resolved).length > 0) {
        storylineElements = resolved;
      }
    }
  }

  const withResolvedForm =
    resolvedForm !== undefined
      ? { ...rawLocation, challenge: { ...rawLocation.challenge, form: resolvedForm } }
      : rawLocation;

  return (
    storylineElements !== undefined
      ? { ...withResolvedForm, storylineElements }
      : withResolvedForm
  ) as RouteEntry;
}
```

This computes `storylineElements` unconditionally (independent of whether
a form was also resolved — the old code's early `return` inside the
`resolvedForm` branch is exactly why the tail has to be replaced as one
piece rather than edited in place), then produces a single final object
combining whichever of `resolvedForm`/`storylineElements` are actually set.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/test/loadLocations.test.ts`
Expected: PASS, including the two new cases and all pre-existing ones.

- [ ] **Step 6: Lint and typecheck**

Run: `npm run lint && npm run typecheck`

- [ ] **Step 7: Commit**

```bash
git add src/data/schemas/stats.schema.json src/utils/loadLocations.ts src/test/loadLocations.test.ts
git commit -m "feat: resolve {{stats: ...}} transclusions at location-load time"
```

---

### Task 5: CI — `scripts/validate-yaml.ts` updates

**Files:**
- Modify: `scripts/validate-yaml.ts`

**Interfaces:**
- Consumes: `findStatsRefs`, `parseStoryline`, `validateStoryline`,
  `validateStatsDoc` (Task 3); `stats.schema.json` (Task 4).

- [ ] **Step 1: Add the stats schema, pattern, and file-level check**

Add near the other `validate*` compiles:

```ts
const validateStats = ajv.compile(loadSchema("stats.schema.json"));
```

Add near the other patterns:

```ts
const STATS_PATTERN = /^\d+_stats_.*\.yaml$/;
```

Add a new check function alongside `checkStoryline`:

```ts
function checkStatsFile(filePath: string): string[] {
  const structural = checkFile(filePath, validateStats);
  if (structural.length > 0) {
    return structural;
  }
  const content = readFileSync(filePath, "utf8");
  const doc = loadYaml(content) as StatsDoc;
  return validateStatsDoc(doc);
}
```

(`StatsDoc` import is added in Step 4 below, alongside the other import changes.)

- [ ] **Step 2: Update `checkStoryline` to resolve transclusions and reject `:::`**

Replace the existing `checkStoryline` function. Note `dirname(filePath)`,
not string-splitting on `"/"` — `filePath` here comes from `findFiles()`
(built via Node's `join()`), which produces OS-native separators
(backslashes on Windows, where this repo runs). `loadLocations.ts`'s
equivalent `path.lastIndexOf("/")` is safe only because it operates on
Vite glob-import keys, which are always POSIX-style regardless of OS —
a different kind of "path" string than this one:

```ts
function checkStoryline(filePath: string): string[] {
  const content = readFileSync(filePath, "utf8");
  const data = loadYaml(content) as { storyline?: string };
  if (!data.storyline) {
    return [];
  }
  if (data.storyline.includes(":::")) {
    return ['found ":::" — the v0.1/v0.2 fence syntax has been retired, use v0.3 markdown-native syntax'];
  }
  const refs = findStatsRefs(data.storyline);
  const dir = dirname(filePath);
  const elements = Object.fromEntries(
    refs.flatMap((ref) => {
      try {
        const refContent = readFileSync(join(dir, ref), "utf8");
        return [[ref, loadYaml(refContent)]] as const;
      } catch {
        return [];
      }
    }),
  );
  const { blocks, warnings } = parseStoryline(data.storyline, elements);
  return [...warnings, ...validateStoryline(blocks)];
}
```

Add `dirname` to the existing `import { join } from "node:path";` line,
making it `import { join, dirname } from "node:path";`.

- [ ] **Step 3: Wire the new pattern into the `violations` array**

Add alongside the other `findFiles(...).flatMap(...)` entries:

```ts
  ...findFiles(DATA_DIR, STATS_PATTERN).flatMap((filePath) =>
    checkStatsFile(filePath).map((msg) => ({ filePath, msg })),
  ),
```

- [ ] **Step 4: Update the import lines**

Change `import { join } from "node:path";` to:

```ts
import { join, dirname } from "node:path";
```

Add two new imports (alongside the existing `Ajv`/`js-yaml` imports):

```ts
import { parseStoryline, validateStoryline, validateStatsDoc, findStatsRefs } from "../src/utils/storylineBlocks";
import type { StatsDoc } from "../src/types/storyline";
```

- [ ] **Step 5: Run against real content**

Run: `npm run validate:yaml`
Expected: **fails** at this point — `012_loc_right_to_read_blocks.yaml`
still contains the old `:::` syntax, and the new `:::` rejection check
will (correctly) flag it. This is expected; Task 11 rewrites that file.
Confirm the *only* violation reported is the `:::` one for that file —
no unrelated errors.

- [ ] **Step 6: Lint**

Run: `npm run lint`

- [ ] **Step 7: Commit**

```bash
git add scripts/validate-yaml.ts
git commit -m "feat: validate stats docs and reject retired ::: syntax in CI"
```

---

### Task 6: `StoryProse` component (replaces `MarkdownText` for storyline prose)

**Files:**
- Create: `src/components/StoryProse.svelte`
- Create: `src/components/StoryProse.css`
- Test: `src/test/StoryProse.test.ts`

**Interfaces:**
- Consumes: `storylineMarked` (Task 2).
- Produces: `StoryProse.svelte` — prop `{ markdown: string }`. Consumed by
  `StoryBlockRenderer` (Task 9) for `prose` blocks.

- [ ] **Step 1: Write the failing test**

Create `src/test/StoryProse.test.ts`:

```ts
import { render, screen } from "@testing-library/svelte/svelte5";
import StoryProse from "../components/StoryProse.svelte";

test("renders markdown prose", () => {
  render(StoryProse, { props: { markdown: "Hello **world**." } });
  expect(screen.getByText("world")).toBeInTheDocument();
});

test("renders a ==highlight== as a <mark>", () => {
  render(StoryProse, { props: { markdown: "A ==highlighted== phrase." } });
  expect(document.querySelector("mark")).toHaveTextContent("highlighted");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/StoryProse.test.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Write `src/components/StoryProse.svelte`**

```svelte
<script lang="ts">
  import "./MarkdownText.css";
  import "./StoryProse.css";
  import { storylineMarked } from "../utils/storylineMarked";
  /* eslint-disable svelte/no-at-html-tags */

  let { markdown }: { markdown: string } = $props();
</script>

<div class="markdown-text">
  {@html storylineMarked.parse(markdown)}
</div>
```

- [ ] **Step 4: Write `src/components/StoryProse.css`**

```css
.markdown-text mark {
  background: var(--color-accent);
  color: var(--color-background);
  padding: 0 2px;
  border-radius: 2px;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/test/StoryProse.test.ts`
Expected: PASS, both tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/StoryProse.svelte src/components/StoryProse.css src/test/StoryProse.test.ts
git commit -m "feat: add StoryProse, a storyline-scoped markdown renderer"
```

---

### Task 7: `StoryHook` rewrite

**Files:**
- Modify: `src/components/StoryHook.svelte`
- Modify: `src/components/StoryHook.css`
- Modify: `src/test/StoryHook.test.ts`

**Interfaces:**
- Consumes: `storylineMarked` (Task 2), `StoryBlock` (Task 1).
- Produces: `StoryHook.svelte` — prop `{ block: Extract<StoryBlock, { type: "hook" }> }`
  (shape unchanged; only `block.markdown` replaces the old `block.text`/`block.accent`).

- [ ] **Step 1: Replace `src/test/StoryHook.test.ts`**

```ts
import { render } from "@testing-library/svelte/svelte5";
import StoryHook from "../components/StoryHook.svelte";
import type { StoryBlock } from "../types/storyline";

test("renders plain markdown with no mark when there is no ==highlight==", () => {
  const block: Extract<StoryBlock, { type: "hook" }> = { type: "hook", markdown: "Plain hook line." };
  render(StoryHook, { props: { block } });
  expect(document.querySelector(".story-hook")).toHaveTextContent("Plain hook line.");
  expect(document.querySelector("mark")).not.toBeInTheDocument();
});

test("wraps a ==highlight== in <mark>", () => {
  const block: Extract<StoryBlock, { type: "hook" }> = {
    type: "hook",
    markdown: "Book bans are not ==just about books==.",
  };
  render(StoryHook, { props: { block } });
  expect(document.querySelector(".story-hook mark")).toHaveTextContent("just about books");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/StoryHook.test.ts`
Expected: FAIL — old component reads `block.text`/`block.accent`, not `block.markdown`.

- [ ] **Step 3: Replace `src/components/StoryHook.svelte`**

```svelte
<script lang="ts">
  import "./StoryHook.css";
  import { storylineMarked } from "../utils/storylineMarked";
  import type { StoryBlock } from "../types/storyline";
  /* eslint-disable svelte/no-at-html-tags */

  let { block }: { block: Extract<StoryBlock, { type: "hook" }> } = $props();
</script>

<div class="story-hook">
  {@html storylineMarked.parseInline(block.markdown)}
</div>
```

- [ ] **Step 4: Replace `src/components/StoryHook.css`**

```css
.story-hook {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  line-height: 1.25;
  color: var(--color-text);
  margin: 0;
}

.story-hook mark {
  background: none;
  color: var(--color-accent);
  padding: 0;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/test/StoryHook.test.ts`
Expected: PASS, both tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/StoryHook.svelte src/components/StoryHook.css src/test/StoryHook.test.ts
git commit -m "feat: render StoryHook via storyline-scoped markdown, drop manual accent splitting"
```

---

### Task 8: `StoryStats` rewrite

**Files:**
- Modify: `src/components/StoryStats.svelte`
- Modify: `src/components/StoryStats.css`
- Modify: `src/test/StoryStats.test.ts`

**Interfaces:**
- Consumes: `StoryBlock` (Task 1) — prop `{ block: Extract<StoryBlock, { type: "stats" }> }`,
  reading `block.doc: StatsDoc`.

- [ ] **Step 1: Replace `src/test/StoryStats.test.ts`**

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import StoryStats from "../components/StoryStats.svelte";
import type { StoryBlock } from "../types/storyline";

function statsBlock(doc: Extract<StoryBlock, { type: "stats" }>["doc"]): Extract<StoryBlock, { type: "stats" }> {
  return { type: "stats", doc, ref: "test.yaml" };
}

test("renders each value/label pair, formatting numeric values with locale grouping", () => {
  const block = statsBlock({
    items: [
      { value: 6870, label: "school book bans" },
      { value: "1 in 4", label: "as a string" },
    ],
  });
  render(StoryStats, { props: { block } });
  expect(screen.getByText("6,870")).toBeInTheDocument();
  expect(screen.getByText("school book bans")).toBeInTheDocument();
  expect(screen.getByText("1 in 4")).toBeInTheDocument();
});

test("renders the footnote only when present", () => {
  const block = statsBlock({ items: [{ value: 1, label: "a" }], footnote: "Recorded by PEN America." });
  render(StoryStats, { props: { block } });
  expect(screen.getByText("Recorded by PEN America.")).toBeInTheDocument();
});

test("omits the footnote element when absent", () => {
  const block = statsBlock({ items: [{ value: 1, label: "a" }] });
  render(StoryStats, { props: { block } });
  expect(document.querySelector(".story-stats__footnote")).not.toBeInTheDocument();
});

test("hides a click_to_reveal item's value behind a tap-to-reveal cover", () => {
  const block = statsBlock({
    items: [
      { value: 6870, label: "bans", visibility: "click_to_reveal" },
      { value: 23, label: "states" },
    ],
  });
  render(StoryStats, { props: { block } });
  expect(screen.queryByText("6,870")).not.toBeInTheDocument();
  expect(screen.getByText("23")).toBeInTheDocument();
  expect(screen.getByTestId("story-stats-cover-0")).toBeInTheDocument();
});

test("reveals the hidden value on click and drops the cover", async () => {
  const block = statsBlock({ items: [{ value: 6870, label: "bans", visibility: "click_to_reveal" }] });
  render(StoryStats, { props: { block } });
  await fireEvent.click(screen.getByTestId("story-stats-cover-0"));
  expect(screen.getByText("6,870")).toBeInTheDocument();
  expect(screen.queryByTestId("story-stats-cover-0")).not.toBeInTheDocument();
});

test("shows the prompt only while a click_to_reveal item is still covered", async () => {
  const block = statsBlock({
    prompt: "Guess it",
    items: [{ value: 6870, label: "bans", visibility: "click_to_reveal" }],
  });
  render(StoryStats, { props: { block } });
  expect(screen.getByText("Guess it")).toBeInTheDocument();
  await fireEvent.click(screen.getByTestId("story-stats-cover-0"));
  expect(screen.queryByText("Guess it")).not.toBeInTheDocument();
});

test("does not render a prompt when no item is click_to_reveal", () => {
  const block = statsBlock({ prompt: "Guess it", items: [{ value: 1, label: "a" }] });
  render(StoryStats, { props: { block } });
  expect(screen.queryByText("Guess it")).not.toBeInTheDocument();
});

test("does not render a cover for items with default visibility", () => {
  const block = statsBlock({ items: [{ value: 1, label: "a" }] });
  render(StoryStats, { props: { block } });
  expect(document.querySelector(".story-stats__cover")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/StoryStats.test.ts`
Expected: FAIL — component still reads the old `block.items`/`block.caption` shape directly.

- [ ] **Step 3: Replace `src/components/StoryStats.svelte`**

```svelte
<script lang="ts">
  import "./StoryStats.css";
  import type { StoryBlock } from "../types/storyline";

  let { block }: { block: Extract<StoryBlock, { type: "stats" }> } = $props();

  let revealed = $state<Record<number, boolean>>({});

  function toggle(idx: number): void {
    revealed = { ...revealed, [idx]: true };
  }

  function display(value: number | string): string {
    return typeof value === "number" ? value.toLocaleString("en-US") : value;
  }

  let anyHiddenCovered = $derived(
    block.doc.items.some((item, idx) => item.visibility === "click_to_reveal" && !revealed[idx]),
  );
</script>

<div class="story-stats">
  {#if block.doc.prompt && anyHiddenCovered}
    <p class="story-stats__prompt">{block.doc.prompt}</p>
  {/if}
  <div class="story-stats__grid">
    {#each block.doc.items as item, idx (idx)}
      <div class="story-stats__item">
        {#if item.visibility === "click_to_reveal" && !revealed[idx]}
          <button
            type="button"
            class="story-stats__cover"
            aria-pressed={false}
            data-testid="story-stats-cover-{idx}"
            onclick={() => toggle(idx)}
          >
            <span class="story-stats__cover-label">Tap to reveal</span>
          </button>
        {:else}
          <div class="story-stats__value">{display(item.value)}</div>
        {/if}
        <div class="story-stats__label">{item.label}</div>
      </div>
    {/each}
  </div>
  {#if block.doc.footnote}
    <div class="story-stats__footnote">{block.doc.footnote}</div>
  {/if}
</div>
```

- [ ] **Step 4: Replace `src/components/StoryStats.css`**

```css
.story-stats {
  text-align: left;
}

.story-stats__prompt {
  font-size: var(--font-size-base);
  color: var(--color-text);
  margin: 0 0 var(--storyline-gap-inner);
}

.story-stats__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 16px;
  padding: 16px;
  background: var(--color-text);
  border-radius: 8px;
}

.story-stats__item {
  text-align: left;
}

.story-stats__value {
  font-size: var(--font-size-3xl);
  font-weight: 700;
  line-height: 1;
  color: var(--color-background);
}

.story-stats__cover {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  background: var(--color-background);
  cursor: pointer;
}

.story-stats__cover-label {
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text);
}

.story-stats__label {
  margin-top: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-background);
  opacity: 0.7;
}

.story-stats__footnote {
  margin-top: 8px;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

@media (prefers-reduced-motion: no-preference) {
  .story-stats__value {
    animation: story-stats-reveal 0.2s ease;
  }
}

@keyframes story-stats-reveal {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

(This is the same visual treatment pass 2 already settled on — dark ground,
light numerals, inline tap-to-reveal cover — carried over verbatim, minus
the retired `cover` skin choice.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/test/StoryStats.test.ts`
Expected: PASS, all 8 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/StoryStats.svelte src/components/StoryStats.css src/test/StoryStats.test.ts
git commit -m "feat: rewrite StoryStats for the doc-based v0.3 stats shape"
```

---

### Task 9: `StoryFold` + `StoryBlockRenderer` rewire; delete `StoryCallout`/`StoryReveal`

Same mutual-recursion pairing as the v0.1 plan — ships as one task.

**Files:**
- Modify: `src/components/StoryFold.svelte` (prop type only — mechanics unchanged)
- Modify: `src/components/StoryBlockRenderer.svelte` (four-way dispatch)
- Modify: `src/test/StoryFold.test.ts`
- Modify: `src/test/StoryBlockRenderer.test.ts`
- Delete: `src/components/StoryCallout.svelte`, `src/components/StoryCallout.css`, `src/test/StoryCallout.test.ts`
- Delete: `src/components/StoryReveal.svelte`, `src/components/StoryReveal.css`, `src/test/StoryReveal.test.ts`

**Interfaces:**
- Consumes: `StoryProse` (Task 6), `StoryHook` (Task 7), `StoryStats` (Task 8), `FoldBlock` (Task 1).
- Produces: `StoryBlockRenderer.svelte` — prop `{ block: StoryBlock }`, unchanged shape.

- [ ] **Step 1: Delete the retired components**

```bash
git rm src/components/StoryCallout.svelte src/components/StoryCallout.css src/test/StoryCallout.test.ts
git rm src/components/StoryReveal.svelte src/components/StoryReveal.css src/test/StoryReveal.test.ts
```

- [ ] **Step 2: Replace `src/test/StoryBlockRenderer.test.ts`**

```ts
import { render, screen } from "@testing-library/svelte/svelte5";
import StoryBlockRenderer from "../components/StoryBlockRenderer.svelte";
import type { StoryBlock } from "../types/storyline";

test("dispatches a prose block through StoryProse", () => {
  const block: StoryBlock = { type: "prose", markdown: "Hello there." };
  render(StoryBlockRenderer, { props: { block } });
  expect(screen.getByText("Hello there.")).toBeInTheDocument();
});

test("dispatches a hook block", () => {
  const block: StoryBlock = { type: "hook", markdown: "Just a hook." };
  render(StoryBlockRenderer, { props: { block } });
  expect(document.querySelector(".story-hook")).toHaveTextContent("Just a hook.");
});

test("dispatches a stats block", () => {
  const block: StoryBlock = { type: "stats", doc: { items: [{ value: 1, label: "one" }] }, ref: "x.yaml" };
  render(StoryBlockRenderer, { props: { block } });
  expect(document.querySelector(".story-stats")).toBeInTheDocument();
});

test("dispatches a fold block through StoryFold", () => {
  const block: StoryBlock = {
    type: "fold",
    label: "Read more",
    blocks: [{ type: "prose", markdown: "Extra." }],
  };
  render(StoryBlockRenderer, { props: { block } });
  expect(screen.getByTestId("story-fold-toggle")).toBeInTheDocument();
});
```

- [ ] **Step 3: Replace `src/test/StoryFold.test.ts`**

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import StoryFold from "../components/StoryFold.svelte";
import type { StoryBlock } from "../types/storyline";

test("hides inner blocks until toggled open, using the block's own label", async () => {
  const block: Extract<StoryBlock, { type: "fold" }> = {
    type: "fold",
    label: "Read the full story",
    blocks: [{ type: "prose", markdown: "Hidden text." }],
  };
  render(StoryFold, { props: { block } });
  expect(screen.queryByText("Hidden text.")).not.toBeInTheDocument();
  const toggle = screen.getByTestId("story-fold-toggle");
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(toggle).toHaveTextContent("Read the full story");
  await fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Hidden text.")).toBeInTheDocument();
});

test("recurses through nested block kinds when opened", async () => {
  const block: Extract<StoryBlock, { type: "fold" }> = {
    type: "fold",
    label: "See more",
    blocks: [{ type: "stats", doc: { items: [{ value: 1, label: "one" }] }, ref: "x.yaml" }],
  };
  render(StoryFold, { props: { block } });
  await fireEvent.click(screen.getByTestId("story-fold-toggle"));
  expect(document.querySelector(".story-stats")).toBeInTheDocument();
});

test("shows a custom label and switches to Show less when open", async () => {
  const block: Extract<StoryBlock, { type: "fold" }> = { type: "fold", label: "See more", blocks: [] };
  render(StoryFold, { props: { block } });
  const toggle = screen.getByTestId("story-fold-toggle");
  expect(toggle).toHaveTextContent("See more");
  await fireEvent.click(toggle);
  expect(toggle).toHaveTextContent("Show less");
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/test/StoryFold.test.ts src/test/StoryBlockRenderer.test.ts`
Expected: FAIL — `StoryFold` still reads a hardcoded "Read the full story"
label and `block.blocks` typed against the old `LeafBlock`; `StoryBlockRenderer`
still dispatches `callout`/`reveal`/`detail`.

- [ ] **Step 5: Update `src/components/StoryFold.svelte`**

Change the prop type and the toggle label to use `block.label`:

```svelte
<script lang="ts">
  import "./StoryFold.css";
  import type { StoryBlock } from "../types/storyline";
  import StoryBlockRenderer from "./StoryBlockRenderer.svelte";
  import { ChevronDown } from "lucide-svelte";

  let { block }: { block: Extract<StoryBlock, { type: "fold" }> } = $props();

  let open = $state(false);

  function toggle(): void {
    open = !open;
  }
</script>

<div class="story-fold">
  <button
    type="button"
    class="story-fold__toggle"
    aria-expanded={open}
    data-testid="story-fold-toggle"
    onclick={toggle}
  >
    <span class="story-fold__label">{open ? "Show less" : block.label}</span>
    <span class="story-fold__caret" class:story-fold__caret--open={open}>
      <ChevronDown size={16} aria-hidden="true" />
    </span>
  </button>
  {#if open}
    <div class="story-fold__body" data-testid="story-fold-body">
      {#each block.blocks as inner, idx (idx)}
        <StoryBlockRenderer block={inner} />
      {/each}
    </div>
  {/if}
</div>
```

(CSS is unchanged from the previous pass — no edit needed to `StoryFold.css`.)

- [ ] **Step 6: Replace `src/components/StoryBlockRenderer.svelte`**

```svelte
<script lang="ts">
  import type { StoryBlock } from "../types/storyline";
  import StoryProse from "./StoryProse.svelte";
  import StoryHook from "./StoryHook.svelte";
  import StoryStats from "./StoryStats.svelte";
  import StoryFold from "./StoryFold.svelte";

  let { block }: { block: StoryBlock } = $props();
</script>

{#if block.type === "prose"}
  <StoryProse markdown={block.markdown} />
{:else if block.type === "hook"}
  <StoryHook {block} />
{:else if block.type === "stats"}
  <StoryStats {block} />
{:else if block.type === "fold"}
  <StoryFold {block} />
{/if}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/test/StoryFold.test.ts src/test/StoryBlockRenderer.test.ts`
Expected: PASS, all 7 tests.

- [ ] **Step 8: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors — this is the point where every `Story*` component
should now be consistent with the Task 1 types.

- [ ] **Step 9: Commit**

```bash
git add src/components/StoryFold.svelte src/components/StoryFold.css \
  src/components/StoryBlockRenderer.svelte src/test/StoryFold.test.ts src/test/StoryBlockRenderer.test.ts
git commit -m "feat: rewire StoryBlockRenderer dispatch, retire StoryCallout/StoryReveal"
```

---

### Task 10: `Storyline.svelte` + `ChallengeCard.svelte` wiring

**Files:**
- Modify: `src/components/Storyline.svelte`
- Modify: `src/components/ChallengeCard.svelte`
- Modify: `src/test/Storyline.test.ts`
- Modify: `src/test/ChallengeCard.test.ts`

**Interfaces:**
- Consumes: `parseStoryline`, `validateStoryline` (Task 3); `StoryBlockRenderer`
  (Task 9); `Location.storylineElements` (Task 1).
- Produces: `Storyline.svelte` — prop `{ text?: string; elements?: Record<string, StatsDoc> }`.

- [ ] **Step 1: Replace `src/test/Storyline.test.ts`**

```ts
import { render, screen } from "@testing-library/svelte/svelte5";
import Storyline from "../components/Storyline.svelte";

test("extracts and renders the hook", () => {
  render(Storyline, { props: { text: "## Bans are not ==about books==.", elements: {} } });
  expect(document.querySelector(".story-hook mark")).toHaveTextContent("about books");
});

test("falls back to plain prose when there are no constructs", () => {
  render(Storyline, { props: { text: "Just a normal paragraph.", elements: {} } });
  expect(screen.getByText("Just a normal paragraph.")).toBeInTheDocument();
});

test("resolves a stats transclusion via the elements prop", () => {
  render(Storyline, {
    props: {
      text: "{{stats: x.yaml}}",
      elements: { "x.yaml": { items: [{ value: 1, label: "one" }] } },
    },
  });
  expect(document.querySelector(".story-stats")).toBeInTheDocument();
});

test("renders nothing when text is empty", () => {
  const { container } = render(Storyline, { props: { text: "", elements: {} } });
  expect(container.querySelector(".storyline-root")).not.toBeInTheDocument();
});

test("renders nothing when text is undefined", () => {
  const { container } = render(Storyline, { props: {} });
  expect(container.querySelector(".storyline-root")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Add to `src/test/ChallengeCard.test.ts`**

Replace the existing `test("renders storyline directives through Storyline blocks", ...)`
case (it used the retired `:::hook{...}` syntax) with:

```ts
test("renders storyline hook markup through Storyline blocks", () => {
  const withHook = {
    ...location,
    storyline: "## A ==historic== place.",
  };
  render(ChallengeCard, { props: { location: withHook } });
  expect(document.querySelector(".story-hook mark")).toHaveTextContent("historic");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/test/Storyline.test.ts src/test/ChallengeCard.test.ts`
Expected: FAIL — `Storyline.svelte` still calls the old two-argument-free
`parseStoryline(text)` and has no `elements` prop.

- [ ] **Step 4: Replace `src/components/Storyline.svelte`**

```svelte
<script lang="ts">
  import "./Storyline.css";
  import { parseStoryline, validateStoryline } from "../utils/storylineBlocks";
  import StoryBlockRenderer from "./StoryBlockRenderer.svelte";
  import type { StatsDoc } from "../types/storyline";

  let { text, elements = {} }: { text?: string; elements?: Record<string, StatsDoc> } = $props();

  let parsed = $derived(text ? parseStoryline(text, elements) : { blocks: [], warnings: [] });
  let blocks = $derived(parsed.blocks);

  $effect(() => {
    if (import.meta.env.DEV) {
      for (const warning of [...parsed.warnings, ...validateStoryline(blocks)]) {
        console.warn(`Storyline: ${warning}`);
      }
    }
  });
</script>

{#if blocks.length > 0}
  <div class="storyline-root">
    {#each blocks as block, idx (idx)}
      <StoryBlockRenderer {block} />
    {/each}
  </div>
{/if}
```

- [ ] **Step 5: Update `src/components/ChallengeCard.svelte`**

Change the `<Storyline ... />` call site (added in the previous pass) to
also pass `elements`:

```svelte
<Storyline text={location.storyline} elements={location.storylineElements} />
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/test/Storyline.test.ts src/test/ChallengeCard.test.ts`
Expected: PASS, all cases.

- [ ] **Step 7: Run the full suite, lint, and typecheck**

Run: `npm run test:run && npm run lint && npm run typecheck`
Expected: all green. This is the point where `TextScreen.svelte` and
`MarkdownText.svelte`'s untouched behavior get implicitly re-confirmed by
the full suite.

- [ ] **Step 8: Commit**

```bash
git add src/components/Storyline.svelte src/components/ChallengeCard.svelte \
  src/test/Storyline.test.ts src/test/ChallengeCard.test.ts
git commit -m "feat: wire storylineElements through Storyline and ChallengeCard"
```

---

### Task 11: Content migration — `012_loc_right_to_read_blocks.yaml`

**Files:**
- Create: `src/data/text/en/projects/democrats_abroad/den_haag/013_stats_right_to_read.yaml`
- Modify: `src/data/text/en/projects/democrats_abroad/den_haag/012_loc_right_to_read_blocks.yaml`

- [ ] **Step 1: Write `013_stats_right_to_read.yaml`**

```yaml
prompt: "Before you look at the numbers — guess how many school book bans were recorded in a single US school year."
footnote: "Recorded by PEN America, 2024–2025 school year."
items:
  - value: 6870
    label: "school book bans"
    visibility: click_to_reveal
  - value: 23
    label: "states"
  - value: 87
    label: "public school districts"
```

- [ ] **Step 2: Rewrite the `storyline` field in `012_loc_right_to_read_blocks.yaml`**

Replace the entire `storyline: |` block with:

```yaml
storyline: |
  ## Book bans are not ==just about books==.

  They are about who gets to be seen, whose stories are considered dangerous, and what ideas young people are allowed to encounter.

  {{stats: 013_stats_right_to_read.yaml}}

  What someone tried to remove from public life is still here.

  [+] Read the full story

    In the United States, attempts to ban, challenge, restrict, or remove books from schools and libraries have increased sharply in recent years.

    The American Library Association also tracks censorship attempts in libraries and schools and reported that thousands of unique titles have been targeted, with many challenges focusing on books involving LGBTQ+ people, people of color, sexuality, racism, gender, violence, or honest accounts of history.

    That pattern is the point of this stop. A book does not have to be illegal everywhere to be part of a censorship campaign. It may have been removed from a school library, restricted to certain students, challenged by a parent group, pulled during review, or banned under a state or district policy.
```

- [ ] **Step 3: Validate**

Run: `npm run validate:yaml`
Expected: exit code 0, no `ERROR:` lines — this is also the first real
exercise of the `:::`-rejection check (should now pass, since the file no
longer contains any `:::`) and of `checkStatsFile` against a real file.

- [ ] **Step 4: Parse-check the real content directly**

Create a temporary Node script (not committed — delete after running) that
loads the two files and runs them through the real parser, to see the
resolved block tree end to end before trusting the CI exit code alone:

```ts
// _scratch_check_parse.ts (repo root, delete after running)
import { readFileSync } from "node:fs";
import { load as loadYaml } from "js-yaml";
import { parseStoryline, validateStoryline } from "./src/utils/storylineBlocks";

const dir = "src/data/text/en/projects/democrats_abroad/den_haag/";
const loc = loadYaml(readFileSync(dir + "012_loc_right_to_read_blocks.yaml", "utf8")) as {
  storyline: string;
};
const stats = loadYaml(readFileSync(dir + "013_stats_right_to_read.yaml", "utf8"));
const { blocks, warnings } = parseStoryline(loc.storyline, {
  "013_stats_right_to_read.yaml": stats as never,
});
console.log("block types:", blocks.map((block) => block.type).join(", "));
console.log("warnings:", JSON.stringify(warnings));
console.log("validate warnings:", JSON.stringify(validateStoryline(blocks)));
```

Run: `npx tsx _scratch_check_parse.ts`, then `rm _scratch_check_parse.ts`
Expected: `block types: hook, prose, stats, prose, fold`; both warning
arrays empty.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev`, open the Den Haag `short_loop` route, confirm
`012_loc_right_to_read_blocks` (second stop) renders: hook with `just about
books` highlighted, stats grid (dark ground, 6,870 covered until tapped,
23/87 visible), the "What someone tried to remove..." line, and "Read the
full story" expanding the three background paragraphs.

- [ ] **Step 6: Commit**

```bash
git add src/data/text/en/projects/democrats_abroad/den_haag/013_stats_right_to_read.yaml \
  src/data/text/en/projects/democrats_abroad/den_haag/012_loc_right_to_read_blocks.yaml
git commit -m "content: migrate the Right to Read preview to v0.3 syntax"
```

---

### Task 12: Full verification

- [ ] **Step 1:** `npm run test:run` — expect all test files passing.
- [ ] **Step 2:** `npm run lint` — expect zero errors.
- [ ] **Step 3:** `npm run typecheck` — expect zero errors (the 2
  pre-existing `state_referenced_locally` warnings in
  `JoinTeamPage.svelte`/`LoginPage.svelte` are unrelated and expected).
- [ ] **Step 4:** `npm run validate:yaml` — expect exit 0.
- [ ] **Step 5:** Grep the repo for any remaining reference to retired
  symbols, to catch a missed call site: `grep -rn "CalloutTone\|StoryCallout\|StoryReveal\|LeafBlock" src/`
  — expect zero matches outside this plan's deletions (i.e., zero matches
  at all).

---

## What this plan does not cover

The count-up animation, locale-aware (non-`en-US`) number formatting, and
the mobile hero-number responsive layout — all explicitly deferred per this
session's scoping discussion. Re-authoring any *other* location's content
in v0.3 syntax — only `012_loc_right_to_read_blocks.yaml` is touched here.
