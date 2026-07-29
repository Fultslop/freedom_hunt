# Completion Screen — Data-Driven Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `CompletionScreen`'s hardcoded secondary button and its `registration`
prop with a single authored `buttons: WideButtonConfig[]` list, rendered through a new
generic, reusable `WideButton` component — so every action on the completion screen (not
just the primary CTA) is data-driven from YAML.

**Architecture:** A new shared building block (`WideButtonConfig` type + `WideButton.svelte`
component) generalizes the existing `cmpl-btn-primary`/`cmpl-btn-secondary` styles into a
`wide-btn`/`wide-btn--primary`/`wide-btn--secondary` component usable beyond completion
later. `OptionTarget`'s `page` union gains a `"results"` value, resolved through a new
shared helper (`resolvePageUrl`) extracted from `OptionsScreen.svelte`'s existing
`handlePageSelect` — the same URL-building logic, now with one caller instead of a
duplicate. `CompletionEntry`'s `registration` field is removed; `completion.schema.json`
requires `buttons` (≥1 item) instead.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + `@testing-library/svelte/svelte5`,
`ajv` (JSON Schema).

**Spec:** `doc/superpowers/specs/2026-07-29-completion-wide-buttons-design.md` — read this
first for the full rationale behind every decision below.

## Global Constraints

- TypeScript only — `.svelte` (`<script lang="ts">`) and `.ts`. No `.js`/`.jsx`/`.tsx` in
  `src/`.
- Styling via co-located `.css` files imported at the top of each `.svelte` file; BEM-like
  class names (`component-name__element--modifier`); colours via `var(--color-*)`; no
  Tailwind, no CSS modules.
- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`) — never Svelte 4 `$:`.
- No abstractions for one-off things — but `resolvePageUrl` is a real second-caller
  extraction (`OptionsScreen` and the new `WideButton`), not speculative reuse.
- Never use Playwright or any browser automation to verify a change — this project's
  `CLAUDE.md` reserves manual verification for the user. Automated verification here is
  Vitest, `npm run typecheck`, `npm run lint`, and `npm run validate:yaml` only.
- **Do not invoke git commands.** This repository's `CLAUDE.md` states the user controls
  git exclusively. Every task ends with a "stage for review" step that lists the changed
  files — it never runs `git add`/`git commit`. Committing is the user's call.
- Test commands: `npm run test:run -- <path>` (single file), `npm run test:run` (whole
  suite), `npm run typecheck`, `npm run lint`, `npm run validate:yaml`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/optionTargets.ts` (new) | `resolvePageUrl(value, ctx)` — the shared page-value → URL resolver |
| `src/types/data.ts` | `OptionTarget` gains `"results"`; new `WideButtonTarget`/`WideButtonConfig`; `CompletionEntry.buttons` replaces `registration` |
| `src/components/OptionsScreen.svelte` | `handlePageSelect` delegates to `resolvePageUrl` |
| `src/types/theme.ts` | `Theme.defaultButtonColor` |
| `src/theme/themes.ts` | `defaultButtonColor: "primary"` on all three presets |
| `src/components/WideButton.svelte` (+ `.css`, new) | Shared full-width button: link or page target, primary/secondary styling |
| `src/data/schemas/completion.schema.json` | `registration` removed, `buttons` (≥1 item) required |
| `src/components/CompletionScreen.svelte` (+ `.css`) | `registration` prop removed, `buttons` prop added, renders a `WideButton` per entry; old button CSS deleted |
| `src/components/RouteScreen.svelte` | Completion dispatch passes `buttons` instead of `registration` |
| `src/data/text/en/projects/democrats_abroad/den_haag/009_completion_den_haag.yaml` | Content migrated to `buttons:` |

---

### Task 1: Shared `resolvePageUrl` helper + `OptionTarget` gains `"results"`

**Files:**
- Modify: `src/types/data.ts` (the `OptionTarget` type, currently lines 183-185)
- Create: `src/utils/optionTargets.ts`
- Test: `src/test/optionTargets.test.ts` (new)

