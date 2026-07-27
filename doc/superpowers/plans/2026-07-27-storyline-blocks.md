# Storyline Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wall-of-text `storyline` field with a closed set of six
authorable content blocks (`prose`, `hook`, `stats`, `reveal`, `callout`,
`detail`) rendered through dedicated Svelte components, with zero-directive
storylines still rendering exactly as they do today.

**Architecture:** A hand-written line-based tokenizer
(`src/utils/storylineBlocks.ts`) turns a `storyline` string into a typed
`StoryBlock[]` (`src/types/storyline.ts`) — no new markdown/validation
dependency; inline markdown inside `prose`/`callout` bodies still goes
through the existing `marked`-backed `MarkdownText.svelte`. A dispatcher
component (`StoryBlockRenderer.svelte`) renders each block via one component
per kind. `Storyline.svelte` wraps parse+validate+dispatch and replaces the
direct `MarkdownText` call for `location.storyline` in `ChallengeCard.svelte`.
CI validation is added to the existing `scripts/validate-yaml.js` (ported to
`.ts`, run via `tsx`) rather than a new script.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + `@testing-library/svelte/svelte5`.

**Spec:** `doc/superpowers/specs/2026-07-27-storyline-blocks-design.md`. One
refinement made during planning: the design doc lists six `validateStoryline`
rules, but four of them (`reveal.answer` present, no nested `detail`,
`hook.accent` substring, `cover`/`tone` in range) turn out to be structurally
impossible to violate once the parser degrades malformed directives to
`prose` at parse time — the parser enforces them, so `validateStoryline`
below only re-checks the two rules a parser fix-up would silently destroy
authored content for: at-most-one top-level `detail`, and `stats` item count
(dropping extra `stats` items would erase content the author wrote, so it's
a warning, not a coercion).

## Global Constraints

- TypeScript only in `src/`; no `.js`/`.jsx`/`.tsx`. `scripts/*.ts` also
  exists (see `scripts/backfill-photos.ts`) but is **not** covered by
  `npm run typecheck` (`tsconfig.json` only includes `src/**/*.ts` and
  `src/**/*.svelte`) — this is pre-existing, not a gap this plan introduces.
- Co-located `.css` per component, `var(--color-*)` / `var(--font-size-*)`
  tokens only — this codebase has no `--space-*` tokens; spacing is literal
  px, matching every existing `.css` file. Full BEM
  (`component-name__element--modifier`) per `CLAUDE.md`.
- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) — no Svelte 4 `$:`.
- ESLint (`eslint.config.js`): `complexity` max 10/function; `max-len` 100
  (`.svelte` ignores lines starting with `<`); `curly: all` (braces on every
  `if`, even one-liners); `id-length` min 3 with an exception list (`id`,
  `to`, `ok`, and a handful of single letters — none of the identifiers in
  this plan need an exception); `no-restricted-syntax` bans naked
  `return;` and a specific for-of guard-loop pattern — neither occurs in
  this plan's code; `unused-imports/no-unused-imports` is an error.
- No zod/valibot/mdsvex/remark in this repo and none is added. The only
  markdown dependency is `marked@18`, used solely inside
  `MarkdownText.svelte`; this plan reuses that component rather than calling
  `marked` directly anywhere else.
- Tests: Vitest, files at `src/test/<Name>.test.ts` (mirrors the source
  file's basename, not co-located). `test`/`expect`/`vi` are globals (see
  `tsconfig.json` `"types": ["vitest/globals"]`) — no import needed for
  those three. Svelte component tests use
  `import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";`.
- `src/data/schemas/location.schema.json`'s `storyline` field is **not**
  changed by this plan — it stays `{ "type": "string" }`.

---

### Task 1: Storyline type model, parser, and validator

**Files:**
- Create: `src/types/storyline.ts`
- Create: `src/utils/storylineBlocks.ts`
- Test: `src/test/storylineBlocks.test.ts`

**Interfaces:**
- Produces (`src/types/storyline.ts`): `Cover = "redaction" | "blur" | "card"`,
  `CalloutTone = "default" | "task" | "quote"`, `StatItem { value: string; label: string }`,
  `StoryBlock` (discriminated union on `type`, variants below), `LeafBlock = Exclude<StoryBlock, { type: "detail" }>`.
- Produces (`src/utils/storylineBlocks.ts`): `parseStoryline(text: string): StoryBlock[]`,
  `validateStoryline(blocks: StoryBlock[]): string[]` (returns human-readable warning
  strings, `[]` when clean).
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write `src/types/storyline.ts`**

```ts
export type Cover = "redaction" | "blur" | "card";
export type CalloutTone = "default" | "task" | "quote";

export interface StatItem {
  value: string; // e.g. "6,870" — never coerced to number, must round-trip verbatim
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

- [ ] **Step 2: Write the failing parser/validator tests**

Create `src/test/storylineBlocks.test.ts`:

```ts
import { parseStoryline, validateStoryline } from "../utils/storylineBlocks";
import type { StoryBlock } from "../types/storyline";

test("returns a single prose block for text with no directives", () => {
  const blocks = parseStoryline("Just a paragraph.");
  expect(blocks).toEqual([{ type: "prose", markdown: "Just a paragraph." }]);
});

test("drops blank prose runs", () => {
  expect(parseStoryline("\n\n  \n")).toEqual([]);
});

test("parses a hook directive with an accent substring", () => {
  const blocks = parseStoryline(
    ':::hook{accent="just about books"}\nBook bans are not just about books.\n:::',
  );
  expect(blocks).toEqual([
    { type: "hook", text: "Book bans are not just about books.", accent: "just about books" },
  ]);
});

test("drops the accent when it is not a substring of the hook text", () => {
  const blocks = parseStoryline(':::hook{accent="nope"}\nBook bans are not just about books.\n:::');
  expect(blocks).toEqual([{ type: "hook", text: "Book bans are not just about books." }]);
});

test("parses stats items and caption", () => {
  const blocks = parseStoryline(
    ':::stats{caption="Recorded by PEN America."}\n- 6,870 | school book bans\n- 23 | states\n:::',
  );
  expect(blocks).toEqual([
    {
      type: "stats",
      items: [
        { value: "6,870", label: "school book bans" },
        { value: "23", label: "states" },
      ],
      caption: "Recorded by PEN America.",
    },
  ]);
});

test("skips malformed stats lines instead of crashing", () => {
  const blocks = parseStoryline(":::stats\n- not a pair\n- 23 | states\n:::");
  expect(blocks).toEqual([
    { type: "stats", items: [{ value: "23", label: "states" }] },
  ]);
});

test("does not truncate a stats block with more than four items", () => {
  const blocks = parseStoryline(":::stats\n- 1 | a\n- 2 | b\n- 3 | c\n- 4 | d\n- 5 | e\n:::");
  expect((blocks[0] as Extract<StoryBlock, { type: "stats" }>).items).toHaveLength(5);
});