**Interfaces:**
- Produces: `resolvePageUrl(value: "title" | "project" | "start_route" | "gallery" |
  "results", ctx: { project: string; city: string; route?: string }): string`.
- Produces: `OptionTarget` page values now include `"results"`.

- [ ] **Step 1: Write the failing tests**

Create `src/test/optionTargets.test.ts`:

```ts
import { resolvePageUrl } from "../utils/optionTargets";

test("resolves 'title' to the city page", () => {
  expect(resolvePageUrl("title", { project: "demo", city: "new_york" })).toBe(
    "/demo/new_york",
  );
});

test("resolves 'project' to the project page", () => {
  expect(resolvePageUrl("project", { project: "demo", city: "new_york" })).toBe("/demo");
});

test("resolves 'gallery' to the gallery page", () => {
  expect(resolvePageUrl("gallery", { project: "demo", city: "new_york" })).toBe(
    "/demo/new_york/gallery",
  );
});

test("resolves 'results' to the results-download page", () => {
  expect(resolvePageUrl("results", { project: "demo", city: "new_york" })).toBe(
    "/demo/new_york/results_download",
  );
});

test("resolves 'start_route' to the route page using ctx.route", () => {
  expect(
    resolvePageUrl("start_route", {
      project: "demo",
      city: "new_york",
      route: "brooklyn_route",
    }),
  ).toBe("/demo/new_york/brooklyn_route");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/optionTargets.test.ts`
Expected: FAIL — `src/utils/optionTargets.ts` does not exist yet.

- [ ] **Step 3: Create `src/utils/optionTargets.ts`**

```ts
export function resolvePageUrl(
  value: "title" | "project" | "start_route" | "gallery" | "results",
  ctx: { project: string; city: string; route?: string },
): string {
  switch (value) {
    case "title":
      return `/${ctx.project}/${ctx.city}`;
    case "project":
      return `/${ctx.project}`;
    case "gallery":
      return `/${ctx.project}/${ctx.city}/gallery`;
    case "results":
      return `/${ctx.project}/${ctx.city}/results_download`;
    case "start_route":
      return `/${ctx.project}/${ctx.city}/${ctx.route}`;
  }
}
```

- [ ] **Step 4: Add `"results"` to `OptionTarget`'s page union**

In `src/types/data.ts`, change:

```ts
export type OptionTarget =
  | { type: "link"; value: string }
  | { type: "page"; value: "title" | "project" | "start_route" | "gallery" | "continue" };
```

to:

```ts
export type OptionTarget =
  | { type: "link"; value: string }
  | {
      type: "page";
      value: "title" | "project" | "start_route" | "gallery" | "continue" | "results";
    };
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:run -- src/test/optionTargets.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 6: Stage for review**

List changed files (`src/utils/optionTargets.ts`, `src/types/data.ts`,
`src/test/optionTargets.test.ts`) for the user. Do not run `git add`/`git commit`.

---

### Task 2: `OptionsScreen.svelte` delegates to `resolvePageUrl`

**Files:**
- Modify: `src/components/OptionsScreen.svelte:51-64`
- Test: `src/test/OptionsScreen.test.ts` (existing suite — no new tests, regression check
  only)

**Interfaces:**
- Consumes: `resolvePageUrl` from Task 1 (`src/utils/optionTargets.ts`).

- [ ] **Step 1: Run the existing suite to confirm the current baseline passes**

Run: `npm run test:run -- src/test/OptionsScreen.test.ts`
Expected: PASS (11 tests) — this is the regression baseline this task must not break.

- [ ] **Step 2: Replace `handlePageSelect`'s body with a call to `resolvePageUrl`**

In `src/components/OptionsScreen.svelte`, add the import at the top of the `<script>`
block (after the existing `import { postFormSubmit } from "../utils/api";`):

```ts
import { resolvePageUrl } from "../utils/optionTargets";
```

Change:

```ts
  function handlePageSelect(value: "title" | "project" | "start_route" | "gallery" | "continue") {
    if (value === "title") {
      push(`/${project}/${city}`);
    } else if (value === "project") {
      push(`/${project}`);
    } else if (value === "gallery") {
      push(`/${project}/${city}/gallery`);
    } else if (value === "continue") {
      onContinue?.();
    } else {
      localStorage.removeItem(`${project}/${city}/${route}`);
      push(`/${project}/${city}/${route}`);
    }
  }
```

to:

```ts
  function handlePageSelect(value: "title" | "project" | "start_route" | "gallery" | "continue") {
    if (value === "continue") {
      onContinue?.();
      return;
    }
    if (value === "start_route") {
      localStorage.removeItem(`${project}/${city}/${route}`);
    }
    push(resolvePageUrl(value, { project, city, route }));
  }
```

- [ ] **Step 3: Run tests to verify the behavior is unchanged**

Run: `npm run test:run -- src/test/OptionsScreen.test.ts`
Expected: PASS (all 11 tests, unchanged — this confirms the refactor is behavior-preserving).

- [ ] **Step 4: Stage for review**

List changed files (`src/components/OptionsScreen.svelte`) for the user. Do not run
`git add`/`git commit`.

---

### Task 3: `Theme.defaultButtonColor`, `WideButtonConfig` type, and `WideButton.svelte`

**Files:**
- Modify: `src/types/theme.ts`
- Modify: `src/theme/themes.ts`
- Modify: `src/types/data.ts` (add `WideButtonTarget`/`WideButtonConfig` near `OptionTarget`)
- Create: `src/components/WideButton.svelte`
- Create: `src/components/WideButton.css`
- Test: `src/test/WideButton.test.ts` (new)

**Interfaces:**
- Consumes: `resolvePageUrl` from Task 1; `themeStore` (`src/stores/themeStore.ts`,
  unchanged).
- Produces: `WideButtonTarget`, `WideButtonConfig` (`src/types/data.ts`); `WideButton`
  component with props `{ text: string; target: WideButtonTarget; color?: "primary" |
  "secondary"; project: string; cityId: string }`.

- [ ] **Step 1: Write the failing tests**

Create `src/test/WideButton.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import WideButton from "../components/WideButton.svelte";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("svelte-spa-router", () => ({ push: pushMock }));

beforeEach(() => {
  pushMock.mockClear();
});

test("renders a link target as a real external anchor, primary by default", () => {
  render(WideButton, {
    props: {
      text: "Check your voter registration",
      target: { type: "link", value: "https://example.org" },
      project: "demo",
      cityId: "new_york",
    },
  });
  const link = screen.getByRole("link", { name: "Check your voter registration" });
  expect(link).toHaveAttribute("href", "https://example.org");
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveClass("wide-btn--primary");
});

test("renders a page target as a button that navigates via resolvePageUrl", async () => {
  render(WideButton, {
    props: {
      text: "See your results",
      target: { type: "page", value: "results" },
      project: "demo",
      cityId: "new_york",
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: "See your results" }));
  expect(pushMock).toHaveBeenCalledWith("/demo/new_york/results_download");
});

test("applies an explicit color, overriding the theme default", () => {
  render(WideButton, {
    props: {
      text: "Secondary",
      target: { type: "page", value: "gallery" },
      color: "secondary",
      project: "demo",
      cityId: "new_york",
    },
  });
  expect(screen.getByRole("button", { name: "Secondary" })).toHaveClass("wide-btn--secondary");
});