test("parses a reveal directive with cover and hint", () => {
  const blocks = parseStoryline(
    ':::reveal{answer="6,870" cover="redaction" hint="in a single school year"}\nGuess the number:\n:::',
  );
  expect(blocks).toEqual([
    {
      type: "reveal",
      prompt: "Guess the number:",
      answer: "6,870",
      cover: "redaction",
      hint: "in a single school year",
    },
  ]);
});

test("degrades a reveal with no answer to prose", () => {
  expect(parseStoryline(":::reveal\nGuess the number:\n:::")).toEqual([
    { type: "prose", markdown: "Guess the number:" },
  ]);
});

test("falls back to the default cover when given an unknown cover value", () => {
  const blocks = parseStoryline(':::reveal{answer="1" cover="sparkles"}\nGuess:\n:::');
  expect(blocks).toEqual([{ type: "reveal", prompt: "Guess:", answer: "1", cover: "card" }]);
});

test("parses a callout with label and tone", () => {
  const blocks = parseStoryline(':::callout{label="Your job" tone="task"}\nFind it.\n:::');
  expect(blocks).toEqual([{ type: "callout", markdown: "Find it.", label: "Your job", tone: "task" }]);
});

test("defaults callout tone when omitted", () => {
  const blocks = parseStoryline(":::callout\nA note.\n:::");
  expect(blocks).toEqual([{ type: "callout", markdown: "A note.", tone: "default" }]);
});

test("parses a detail block containing leaf blocks", () => {
  const blocks = parseStoryline(
    ':::detail\nBackground text.\n\n:::callout{tone="quote"}\nA quote.\n:::\n:::',
  );
  expect(blocks).toEqual([
    {
      type: "detail",
      blocks: [
        { type: "prose", markdown: "Background text." },
        { type: "callout", markdown: "A quote.", tone: "quote" },
      ],
    },
  ]);
});

test("degrades a detail nested inside a detail to prose", () => {
  const blocks = parseStoryline(":::detail\n:::detail\nnope\n:::\n:::");
  expect(blocks).toEqual([{ type: "detail", blocks: [{ type: "prose", markdown: "nope" }] }]);
});

test("treats an unknown directive name as prose", () => {
  expect(parseStoryline(":::whatever\nSome text.\n:::")).toEqual([
    { type: "prose", markdown: "Some text." },
  ]);
});

test("mixes prose and directives in document order", () => {
  const blocks = parseStoryline("Intro line.\n\n:::hook\nA hook.\n:::\n\nOutro line.");
  expect(blocks).toEqual([
    { type: "prose", markdown: "Intro line." },
    { type: "hook", text: "A hook." },
    { type: "prose", markdown: "Outro line." },
  ]);
});

test("validateStoryline flags more than one top-level detail block", () => {
  const blocks: StoryBlock[] = [
    { type: "detail", blocks: [] },
    { type: "detail", blocks: [] },
  ];
  expect(validateStoryline(blocks)).toEqual(['found 2 ":::detail" blocks, at most one is allowed']);
});

test("validateStoryline flags a stats block outside 1-4 items, including inside a detail", () => {
  const blocks: StoryBlock[] = [
    { type: "stats", items: [] },
    {
      type: "detail",
      blocks: [
        {
          type: "stats",
          items: [
            { value: "1", label: "a" },
            { value: "2", label: "b" },
            { value: "3", label: "c" },
            { value: "4", label: "d" },
            { value: "5", label: "e" },
          ],
        },
      ],
    },
  ];
  expect(validateStoryline(blocks)).toEqual([
    '":::stats" has 0 items, expected 1-4',
    '":::stats" has 5 items, expected 1-4',
  ]);
});

test("validateStoryline returns no warnings for a clean storyline", () => {
  const blocks = parseStoryline("Intro.\n\n:::stats\n- 1 | one\n:::");
  expect(validateStoryline(blocks)).toEqual([]);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/test/storylineBlocks.test.ts`
Expected: FAIL — `../utils/storylineBlocks` has no exported member `parseStoryline`.

- [ ] **Step 4: Write `src/utils/storylineBlocks.ts`**

```ts
import type { Cover, CalloutTone, StatItem, StoryBlock, LeafBlock } from "../types/storyline";

const FENCE_OPEN = /^:::(\w+)(\{([^}]*)\})?\s*$/;
const FENCE_CLOSE = /^:::\s*$/;
const ATTR_PAIR = /(\w+)="([^"]*)"/g;
const STAT_LINE = /^-\s*(.+?)\s*\|\s*(.+)$/;

interface RawDirective {
  name: string;
  attrs: Record<string, string>;
  body: string;
}

type Segment = { prose: string } | RawDirective;

function parseAttrs(raw: string | undefined): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (raw) {
    for (const match of raw.matchAll(ATTR_PAIR)) {
      attrs[match[1]] = match[2];
    }
  }
  return attrs;
}

// Tracks fence depth so a nested `:::detail`'s own closing `:::` doesn't get
// mistaken for the outer directive's close — both are bare ":::" lines.
function tokenize(text: string): Segment[] {
  const lines = text.split("\n");
  const segments: Segment[] = [];
  let proseLines: string[] = [];
  let index = 0;

  const flushProse = (): void => {
    const prose = proseLines.join("\n");
    if (prose.trim().length > 0) {
      segments.push({ prose });
    }
    proseLines = [];
  };

  while (index < lines.length) {
    const open = FENCE_OPEN.exec(lines[index]);
    if (!open) {
      proseLines.push(lines[index]);
      index += 1;
      continue;
    }
    flushProse();
    const name = open[1];
    const attrs = parseAttrs(open[3]);
    index += 1;
    const bodyLines: string[] = [];
    let depth = 1;
    while (index < lines.length && depth > 0) {
      const line = lines[index];
      if (FENCE_OPEN.test(line)) {
        depth += 1;
        bodyLines.push(line);
        index += 1;
      } else if (FENCE_CLOSE.test(line)) {
        depth -= 1;
        index += 1;
        if (depth > 0) {
          bodyLines.push(line);
        }
      } else {
        bodyLines.push(line);
        index += 1;
      }
    }
    segments.push({ name, attrs, body: bodyLines.join("\n").trim() });
  }
  flushProse();
  return segments;
}

function toStatItems(body: string): StatItem[] {
  return body
    .split("\n")
    .map((line) => STAT_LINE.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ value: match[1], label: match[2] }));
}

function toCover(raw: string | undefined): Cover {
  return raw === "redaction" || raw === "blur" || raw === "card" ? raw : "card";
}