test("falls back to the theme's defaultButtonColor when color is omitted", () => {
  render(WideButton, {
    props: {
      text: "Default",
      target: { type: "page", value: "title" },
      project: "demo",
      cityId: "new_york",
    },
  });
  // DEFAULT_THEME ("app") sets defaultButtonColor: "primary" — see src/theme/themes.ts
  expect(screen.getByRole("button", { name: "Default" })).toHaveClass("wide-btn--primary");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/WideButton.test.ts`
Expected: FAIL — `src/components/WideButton.svelte` does not exist yet.

- [ ] **Step 3: Add `defaultButtonColor` to `Theme`**

In `src/types/theme.ts`, add a field to the `Theme` interface (after `accent: string;`):

```ts
export interface Theme {
  fontFamily: string;
  background: string;
  surface: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  defaultButtonColor: "primary" | "secondary";
  barBackground: string;
  barBorder: string;
  barText: string;
  barTextSecondary: string;
  progressTrack: string;
  progressFill: string;
  clueBackground: string;
  clueBorderColor: string;
  swipe: SwipeConfig;
}
```

- [ ] **Step 4: Set `defaultButtonColor: "primary"` on all three theme presets**

In `src/theme/themes.ts`, add `defaultButtonColor: "primary",` immediately after each
theme's `accent` line — `wireframe` (after `accent: "#555555",`), `app` (after
`accent: "#f59e0b",`), and `GWC` (after `accent: "#BF0A30",`).

- [ ] **Step 5: Add `WideButtonTarget` and `WideButtonConfig` to `src/types/data.ts`**

Add near `OptionTarget` (after it):

```ts
export type WideButtonTarget =
  | { type: "link"; value: string }
  | { type: "page"; value: "title" | "project" | "gallery" | "results" };

export interface WideButtonConfig {
  text: string;
  target: WideButtonTarget;
  color?: "primary" | "secondary";
}
```

`WideButtonTarget` is a narrower union than `OptionTarget` — it excludes `"start_route"`
and `"continue"`, neither of which has a sensible action inside `WideButton` (no
`onContinue` callback exists at this level, and restarting the route isn't a completion-
screen action). `resolvePageUrl`'s parameter type accepts the wider union, so
`WideButtonTarget`'s page values are always assignable to it.

- [ ] **Step 6: Create `src/components/WideButton.svelte`**

```svelte
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { themeStore } from "../stores/themeStore";
  import { resolvePageUrl } from "../utils/optionTargets";
  import type { WideButtonTarget } from "../types/data";
  import "./WideButton.css";

  let {
    text,
    target,
    color = undefined,
    project,
    cityId,
  }: {
    text: string;
    target: WideButtonTarget;
    color?: "primary" | "secondary";
    project: string;
    cityId: string;
  } = $props();

  let resolvedColor = $derived(color ?? $themeStore.theme.defaultButtonColor);
</script>

{#if target.type === "link"}
  <a
    class="wide-btn wide-btn--{resolvedColor}"
    href={target.value}
    target="_blank"
    rel="noopener noreferrer"
  >
    {text}
  </a>
{:else}
  <button
    type="button"
    class="wide-btn wide-btn--{resolvedColor}"
    onclick={() => push(resolvePageUrl(target.value, { project, city: cityId }))}
  >
    {text}
  </button>
{/if}
```

- [ ] **Step 7: Create `src/components/WideButton.css`**

Values lifted verbatim from today's `.cmpl-btn-primary`/`.cmpl-btn-secondary`
(`src/components/CompletionScreen.css:125-154`) — visual output is unchanged, only the
class names move:

```css
/* src/components/WideButton.css */

.wide-btn {
  display: block;
  width: 100%;
  border: none;
  font-size: var(--font-size-base);
  padding: 15px 18px;
  border-radius: 10px;
  text-align: center;
  box-sizing: border-box;
  text-decoration: none;
  cursor: pointer;
}

.wide-btn--primary {
  background: var(--color-accent);
  color: #000;
  font-weight: 800;
}

.wide-btn--secondary {
  background: var(--color-background);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  font-weight: 700;
  padding: 13px 18px;
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run test:run -- src/test/WideButton.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 9: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — no type errors from the new `Theme` field or `WideButtonConfig`/
`WideButtonTarget` types.

- [ ] **Step 10: Stage for review**

List changed files (`src/types/theme.ts`, `src/theme/themes.ts`, `src/types/data.ts`,
`src/components/WideButton.svelte`, `src/components/WideButton.css`,
`src/test/WideButton.test.ts`) for the user. Do not run `git add`/`git commit`.

---

### Task 4: `completion.schema.json` requires `buttons`, not `registration`

**Files:**
- Modify: `src/data/schemas/completion.schema.json`
- Modify: `src/types/data.ts:234-245` (`CompletionEntry`, currently has a `registration`
  field)
- Test: `src/test/completionSchema.test.ts`

**Interfaces:**
- Consumes: `WideButtonConfig` from Task 3.
- Produces: `CompletionEntry.buttons: WideButtonConfig[]` (replaces `registration`).

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/test/completionSchema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";

const schemaPath = join(__dirname, "..", "data", "schemas", "completion.schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const validDoc = {
  "template-type": "completion",
  image: "lange-vijverberg.jpg",
  title: "You made it.",
  subtitle: "Democrats Abroad 2026 Scavenger Hunt",
  place: "The Hague · short loop",
  buttons: [
    {
      text: "Check your voter registration",
      target: { type: "link", value: "https://www.democratsabroad.org/nl" },
    },
    {
      text: "See your results",
      target: { type: "page", value: "results" },
      color: "secondary",
    },
  ],
};

test("accepts a well-formed completion entry", () => {
  expect(validate(validDoc)).toBe(true);
});

test("accepts the optional caption, closing_text, hint, and nav-bar fields", () => {
  expect(
    validate({
      ...validDoc,
      caption: "Recorded 29 July 2026.",
      closing_text: "Thank you.",
      hint: "Takes about 2 minutes.",
      "nav-bar": { visible: false },
    }),
  ).toBe(true);
});

test("rejects a completion entry missing buttons", () => {
  const { buttons: _buttons, ...withoutButtons } = validDoc;
  expect(validate(withoutButtons)).toBe(false);
});

test("rejects an empty buttons array", () => {
  expect(validate({ ...validDoc, buttons: [] })).toBe(false);
});

test("rejects a button missing target", () => {
  expect(validate({ ...validDoc, buttons: [{ text: "Go" }] })).toBe(false);
});

test("rejects a page-target button with value 'start_route'", () => {
  expect(
    validate({
      ...validDoc,
      buttons: [{ text: "Go", target: { type: "page", value: "start_route" } }],
    }),
  ).toBe(false);
});

test("rejects an unknown top-level property", () => {
  expect(validate({ ...validDoc, unexpected_field: true })).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/completionSchema.test.ts`
Expected: FAIL — the schema still requires `registration` and has no `buttons` property.

- [ ] **Step 3: Rewrite `src/data/schemas/completion.schema.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Completion Screen",
  "type": "object",
  "additionalProperties": false,
  "required": ["template-type", "image", "title", "subtitle", "place", "buttons"],
  "properties": {
    "template-type": { "const": "completion" },
    "image": { "type": "string" },
    "title": { "type": "string" },
    "subtitle": { "type": "string" },
    "place": { "type": "string" },
    "caption": { "type": "string" },
    "closing_text": { "type": "string" },
    "hint": { "type": "string" },
    "nav-bar": {
      "type": "object",
      "additionalProperties": false,
      "properties": { "visible": { "type": "boolean" } }
    },
    "buttons": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["text", "target"],
        "properties": {
          "text": { "type": "string" },
          "color": { "enum": ["primary", "secondary"] },
          "target": {
            "oneOf": [
              {
                "type": "object",
                "additionalProperties": false,
                "required": ["type", "value"],
                "properties": {
                  "type": { "const": "link" },
                  "value": { "type": "string" }
                }
              },
              {
                "type": "object",
                "additionalProperties": false,
                "required": ["type", "value"],
                "properties": {
                  "type": { "const": "page" },
                  "value": { "enum": ["title", "project", "gallery", "results"] }
                }
              }
            ]
          }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Update `CompletionEntry` in `src/types/data.ts:234-245`**

Replace the `registration` field with `buttons`:

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

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:run -- src/test/completionSchema.test.ts`
Expected: PASS (all 7 tests).

- [ ] **Step 6: Stage for review**

List changed files (`src/data/schemas/completion.schema.json`, `src/types/data.ts`,
`src/test/completionSchema.test.ts`) for the user. Do not run `git add`/`git commit`.

---

### Task 5: `CompletionScreen.svelte` renders `buttons` via `WideButton`

**Files:**
- Modify: `src/components/CompletionScreen.svelte`
- Modify: `src/components/CompletionScreen.css`
- Test: `src/test/CompletionScreen.test.ts`

**Interfaces:**
- Consumes: `WideButton` (Task 3), `WideButtonConfig` (Task 4).
- Produces: `CompletionScreen` prop `buttons: WideButtonConfig[]` (replaces
  `registration: { text; url }`).

- [ ] **Step 1: Update the failing tests**

In `src/test/CompletionScreen.test.ts`, replace `baseProps.registration` (lines 19-22)
with:

```ts
  buttons: [
    {
      text: "Check your voter registration",
      target: { type: "link", value: "https://www.democratsabroad.org/nl" },
    },
    {
      text: "See your results",
      target: { type: "page", value: "results" },
      color: "secondary",
    },
  ],
```

Replace the `"renders the registration link pointing at the authored URL"` test
(lines 46-51) with:

```ts
test("renders the primary button as a real link to its authored URL", () => {
  render(CompletionScreen, { props: baseProps });
  const link = screen.getByRole("link", { name: "Check your voter registration" });
  expect(link).toHaveAttribute("href", "https://www.democratsabroad.org/nl");
  expect(link).toHaveAttribute("target", "_blank");
});
```

Replace the `"renders a secondary button that navigates to the route's results_download page"`
test (lines 53-58) with:

```ts
test("renders a second button that navigates to the route's results_download page", async () => {
  const { push } = await import("svelte-spa-router");
  render(CompletionScreen, { props: baseProps });
  await fireEvent.click(screen.getByRole("button", { name: "See your results" }));
  expect(push).toHaveBeenCalledWith("/democrats_abroad/den_haag/results_download");
});
```

(The theme-default-color fallback and explicit-color-override behaviors already have
dedicated coverage in `src/test/WideButton.test.ts` from Task 3 — `CompletionScreen`
delegates rendering to `WideButton` via prop spreading, so re-testing that logic here
would just duplicate Task 3's tests against the same code path.)

- [ ] **Step 2: Run tests to verify the two updated tests fail**

Run: `npm run test:run -- src/test/CompletionScreen.test.ts`
Expected: FAIL on the two updated tests — the component still expects a `registration`
prop and renders `"See your answers"`, not `buttons`/`"See your results"`.

- [ ] **Step 3: Update `CompletionScreen.svelte`'s props**

Change the import block (add `WideButtonConfig` to the existing type-only import, add a
new import for `WideButton`):

```ts
  import type { CompletionStats, WideButtonConfig } from "../types/data";
```

```ts
  import WideButton from "./WideButton.svelte";
```

Change the props destructuring:

```ts
  let {
    image,
    title,
    subtitle,
    place,
    caption = undefined,
    closingText = undefined,
    registration,
    hint = undefined,
    stats,
    project,
    cityId,
    isCurrent = true,
  }: {
    image: string;
    title: string;
    subtitle: string;
    place: string;
    caption?: string;
    closingText?: string;
    registration: { text: string; url: string };
    hint?: string;
    stats: CompletionStats;
    project: string;
    cityId: string;
    isCurrent?: boolean;
  } = $props();
```

to:

```ts
  let {
    image,
    title,
    subtitle,
    place,
    caption = undefined,
    closingText = undefined,
    buttons,
    hint = undefined,
    stats,
    project,
    cityId,
    isCurrent = true,
  }: {
    image: string;
    title: string;
    subtitle: string;
    place: string;
    caption?: string;
    closingText?: string;
    buttons: WideButtonConfig[];
    hint?: string;
    stats: CompletionStats;
    project: string;
    cityId: string;
    isCurrent?: boolean;
  } = $props();
```

- [ ] **Step 4: Delete `goToResults`**

Remove this function entirely (no longer used — `WideButton` resolves its own
navigation):

```ts
  function goToResults() {
    push(`/${project}/${cityId}/results_download`);
  }
```

Since `push` is no longer called directly from `CompletionScreen.svelte`, also remove its
now-unused import: `import { push } from "svelte-spa-router";`.

- [ ] **Step 5: Replace the hardcoded actions markup**

Change:

```svelte
  <div class="cmpl-actions cmpl-reveal" class:cmpl-reveal--in={actionsIn}>
    <a class="cmpl-btn-primary" href={registration.url} target="_blank" rel="noopener noreferrer">
      {registration.text}
    </a>
    <button type="button" class="cmpl-btn-secondary" onclick={goToResults}>
      See your answers
    </button>
    {#if hint}
      <p class="cmpl-hint">{hint}</p>
    {/if}
  </div>
```

to:

```svelte
  <div class="cmpl-actions cmpl-reveal" class:cmpl-reveal--in={actionsIn}>
    {#each buttons as button, i (i)}
      <WideButton {...button} {project} {cityId} />
    {/each}
    {#if hint}
      <p class="cmpl-hint">{hint}</p>
    {/if}
  </div>
```

- [ ] **Step 6: Delete the now-unused button CSS from `CompletionScreen.css`**

Remove the `.cmpl-btn-primary` and `.cmpl-btn-secondary` rule blocks (lines 125-154 —
everything from `.cmpl-btn-primary {` through the closing `}` of `.cmpl-btn-secondary`):

```css
.cmpl-btn-primary {
  display: block;
  width: 100%;
  background: var(--color-accent);
  color: #000;
  border: none;
  font-weight: 800;
  font-size: var(--font-size-base);
  padding: 15px 18px;
  border-radius: 10px;
  text-align: center;
  box-sizing: border-box;
  text-decoration: none;
  cursor: pointer;
}

.cmpl-btn-secondary {
  display: block;
  width: 100%;
  background: var(--color-background);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  font-weight: 700;
  font-size: var(--font-size-base);
  padding: 13px 18px;
  border-radius: 10px;
  text-align: center;
  box-sizing: border-box;
  cursor: pointer;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:run -- src/test/CompletionScreen.test.ts`
Expected: PASS (all tests in the file, including the ones untouched by this task).

- [ ] **Step 8: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Stage for review**

List changed files (`src/components/CompletionScreen.svelte`,
`src/components/CompletionScreen.css`, `src/test/CompletionScreen.test.ts`) for the user.
Do not run `git add`/`git commit`.

---

### Task 6: `RouteScreen.svelte` passes `buttons` to `CompletionScreen`

**Files:**
- Modify: `src/components/RouteScreen.svelte:70-84`
- Test: `src/test/RouteScreen.test.ts`

- [ ] **Step 1: Update the failing tests**

In `src/test/RouteScreen.test.ts`, both completion-entry test fixtures currently include:

```ts
        registration: { text: "Check your registration", url: "https://example.org" },
```

(one in `"renders CompletionScreen for a completion entry"`, one in `"passes a zeroed
placeholder stats object to CompletionScreen when stats is not provided"`). Replace both
occurrences with:

```ts
        buttons: [
          { text: "Check your registration", target: { type: "link", value: "https://example.org" } },
        ],
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/RouteScreen.test.ts`
Expected: FAIL on the two completion tests — `RouteScreen` still reads/forwards
`entry.registration`, and the entry fixture no longer has that field typed correctly
against the updated `CompletionEntry`.

- [ ] **Step 3: Update `RouteScreen.svelte`'s completion dispatch**

Change:

```svelte
{:else if entry["template-type"] === "completion"}
  <CompletionScreen
    image={entry.image}
    title={entry.title}
    subtitle={entry.subtitle}
    place={entry.place}
    caption={entry.caption}
    closingText={entry.closing_text}
    registration={entry.registration}
    hint={entry.hint}
    stats={stats ?? { stopsCompleted: 0, stopsTotal: 0, photosCount: "—", timeOnFoot: "—" }}
    project={project}
    cityId={cityId ?? ""}
    {isCurrent}
  />
```

to:

```svelte
{:else if entry["template-type"] === "completion"}
  <CompletionScreen
    image={entry.image}
    title={entry.title}
    subtitle={entry.subtitle}
    place={entry.place}
    caption={entry.caption}
    closingText={entry.closing_text}
    buttons={entry.buttons}
    hint={entry.hint}
    stats={stats ?? { stopsCompleted: 0, stopsTotal: 0, photosCount: "—", timeOnFoot: "—" }}
    project={project}
    cityId={cityId ?? ""}
    {isCurrent}
  />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/test/RouteScreen.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Stage for review**

List changed files (`src/components/RouteScreen.svelte`, `src/test/RouteScreen.test.ts`)
for the user. Do not run `git add`/`git commit`.

---

### Task 7: Migrate `009_completion_den_haag.yaml`

**Files:**
- Modify: `src/data/text/en/projects/democrats_abroad/den_haag/009_completion_den_haag.yaml`

- [ ] **Step 1: Replace the `registration` block with `buttons`**

Change:

```yaml
registration:
  text: "Check your voter registration"
  url: "https://www.democratsabroad.org/nl"
```

to:

```yaml
buttons:
  - text: "Check your voter registration"
    target: { type: link, value: "https://www.democratsabroad.org/nl" }
    color: primary
  - text: "See your results"
    target: { type: page, value: results }
    color: secondary
```

The full file (for reference — only the block above changes; `image` through
`closing_text`, and `hint`/`nav-bar` at the bottom, stay exactly as they are today):

```yaml
template-type: completion
image: lange-vijverberg.jpg
title: "You made it."
subtitle: "Democrats Abroad 2026 Scavenger Hunt"
place: "The Hague · short loop"
caption: "Completed with Democrats Abroad Netherlands · The Hague"
closing_text: |
  Thank you for spending your afternoon walking these streets. **Every registered voter counts** — take two minutes now while it's fresh, then come back and browse the photo gallery from today.
buttons:
  - text: "Check your voter registration"
    target: { type: link, value: "https://www.democratsabroad.org/nl" }
    color: primary
  - text: "See your results"
    target: { type: page, value: results }
    color: secondary
hint: "Takes about 2 minutes · vote.org"
nav-bar:
  visible: false
```

- [ ] **Step 2: Validate the YAML against the updated schema**

Run: `npm run validate:yaml`
Expected: PASS — no violations reported for `009_completion_den_haag.yaml`.

- [ ] **Step 3: Stage for review**

List the changed file
(`src/data/text/en/projects/democrats_abroad/den_haag/009_completion_den_haag.yaml`) for
the user. Do not run `git add`/`git commit`.

---

### Task 8: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:run`
Expected: PASS — every test file in `src/test/`, including the six touched by this plan
(`optionTargets.test.ts`, `OptionsScreen.test.ts`, `WideButton.test.ts`,
`completionSchema.test.ts`, `CompletionScreen.test.ts`, `RouteScreen.test.ts`) and every
untouched file (no regressions elsewhere).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: PASS — in particular, confirms `goToResults`'s removed `push` import in
`CompletionScreen.svelte` (Task 5, Step 4) left no unused-import violation.

- [ ] **Step 4: Run YAML validation**

Run: `npm run validate:yaml`
Expected: PASS.

- [ ] **Step 5: Report to the user**

Summarize: all four checks passed, list every file changed across Tasks 1-7, and note
that manual verification in the running app (per this repo's `CLAUDE.md`) is the user's
step, not an automated one — offer to start the dev server (`npm run dev`) if the user
wants to look at the completion screen themselves.