function toTone(raw: string | undefined): CalloutTone {
  return raw === "task" || raw === "quote" ? raw : "default";
}

// Never returns "detail" — this is what makes nested `:::detail` and
// malformed `:::reveal`/`:::hook` degrade to prose instead of crashing or
// needing a second validation pass.
function toBlock(segment: RawDirective): LeafBlock {
  if (segment.name === "hook") {
    const accent = segment.attrs.accent;
    if (accent && segment.body.includes(accent)) {
      return { type: "hook", text: segment.body, accent };
    }
    return { type: "hook", text: segment.body };
  }
  if (segment.name === "stats") {
    return { type: "stats", items: toStatItems(segment.body), caption: segment.attrs.caption };
  }
  if (segment.name === "reveal" && segment.attrs.answer) {
    return {
      type: "reveal",
      prompt: segment.body,
      answer: segment.attrs.answer,
      cover: toCover(segment.attrs.cover),
      hint: segment.attrs.hint,
    };
  }
  if (segment.name === "callout") {
    return {
      type: "callout",
      markdown: segment.body,
      label: segment.attrs.label,
      tone: toTone(segment.attrs.tone),
    };
  }
  return { type: "prose", markdown: segment.body };
}

function parseLeafBlocks(text: string): LeafBlock[] {
  return tokenize(text).map((segment): LeafBlock => {
    if ("prose" in segment) {
      return { type: "prose", markdown: segment.prose.trim() };
    }
    return toBlock(segment);
  });
}

export function parseStoryline(text: string): StoryBlock[] {
  return tokenize(text).map((segment): StoryBlock => {
    if ("prose" in segment) {
      return { type: "prose", markdown: segment.prose.trim() };
    }
    if (segment.name === "detail") {
      return { type: "detail", blocks: parseLeafBlocks(segment.body) };
    }
    return toBlock(segment);
  });
}

function collectStatsWarnings(blocks: StoryBlock[]): string[] {
  const warnings: string[] = [];
  for (const block of blocks) {
    if (block.type === "stats" && (block.items.length < 1 || block.items.length > 4)) {
      warnings.push(`":::stats" has ${block.items.length} items, expected 1-4`);
    }
    if (block.type === "detail") {
      warnings.push(...collectStatsWarnings(block.blocks));
    }
  }
  return warnings;
}

export function validateStoryline(blocks: StoryBlock[]): string[] {
  const detailCount = blocks.filter((block) => block.type === "detail").length;
  const detailWarnings =
    detailCount > 1 ? [`found ${detailCount} ":::detail" blocks, at most one is allowed`] : [];
  return [...detailWarnings, ...collectStatsWarnings(blocks)];
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/test/storylineBlocks.test.ts`
Expected: PASS, all 18 tests.

- [ ] **Step 6: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors from the two new files.

- [ ] **Step 7: Commit**

```bash
git add src/types/storyline.ts src/utils/storylineBlocks.ts src/test/storylineBlocks.test.ts
git commit -m "feat: add storyline block parser and validator"
```

---

### Task 2: Wire storyline validation into the CI YAML check

**Files:**
- Create: `scripts/validate-yaml.ts` (replaces `scripts/validate-yaml.js`)
- Delete: `scripts/validate-yaml.js`
- Modify: `package.json:17` (`validate:yaml` script)

**Interfaces:**
- Consumes: `parseStoryline`, `validateStoryline` from `src/utils/storylineBlocks.ts` (Task 1).
- Produces: nothing new consumed by later tasks — this task only wires CI.

- [ ] **Step 1: Write `scripts/validate-yaml.ts`**

Same content as today's `scripts/validate-yaml.js`, with types added and a
`checkStoryline` pass folded into the `*_loc_*.yaml` check:

```ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import Ajv, { type ValidateFunction, type ErrorObject } from "ajv";
import { parseStoryline, validateStoryline } from "../src/utils/storylineBlocks";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DATA_DIR = join(ROOT, "src", "data", "text", "en", "projects");

function loadSchema(name: string): object {
  const schemaPath = join(ROOT, "src", "data", "schemas", name);
  return JSON.parse(readFileSync(schemaPath, "utf8"));
}

const ajv = new Ajv({ allErrors: true });
const validateLoc = ajv.compile(loadSchema("location.schema.json"));
const validateForm = ajv.compile(loadSchema("form.schema.json"));
const validateText = ajv.compile(loadSchema("text.schema.json"));
const validateSplash = ajv.compile(loadSchema("splash.schema.json"));
const validateOptions = ajv.compile(loadSchema("options.schema.json"));
const validateCheckpoint = ajv.compile(loadSchema("checkpoint.schema.json"));

function findFiles(dir: string, pattern: RegExp): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return findFiles(fullPath, pattern);
    }
    if (pattern.test(entry.name)) {
      return [fullPath];
    }
    return [];
  });
}

function formatError(err: ErrorObject): string {
  const path = err.instancePath || "(root)";
  const extra = err.params?.additionalProperty
    ? ` ('${err.params.additionalProperty}')`
    : "";
  return `${path}: ${err.message}${extra}`;
}

function checkFile(filePath: string, validator: ValidateFunction): string[] {
  const content = readFileSync(filePath, "utf8");
  const data = loadYaml(content);
  if (validator(data)) {
    return [];
  }
  return (validator.errors ?? []).map(formatError);
}

function checkStoryline(filePath: string): string[] {
  const content = readFileSync(filePath, "utf8");
  const data = loadYaml(content) as { storyline?: string };
  if (!data.storyline) {
    return [];
  }
  return validateStoryline(parseStoryline(data.storyline)).map((msg) => `/storyline: ${msg}`);
}

const LOC_PATTERN = /^\d+_loc_.*\.yaml$/;
const FORM_PATTERN = /^\d+_form_.*\.yaml$/;
const TEXT_PATTERN = /^\d+_text_.*\.yaml$/;
const SPLASH_PATTERN = /^\d+_splash_.*\.yaml$/;
const OPTIONS_PATTERN = /^\d+_options_.*\.yaml$/;
const CHECKPOINT_PATTERN = /^\d+_checkpoint_.*\.yaml$/;

const violations = [
  ...findFiles(DATA_DIR, LOC_PATTERN).flatMap((filePath) => [
    ...checkFile(filePath, validateLoc).map((msg) => ({ filePath, msg })),
    ...checkStoryline(filePath).map((msg) => ({ filePath, msg })),
  ]),
  ...findFiles(DATA_DIR, FORM_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateForm).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, TEXT_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateText).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, SPLASH_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateSplash).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, OPTIONS_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateOptions).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, CHECKPOINT_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateCheckpoint).map((msg) => ({ filePath, msg })),
  ),
];

violations.forEach(({ filePath, msg }) => {
  const rel = filePath.slice(ROOT.length);
  console.error(`ERROR: ${rel}: ${msg}`);
});

if (violations.length > 0) {
  process.exit(1);
}
```

- [ ] **Step 2: Delete the old script**

Delete `scripts/validate-yaml.js`.

- [ ] **Step 3: Update the npm script**

In `package.json`, change:

```json
"validate:yaml": "node scripts/validate-yaml.js",
```

to:

```json
"validate:yaml": "tsx scripts/validate-yaml.ts",
```

(`tsx` is already a devDependency, used the same way by `backfill-photos`.)

- [ ] **Step 4: Run it against real content**

Run: `npm run validate:yaml`
Expected: exit code 0, no `ERROR:` lines — every existing `*_loc_*.yaml` file's
`storyline` is plain prose today, which `parseStoryline` turns into a single
`prose` block that always passes `validateStoryline` (Task 1's tests already
cover the failure paths directly, so this step is a real-content regression
check, not new coverage).

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors from `scripts/validate-yaml.ts`.

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-yaml.ts package.json
git rm scripts/validate-yaml.js
git commit -m "feat: validate storyline blocks in the YAML CI check"
```

---

### Task 3: `StoryHook` component

**Files:**
- Create: `src/components/StoryHook.svelte`
- Create: `src/components/StoryHook.css`
- Test: `src/test/StoryHook.test.ts`

**Interfaces:**
- Consumes: `StoryBlock` type from `src/types/storyline.ts` (Task 1), prop
  shape `{ block: Extract<StoryBlock, { type: "hook" }> }`.
- Produces: nothing consumed by later tasks (used by `StoryBlockRenderer` in Task 7).

- [ ] **Step 1: Write the failing test**

Create `src/test/StoryHook.test.ts`:

```ts
import { render } from "@testing-library/svelte/svelte5";
import StoryHook from "../components/StoryHook.svelte";
import type { StoryBlock } from "../types/storyline";

test("renders plain text with no accent span when accent is absent", () => {
  const block: Extract<StoryBlock, { type: "hook" }> = { type: "hook", text: "Plain hook line." };
  render(StoryHook, { props: { block } });
  expect(document.querySelector(".story-hook")).toHaveTextContent("Plain hook line.");
  expect(document.querySelector(".story-hook__accent")).not.toBeInTheDocument();
});

test("wraps the accent substring in its own span", () => {
  const block: Extract<StoryBlock, { type: "hook" }> = {
    type: "hook",
    text: "Book bans are not just about books.",
    accent: "just about books",
  };
  render(StoryHook, { props: { block } });
  expect(document.querySelector(".story-hook__accent")).toHaveTextContent("just about books");
  expect(document.querySelector(".story-hook")).toHaveTextContent(
    "Book bans are not just about books.",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/StoryHook.test.ts`
Expected: FAIL — cannot find `../components/StoryHook.svelte`.

- [ ] **Step 3: Write `src/components/StoryHook.svelte`**

```svelte
<script lang="ts">
  import "./StoryHook.css";
  import type { StoryBlock } from "../types/storyline";

  let { block }: { block: Extract<StoryBlock, { type: "hook" }> } = $props();

  function segments(text: string, accent?: string): { text: string; isAccent: boolean }[] {
    if (!accent) {
      return [{ text, isAccent: false }];
    }
    const index = text.indexOf(accent);
    if (index < 0) {
      return [{ text, isAccent: false }];
    }
    return [
      { text: text.slice(0, index), isAccent: false },
      { text: text.slice(index, index + accent.length), isAccent: true },
      { text: text.slice(index + accent.length), isAccent: false },
    ].filter((part) => part.text.length > 0);
  }

  let parts = $derived(segments(block.text, block.accent));
</script>

<p class="story-hook">
  {#each parts as part, idx (idx)}
    {#if part.isAccent}
      <span class="story-hook__accent">{part.text}</span>
    {:else}
      {part.text}
    {/if}
  {/each}
</p>
```

- [ ] **Step 4: Write `src/components/StoryHook.css`**

```css
.story-hook {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  line-height: 1.25;
  color: var(--color-text);
  margin: 0 0 0.75em;
}

.story-hook__accent {
  color: var(--color-accent);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/test/StoryHook.test.ts`
Expected: PASS, both tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/StoryHook.svelte src/components/StoryHook.css src/test/StoryHook.test.ts
git commit -m "feat: add StoryHook block component"
```

---

### Task 4: `StoryStats` component

**Files:**
- Create: `src/components/StoryStats.svelte`
- Create: `src/components/StoryStats.css`
- Test: `src/test/StoryStats.test.ts`

**Interfaces:**
- Consumes: `StoryBlock` type (Task 1), prop `{ block: Extract<StoryBlock, { type: "stats" }> }`.
- Produces: nothing consumed by later tasks (used by `StoryBlockRenderer` in Task 7).

- [ ] **Step 1: Write the failing test**

Create `src/test/StoryStats.test.ts`:

```ts
import { render, screen } from "@testing-library/svelte/svelte5";
import StoryStats from "../components/StoryStats.svelte";
import type { StoryBlock } from "../types/storyline";

test("renders each value/label pair", () => {
  const block: Extract<StoryBlock, { type: "stats" }> = {
    type: "stats",
    items: [
      { value: "6,870", label: "school book bans" },
      { value: "23", label: "states" },
    ],
  };
  render(StoryStats, { props: { block } });
  expect(screen.getByText("6,870")).toBeInTheDocument();
  expect(screen.getByText("school book bans")).toBeInTheDocument();
  expect(screen.getByText("23")).toBeInTheDocument();
  expect(screen.getByText("states")).toBeInTheDocument();
});

test("renders the caption only when present", () => {
  const withCaption: Extract<StoryBlock, { type: "stats" }> = {
    type: "stats",
    items: [{ value: "1", label: "a" }],
    caption: "Recorded by PEN America.",
  };
  render(StoryStats, { props: { block: withCaption } });
  expect(screen.getByText("Recorded by PEN America.")).toBeInTheDocument();
});

test("omits the caption element when absent", () => {
  const block: Extract<StoryBlock, { type: "stats" }> = {
    type: "stats",
    items: [{ value: "1", label: "a" }],
  };
  render(StoryStats, { props: { block } });
  expect(document.querySelector(".story-stats__caption")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/StoryStats.test.ts`
Expected: FAIL — cannot find `../components/StoryStats.svelte`.

- [ ] **Step 3: Write `src/components/StoryStats.svelte`**

```svelte
<script lang="ts">
  import "./StoryStats.css";
  import type { StoryBlock } from "../types/storyline";

  let { block }: { block: Extract<StoryBlock, { type: "stats" }> } = $props();
</script>

<div class="story-stats">
  <div class="story-stats__grid">
    {#each block.items as item, idx (idx)}
      <div class="story-stats__item">
        <div class="story-stats__value">{item.value}</div>
        <div class="story-stats__label">{item.label}</div>
      </div>
    {/each}
  </div>
  {#if block.caption}
    <div class="story-stats__caption">{block.caption}</div>
  {/if}
</div>
```

- [ ] **Step 4: Write `src/components/StoryStats.css`**

```css
.story-stats {
  margin: 0 0 1em;
}

.story-stats__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 12px;
}

.story-stats__item {
  text-align: center;
}

.story-stats__value {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-accent);
}

.story-stats__label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.story-stats__caption {
  margin-top: 8px;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-align: center;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/test/StoryStats.test.ts`
Expected: PASS, all three tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/StoryStats.svelte src/components/StoryStats.css src/test/StoryStats.test.ts
git commit -m "feat: add StoryStats block component"
```

---

### Task 5: `StoryReveal` component

**Files:**
- Create: `src/components/StoryReveal.svelte`
- Create: `src/components/StoryReveal.css`
- Test: `src/test/StoryReveal.test.ts`

**Interfaces:**
- Consumes: `StoryBlock` type (Task 1), prop `{ block: Extract<StoryBlock, { type: "reveal" }> }`.
- Produces: nothing consumed by later tasks (used by `StoryBlockRenderer` in Task 7).

**Design note:** the three covers differ in how the answer is hidden.
`card`/`redaction` swap the button's content between a hint and the answer
on click. `blur` always renders the answer in the DOM but visually blurs it
via CSS until `revealed` is true — chosen so a screen reader (which ignores
CSS blur) still gets the answer text either way, and so the "always in the
DOM" cover has an observably different implementation from the
content-swapping ones rather than being a re-skin of the same behaviour.

- [ ] **Step 1: Write the failing test**

Create `src/test/StoryReveal.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import StoryReveal from "../components/StoryReveal.svelte";
import type { StoryBlock } from "../types/storyline";

test("shows the hint before reveal and the answer after, for a card cover", async () => {
  const block: Extract<StoryBlock, { type: "reveal" }> = {
    type: "reveal",
    prompt: "Guess it",
    answer: "42",
    cover: "card",
    hint: "go on",
  };
  render(StoryReveal, { props: { block } });
  expect(screen.getByTestId("story-reveal-toggle")).toHaveClass("story-reveal__cover--card");
  expect(screen.getByText("go on")).toBeInTheDocument();
  await fireEvent.click(screen.getByTestId("story-reveal-toggle"));
  expect(screen.getByTestId("story-reveal-answer")).toHaveTextContent("42");
});

test("applies the redaction cover class", () => {
  const block: Extract<StoryBlock, { type: "reveal" }> = {
    type: "reveal",
    prompt: "",
    answer: "42",
    cover: "redaction",
  };
  render(StoryReveal, { props: { block } });
  expect(screen.getByTestId("story-reveal-toggle")).toHaveClass("story-reveal__cover--redaction");
});

test("defaults the hint text when none is given", () => {
  const block: Extract<StoryBlock, { type: "reveal" }> = {
    type: "reveal",
    prompt: "",
    answer: "42",
    cover: "card",
  };
  render(StoryReveal, { props: { block } });
  expect(screen.getByText("Tap to reveal")).toBeInTheDocument();
});

test("toggles aria-pressed on click", async () => {
  const block: Extract<StoryBlock, { type: "reveal" }> = {
    type: "reveal",
    prompt: "",
    answer: "42",
    cover: "card",
  };
  render(StoryReveal, { props: { block } });
  const toggle = screen.getByTestId("story-reveal-toggle");
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  await fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-pressed", "true");
});

test("a blur cover always renders the answer text in the DOM", () => {
  const block: Extract<StoryBlock, { type: "reveal" }> = {
    type: "reveal",
    prompt: "",
    answer: "42",
    cover: "blur",
  };
  render(StoryReveal, { props: { block } });
  expect(screen.getByTestId("story-reveal-answer")).toHaveTextContent("42");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/StoryReveal.test.ts`
Expected: FAIL — cannot find `../components/StoryReveal.svelte`.

- [ ] **Step 3: Write `src/components/StoryReveal.svelte`**

```svelte
<script lang="ts">
  import "./StoryReveal.css";
  import type { StoryBlock } from "../types/storyline";

  let { block }: { block: Extract<StoryBlock, { type: "reveal" }> } = $props();

  let revealed = $state(false);

  function toggle(): void {
    revealed = !revealed;
  }
</script>

<div class="story-reveal">
  {#if block.prompt}
    <p class="story-reveal__prompt">{block.prompt}</p>
  {/if}
  <button
    type="button"
    class="story-reveal__cover story-reveal__cover--{block.cover}"
    class:story-reveal__cover--revealed={revealed}
    aria-pressed={revealed}
    data-testid="story-reveal-toggle"
    onclick={toggle}
  >
    {#if block.cover === "blur"}
      <span class="story-reveal__answer" data-testid="story-reveal-answer">{block.answer}</span>
    {:else if revealed}
      <span class="story-reveal__answer" data-testid="story-reveal-answer">{block.answer}</span>
    {:else}
      <span class="story-reveal__hint">{block.hint ?? "Tap to reveal"}</span>
    {/if}
  </button>
</div>
```

- [ ] **Step 4: Write `src/components/StoryReveal.css`**

```css
.story-reveal {
  margin: 0 0 1em;
}

.story-reveal__prompt {
  font-size: var(--font-size-base);
  color: var(--color-text);
  margin: 0 0 0.5em;
}

.story-reveal__cover {
  display: block;
  width: 100%;
  padding: 14px 16px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  cursor: pointer;
  text-align: left;
}

.story-reveal__cover--redaction {
  background: var(--color-text);
  color: var(--color-background);
}

.story-reveal__cover--redaction .story-reveal__answer {
  color: var(--color-background);
}

.story-reveal__cover--blur .story-reveal__answer {
  filter: blur(6px);
}

.story-reveal__cover--blur.story-reveal__cover--revealed .story-reveal__answer {
  filter: blur(0);
}

.story-reveal__answer {
  color: var(--color-accent);
  font-weight: 700;
}

@media (prefers-reduced-motion: no-preference) {
  .story-reveal__cover--blur .story-reveal__answer {
    transition: filter 0.2s ease;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/test/StoryReveal.test.ts`
Expected: PASS, all six tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/StoryReveal.svelte src/components/StoryReveal.css src/test/StoryReveal.test.ts
git commit -m "feat: add StoryReveal block component"
```

---

### Task 6: `StoryCallout` component

**Files:**
- Create: `src/components/StoryCallout.svelte`
- Create: `src/components/StoryCallout.css`
- Test: `src/test/StoryCallout.test.ts`

**Interfaces:**
- Consumes: `StoryBlock` type (Task 1); `MarkdownText.svelte` (existing,
  `src/components/MarkdownText.svelte`, prop `{ text: string }`).
- Produces: nothing consumed by later tasks (used by `StoryBlockRenderer` in Task 7).

- [ ] **Step 1: Write the failing test**

Create `src/test/StoryCallout.test.ts`:

```ts
import { render, screen } from "@testing-library/svelte/svelte5";
import StoryCallout from "../components/StoryCallout.svelte";
import type { StoryBlock } from "../types/storyline";

test("renders the label and the markdown body", () => {
  const block: Extract<StoryBlock, { type: "callout" }> = {
    type: "callout",
    markdown: "Find it.",
    label: "Your job",
    tone: "task",
  };
  render(StoryCallout, { props: { block } });
  expect(screen.getByText("Your job")).toBeInTheDocument();
  expect(screen.getByText("Find it.")).toBeInTheDocument();
});

test("omits the label element when absent", () => {
  const block: Extract<StoryBlock, { type: "callout" }> = {
    type: "callout",
    markdown: "A quote.",
    tone: "quote",
  };
  render(StoryCallout, { props: { block } });
  expect(document.querySelector(".story-callout__label")).not.toBeInTheDocument();
});

test("applies the tone as a modifier class", () => {
  const block: Extract<StoryBlock, { type: "callout" }> = {
    type: "callout",
    markdown: "A quote.",
    tone: "quote",
  };
  render(StoryCallout, { props: { block } });
  expect(document.querySelector(".story-callout--quote")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/StoryCallout.test.ts`
Expected: FAIL — cannot find `../components/StoryCallout.svelte`.

- [ ] **Step 3: Write `src/components/StoryCallout.svelte`**

```svelte
<script lang="ts">
  import "./StoryCallout.css";
  import MarkdownText from "./MarkdownText.svelte";
  import type { StoryBlock } from "../types/storyline";

  let { block }: { block: Extract<StoryBlock, { type: "callout" }> } = $props();
</script>

<div class="story-callout story-callout--{block.tone}">
  {#if block.label}
    <div class="story-callout__label">{block.label}</div>
  {/if}
  <MarkdownText text={block.markdown} />
</div>
```

- [ ] **Step 4: Write `src/components/StoryCallout.css`**

```css
.story-callout {
  padding: 14px 16px;
  border-radius: 6px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  margin: 0 0 1em;
}

.story-callout--task {
  border-color: var(--color-accent);
}

.story-callout--quote {
  font-style: italic;
}

.story-callout__label {
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-accent);
  margin-bottom: 6px;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/test/StoryCallout.test.ts`
Expected: PASS, all three tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/StoryCallout.svelte src/components/StoryCallout.css src/test/StoryCallout.test.ts
git commit -m "feat: add StoryCallout block component"
```

---

### Task 7: `StoryBlockRenderer` dispatcher and `StoryFold`

These two components are mutually recursive (`StoryBlockRenderer` renders a
`detail` block via `StoryFold`; `StoryFold`, once open, renders its inner
blocks by recursing back through `StoryBlockRenderer`), so neither is
independently testable — they ship as one task.

**Files:**
- Create: `src/components/StoryBlockRenderer.svelte`
- Create: `src/components/StoryFold.svelte`
- Create: `src/components/StoryFold.css`
- Test: `src/test/StoryBlockRenderer.test.ts`
- Test: `src/test/StoryFold.test.ts`

**Interfaces:**
- Consumes: `StoryBlock` type (Task 1); `MarkdownText.svelte` (existing);
  `StoryHook.svelte` (Task 3, prop `{ block }`); `StoryStats.svelte`
  (Task 4, prop `{ block }`); `StoryReveal.svelte` (Task 5, prop `{ block }`);
  `StoryCallout.svelte` (Task 6, prop `{ block }`).
- Produces: `StoryBlockRenderer.svelte` — prop `{ block: StoryBlock }`, no
  wrapping element (renders exactly one child per block). Consumed by
  `Storyline.svelte` in Task 8, and by `StoryFold.svelte` itself for recursion.

- [ ] **Step 1: Write the failing tests**

Create `src/test/StoryBlockRenderer.test.ts`:

```ts
import { render, screen } from "@testing-library/svelte/svelte5";
import StoryBlockRenderer from "../components/StoryBlockRenderer.svelte";
import type { StoryBlock } from "../types/storyline";

test("dispatches a prose block through MarkdownText", () => {
  const block: StoryBlock = { type: "prose", markdown: "Hello there." };
  render(StoryBlockRenderer, { props: { block } });
  expect(screen.getByText("Hello there.")).toBeInTheDocument();
});

test("dispatches a hook block", () => {
  const block: StoryBlock = { type: "hook", text: "Just a hook." };
  render(StoryBlockRenderer, { props: { block } });
  expect(document.querySelector(".story-hook")).toHaveTextContent("Just a hook.");
});

test("dispatches a stats block", () => {
  const block: StoryBlock = { type: "stats", items: [{ value: "1", label: "one" }] };
  render(StoryBlockRenderer, { props: { block } });
  expect(document.querySelector(".story-stats")).toBeInTheDocument();
});

test("dispatches a reveal block", () => {
  const block: StoryBlock = { type: "reveal", prompt: "", answer: "1", cover: "card" };
  render(StoryBlockRenderer, { props: { block } });
  expect(screen.getByTestId("story-reveal-toggle")).toBeInTheDocument();
});

test("dispatches a callout block", () => {
  const block: StoryBlock = { type: "callout", markdown: "Do it.", tone: "default" };
  render(StoryBlockRenderer, { props: { block } });
  expect(document.querySelector(".story-callout")).toBeInTheDocument();
});

test("dispatches a detail block through StoryFold", () => {
  const block: StoryBlock = { type: "detail", blocks: [{ type: "prose", markdown: "Extra." }] };
  render(StoryBlockRenderer, { props: { block } });
  expect(screen.getByTestId("story-fold-toggle")).toBeInTheDocument();
});
```

Create `src/test/StoryFold.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import StoryFold from "../components/StoryFold.svelte";
import type { StoryBlock } from "../types/storyline";

test("hides inner blocks until toggled open", async () => {
  const block: Extract<StoryBlock, { type: "detail" }> = {
    type: "detail",
    blocks: [{ type: "prose", markdown: "Hidden text." }],
  };
  render(StoryFold, { props: { block } });
  expect(screen.queryByText("Hidden text.")).not.toBeInTheDocument();
  const toggle = screen.getByTestId("story-fold-toggle");
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  await fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Hidden text.")).toBeInTheDocument();
});

test("recurses through nested block kinds when opened", async () => {
  const block: Extract<StoryBlock, { type: "detail" }> = {
    type: "detail",
    blocks: [{ type: "callout", markdown: "Do this.", tone: "task", label: "Task" }],
  };
  render(StoryFold, { props: { block } });
  await fireEvent.click(screen.getByTestId("story-fold-toggle"));
  expect(screen.getByText("Task")).toBeInTheDocument();
  expect(screen.getByText("Do this.")).toBeInTheDocument();
});

test("toggle label switches between open and closed states", async () => {
  const block: Extract<StoryBlock, { type: "detail" }> = { type: "detail", blocks: [] };
  render(StoryFold, { props: { block } });
  const toggle = screen.getByTestId("story-fold-toggle");
  expect(toggle).toHaveTextContent("Read the full story");
  await fireEvent.click(toggle);
  expect(toggle).toHaveTextContent("Show less");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/StoryBlockRenderer.test.ts src/test/StoryFold.test.ts`
Expected: FAIL — neither component exists yet.

- [ ] **Step 3: Write `src/components/StoryBlockRenderer.svelte`**

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

- [ ] **Step 4: Write `src/components/StoryFold.svelte`**

```svelte
<script lang="ts">
  import "./StoryFold.css";
  import type { StoryBlock } from "../types/storyline";
  import StoryBlockRenderer from "./StoryBlockRenderer.svelte";

  let { block }: { block: Extract<StoryBlock, { type: "detail" }> } = $props();

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
    {open ? "Show less" : "Read the full story"}
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

- [ ] **Step 5: Write `src/components/StoryFold.css`**

```css
.story-fold {
  margin: 0.5em 0;
}

.story-fold__toggle {
  display: inline-flex;
  align-items: center;
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--color-accent);
  background: transparent;
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
}

.story-fold__body {
  margin-top: 12px;
}

@media (prefers-reduced-motion: no-preference) {
  .story-fold__body {
    animation: story-fold-open 0.2s ease;
  }
}

@keyframes story-fold-open {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/test/StoryBlockRenderer.test.ts src/test/StoryFold.test.ts`
Expected: PASS, all nine tests. (The circular import between
`StoryBlockRenderer.svelte` and `StoryFold.svelte` is expected to resolve
fine under Vite/Vitest's ESM handling — this step is what confirms it does;
if it doesn't, the fix is to inline `StoryFold`'s toggle-button markup
directly and only import `StoryBlockRenderer` inside it, never the reverse,
losing nothing since `StoryBlockRenderer`'s `detail` branch would then be
the only caller of `StoryFold` anyway.)

- [ ] **Step 7: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/StoryBlockRenderer.svelte src/components/StoryFold.svelte \
  src/components/StoryFold.css src/test/StoryBlockRenderer.test.ts src/test/StoryFold.test.ts
git commit -m "feat: add StoryBlockRenderer dispatcher and StoryFold"
```

---

### Task 8: `Storyline` component and `ChallengeCard` wiring

**Files:**
- Create: `src/components/Storyline.svelte`
- Create: `src/components/Storyline.css`
- Modify: `src/components/ChallengeCard.svelte:6` (add import), `:129` (swap component)
- Test: `src/test/Storyline.test.ts`
- Test: `src/test/ChallengeCard.test.ts` (add one case)

**Interfaces:**
- Consumes: `parseStoryline`, `validateStoryline` (Task 1);
  `StoryBlockRenderer.svelte` (Task 7, prop `{ block }`).
- Produces: `Storyline.svelte` — prop `{ text?: string }`. This is the only
  new symbol later code needs, and `ChallengeCard.svelte` is the only consumer.

- [ ] **Step 1: Write the failing tests**

Create `src/test/Storyline.test.ts`:

```ts
import { render, screen } from "@testing-library/svelte/svelte5";
import Storyline from "../components/Storyline.svelte";

test("renders a hook directive with its accent span", () => {
  render(Storyline, {
    props: { text: ':::hook{accent="books"}\nBans are not about books.\n:::' },
  });
  expect(document.querySelector(".story-hook__accent")).toHaveTextContent("books");
});

test("falls back to plain prose when there are no directives", () => {
  render(Storyline, { props: { text: "Just a normal paragraph." } });
  expect(screen.getByText("Just a normal paragraph.")).toBeInTheDocument();
});

test("renders nothing when text is empty", () => {
  const { container } = render(Storyline, { props: { text: "" } });
  expect(container.querySelector(".storyline-root")).not.toBeInTheDocument();
});

test("renders nothing when text is undefined", () => {
  const { container } = render(Storyline, { props: {} });
  expect(container.querySelector(".storyline-root")).not.toBeInTheDocument();
});
```

Add to `src/test/ChallengeCard.test.ts` (after the existing `test("hides breadcrumb...")` block):

```ts
test("renders storyline directives through Storyline blocks", () => {
  const withHook = {
    ...location,
    storyline: ':::hook{accent="historic"}\nA historic place.\n:::',
  };
  render(ChallengeCard, { props: { location: withHook } });
  expect(document.querySelector(".story-hook__accent")).toHaveTextContent("historic");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/Storyline.test.ts src/test/ChallengeCard.test.ts`
Expected: `Storyline.test.ts` fails (component doesn't exist); the new
`ChallengeCard.test.ts` case fails (`ChallengeCard` still renders the raw
directive text as literal prose via `MarkdownText`, so `.story-hook__accent`
isn't found); the pre-existing `ChallengeCard.test.ts` cases still pass.

- [ ] **Step 3: Write `src/components/Storyline.svelte`**

```svelte
<script lang="ts">
  import "./Storyline.css";
  import { parseStoryline, validateStoryline } from "../utils/storylineBlocks";
  import StoryBlockRenderer from "./StoryBlockRenderer.svelte";

  let { text }: { text?: string } = $props();

  let blocks = $derived(text ? parseStoryline(text) : []);

  $effect(() => {
    if (import.meta.env.DEV) {
      for (const warning of validateStoryline(blocks)) {
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

- [ ] **Step 4: Write `src/components/Storyline.css`**

```css
.storyline-root {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
```

- [ ] **Step 5: Wire it into `ChallengeCard.svelte`**

In `src/components/ChallengeCard.svelte`, add the import next to the
existing `MarkdownText` import (line 6):

```ts
import MarkdownText from "./MarkdownText.svelte";
import Storyline from "./Storyline.svelte";
```

Then replace line 129:

```svelte
<MarkdownText text={location.storyline} />
```

with:

```svelte
<Storyline text={location.storyline} />
```

Leave the `MarkdownText` import and its other call site (line 150,
`location.challenge.description`) unchanged.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/test/Storyline.test.ts src/test/ChallengeCard.test.ts`
Expected: PASS, all `Storyline.test.ts` cases and all `ChallengeCard.test.ts`
cases including the new one.

- [ ] **Step 7: Run the full test suite, lint, and typecheck**

Run: `npm run test:run && npm run lint && npm run typecheck`
Expected: all green — this is the point where a regression in
`TextScreen.svelte` (which must be untouched) or anywhere else would surface.

- [ ] **Step 8: Manual smoke test — zero-directive regression**

Run: `npm run dev`, open a Den Haag location page (e.g. the Binnenhof), and
confirm the storyline still renders identically to before (plain prose, no
visual change) — this location's `storyline` has no directives yet, so this
step confirms the zero-directive fallback path end to end in the real app,
not just under jsdom.

- [ ] **Step 9: Commit**

```bash
git add src/components/Storyline.svelte src/components/Storyline.css \
  src/components/ChallengeCard.svelte src/test/Storyline.test.ts src/test/ChallengeCard.test.ts
git commit -m "feat: render location storylines through Storyline blocks"
```

---

### Task 9: Stakeholder preview location

A permanent, blocks-authored sibling of `001_loc_right_to_read.yaml` — not a
temporary edit — so the Democrats Abroad / GWC stakeholder can walk both
versions back-to-back in the live route and see the difference directly,
without disturbing the original stop. Content is the same facts already in
`001_loc_right_to_read.yaml` (PEN America's 6,870/23/87 figures, the ALA
paragraph, the same task and form), reorganized into the six-block
vocabulary — no new claims introduced.

**Files:**
- Create: `src/data/text/en/projects/democrats_abroad/den_haag/012_loc_right_to_read_blocks.yaml`
- Modify: `src/data/text/en/projects/democrats_abroad/den_haag/routes.yaml`
  (insert into `short_loop.locations`, immediately after `001_loc_right_to_read`)

**Interfaces:**
- Consumes: `Storyline.svelte` (Task 8) via the normal `ChallengeCard` →
  `location.storyline` path — no code changes, this task is content-only.
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Write `012_loc_right_to_read_blocks.yaml`**

```yaml
title: "The Right to Read — Blocks Preview"
image: alireza-parpaei-den-haag-binnenhof-unsplash.jpg
name:
  label: ""
  value: "The American Book Center / Paagman"
address: "Lange Poten 23, The Hague"
coordinates:
  longitude: 4.3148478
  latitude: 52.0786591
storyline: |
  :::hook{accent="just about books"}
  Book bans are not just about books.
  :::

  They are about who gets to be seen, whose stories are considered dangerous, and what ideas young people are allowed to encounter. In the United States, attempts to ban, challenge, restrict, or remove books from schools and libraries have increased sharply in recent years.

  :::reveal{answer="6,870" cover="redaction" hint="in the 2024–2025 school year"}
  Before you look at the numbers — guess how many school book bans were recorded in a single US school year.
  :::

  :::stats{caption="Recorded by PEN America, 2024–2025 school year."}
  - 6,870 | school book bans
  - 23 | states
  - 87 | public school districts
  :::

  :::callout{label="Your job" tone="task"}
  Find one of those books in the wild: not in a banned-book display, not in a government hearing, but sitting openly on a shelf in The Hague.
  :::

  What someone tried to remove from public life is still here.

  :::detail
  The American Library Association also tracks censorship attempts in libraries and schools and reported that thousands of unique titles have been targeted, with many challenges focusing on books involving LGBTQ+ people, people of color, sexuality, racism, gender, violence, or honest accounts of history.

  That pattern is the point of this stop. A book does not have to be illegal everywhere to be part of a censorship campaign. It may have been removed from a school library, restricted to certain students, challenged by a parent group, pulled during review, or banned under a state or district policy.
  :::

challenge:
  name: ""
  description: |
    Inside The American Book Center or Paagman, find a book that has been banned, challenged, restricted, or removed somewhere in the United States. You may use Google or other sources to verify the book while you search.
  notes: ""
  form: "001_form_abc.yaml"
breadcrumb: |
  You have found one idea someone tried to remove from public life — twice, in two different ways of telling it. Now walk toward the Vredespaleis.
```

`012_` (not `002_`) is deliberate: file-prefix numbers in this directory are
not load-bearing for ordering — `short_loop.locations` in `routes.yaml` is
the explicit, authoritative order — so `012` just avoids colliding with or
renumbering any existing file. `challenge.form` reuses `001_form_abc.yaml`
as-is: same physical stop, same task, same form fields — only the storyline
presentation differs, so a second form file would just duplicate it.

- [ ] **Step 2: Insert it into the route**

In `src/data/text/en/projects/democrats_abroad/den_haag/routes.yaml`,
change:

```yaml
    - 001_loc_right_to_read
    - 002_loc_vredespaleis
```

to:

```yaml
    - 001_loc_right_to_read
    - 012_loc_right_to_read_blocks
    - 002_loc_vredespaleis
```

- [ ] **Step 3: Validate**

Run: `npm run validate:yaml`
Expected: exit code 0, no `ERROR:` lines. This also exercises Task 2's new
`checkStoryline` pass against real directive-authored content for the first
time — if it fails here, the fix belongs in Task 1/2's code, not in this
file (this task's job is authoring valid content against an already-tested
parser/validator).

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open the Den Haag `short_loop` route, and confirm
`001_loc_right_to_read` and `012_loc_right_to_read_blocks` now appear
back-to-back: the second stop's hook line renders large with "just about
books" highlighted, the reveal cover works when tapped (revealing 6,870),
the stats grid shows the three PEN America figures, the callout renders as
a task card, and "Read the full story" expands the ALA paragraph and the
"that pattern is the point" paragraph. Confirm the challenge form still
works (it's the same form as the original stop).

- [ ] **Step 5: Commit**

```bash
git add src/data/text/en/projects/democrats_abroad/den_haag/012_loc_right_to_read_blocks.yaml \
  src/data/text/en/projects/democrats_abroad/den_haag/routes.yaml
git commit -m "content: add blocks-authored preview of the Right to Read stop"
```

---

## What this plan does not cover

Re-authoring any *other* existing `*_loc_*.yaml` content with
`:::hook`/`:::stats`/`:::detail`/`:::reveal`/`:::callout` — Task 9 covers
one worked example (`001_loc_right_to_read`, added as a preview sibling
rather than an in-place rewrite, per stakeholder-review needs). The rest of
the design doc's phased migration (phases 3-5: hooks/stats/reveals across
the remaining Den Haag, Oslo, Paris, and New York locations) is deliberately
content-only, one location at a time, separate from shipping the rendering
pipeline itself. Once the stakeholder has reviewed the preview, next steps
are (a) deciding whether to replace `001_loc_right_to_read.yaml` in place or
keep both, and (b) removing the preview stop from the route once it's no
longer needed for review.
