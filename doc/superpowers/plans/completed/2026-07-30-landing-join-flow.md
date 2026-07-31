# Landing & Join Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `AppPage`/`CodeEntryPage`/`JoinTeamPage` with a `LandingPage` that shows a procedural search-tree attract animation behind a code-entry sheet, then a `TeamSetupPage`, per `doc/superpowers/specs/2026-07-30-landing-join-flow-design.md` (v1.1).

**Architecture:** A pure-logic layer (`searchWalk.ts`, `huntSummary.ts`, `normalizeCode.ts`, extended `teamNameGenerator.ts`) feeds a `SearchPlane` background component shared by three screens (`LandingPage`, the `JoinSheet` it hosts, and `TeamSetupPage`). Routing and auth reuse the existing `postVerifyCode`/`postLogin` calls and `pendingHuntAuth` sessionStorage handoff — only the screens around them change.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + `@testing-library/svelte/svelte5`, CSS custom properties, `lucide-svelte`. No new dependency.

## Global Constraints

- No new runtime dependency; no image assets; no new webfont (spec §1).
- TypeScript only, `.svelte` + co-located `.css`, no CSS modules/Tailwind (`CLAUDE.md`).
- Every colour via `var(--color-*)`/new per-theme tokens — never a hardcoded hex in component CSS (spec §3.1).
- `--font-size-*` tokens must rescale with `data-fontsize` (spec §3.3).
- 44px minimum touch target on every tappable element (spec §7, §8.1, §13).
- `prefers-reduced-motion: reduce` → frozen plane, no rAF loop, ~1ms transitions (spec §5.6, §5.7, §9).
- `random_value`'s new `reroll`/`editable` properties must default to `false` so `003_form_jewish_children_museum.yaml` is unaffected (spec §4).
- The code the user types is later replayed verbatim as the login password (`postLogin`) via the existing `pendingHuntAuth` sessionStorage handoff — do not lose or re-derive it (spec §4.1, §8.2).
- Never invoke git commands — the user controls git (`CLAUDE.md` limitation). Stop before any commit step below and let the user run it, or confirm they want you to.

---

## Phase 0 — Backend: code normalization

### Task 1: `normalizeCode` utility

**Files:**
- Create: `src/utils/normalizeCode.ts`
- Test: `src/test/normalizeCode.test.ts`

**Interfaces:**
- Produces: `normalizeCode(input: string): string` — used by Task 2 (server-side comparison) and Task 16 (`JoinSheet` display).

- [ ] **Step 1: Write the failing test**

```ts
// src/test/normalizeCode.test.ts
import { describe, it, expect } from "vitest";
import { normalizeCode } from "../utils/normalizeCode";

describe("normalizeCode", () => {
  it("uppercases", () => {
    expect(normalizeCode("abc123")).toBe("ABC123");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeCode("  abc123  ")).toBe("ABC123");
  });

  it("strips internal dashes, underscores, and spaces", () => {
    expect(normalizeCode("da-hague")).toBe("DAHAGUE");
    expect(normalizeCode("da_hague")).toBe("DAHAGUE");
    expect(normalizeCode("da hague")).toBe("DAHAGUE");
  });

  it("treats all separator variants of the same code as equal", () => {
    expect(normalizeCode("DA-HAGUE")).toBe(normalizeCode("da_hague"));
    expect(normalizeCode(" Da Hague ")).toBe(normalizeCode("DAHAGUE"));
  });

  it("returns an empty string for empty or whitespace-only input", () => {
    expect(normalizeCode("")).toBe("");
    expect(normalizeCode("   ")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/normalizeCode.test.ts`
Expected: FAIL — `Cannot find module '../utils/normalizeCode'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/normalizeCode.ts
/**
 * Canonical form for a hunt code / participant password: uppercase, no
 * surrounding whitespace, and `-`/`_`/space treated as equivalent (stripped).
 * Used on both the client (display) and the server (comparison) so a code
 * typed with different casing or separators than the organiser's stored
 * value still resolves and logs in.
 */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[-_\s]+/g, "");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/normalizeCode.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/normalizeCode.ts src/test/normalizeCode.test.ts
git commit -m "feat: add normalizeCode utility for lenient hunt-code matching"
```

---

### Task 2: Apply normalization to `/auth/verify-code` and `/auth/login`

**Files:**
- Modify: `src/worker/routes/authRoutes.ts:176-202` (`/auth/verify-code`), `:225-290` (`/auth/login` participant path)
- Modify: `src/test/worker.test.ts:529-660,662-756` (existing `/auth/login — admin tier` and `/auth/verify-code` describe blocks)
- Modify: `doc/setup.md` (the "Setting a password for your project" section, around line 159)

**Interfaces:**
- Consumes: `normalizeCode` from Task 1.
- Produces: no change to any function signature or response shape — comparison semantics only.

- [ ] **Step 1: Write the failing tests**

Add to the existing `describe("/auth/verify-code", ...)` block in `src/test/worker.test.ts` (after the existing "trims whitespace" test, using the same `makeEnv` helper already defined in that block):

```ts
  it("matches regardless of case and separator style", async () => {
    const env = makeEnv({ "auth:democrats_abroad": "Let-Me_In" });
    const request = new Request("https://example.com/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ code: "let me in" }),
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "5.5.5.7" },
    });
    const response = await worker.fetch(request, env);
    const data = await response.json();
    expect(data).toEqual({ ok: true, mode: "project", project: "democrats_abroad" });
  });
```

Add to the existing `describe("/auth/login — admin tier", ...)` block (using its `makeAuthEnv` helper, which stores `"userpass"` under `auth:test_project`):

```ts
  it("logs in when the submitted password differs only in case/separators from the stored one", async () => {
    const request = new Request("https://example.com/auth/login", {
      method: "POST",
      body: JSON.stringify({
        project: "test_project",
        teamName: "Team A",
        contact: "",
        password: "USER-PASS", // stored value is "userpass"
      }),
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "1.2.3.7",
      },
    });
    const response = await worker.fetch(request, makeAuthEnv());
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.isAdmin).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/worker.test.ts -t "case/separator"`
Expected: FAIL — both new assertions fail because `authRoutes.ts` still does exact `===` comparison.

- [ ] **Step 3: Apply normalization in `authRoutes.ts`**

Add the import at the top:

```ts
import { normalizeCode } from "../../utils/normalizeCode";
```

In `/auth/verify-code`, replace the matching loop (current body around line 186-196):

```ts
      const list = await env.AUTH_STORE.list({ prefix: KV_PREFIX_PARTICIPANT });
      const normalizedInput = normalizeCode(trimmed);
      for (const key of list.keys) {
        const storedPassword = await env.AUTH_STORE.get(key.name);
        if (storedPassword !== null && normalizeCode(storedPassword) === normalizedInput) {
          return json({
            ok: true,
            mode: "project",
            project: key.name.slice(KV_PREFIX_PARTICIPANT.length),
          });
        }
      }
```

In `/auth/login`'s participant path, replace the two exact-match comparisons (current lines ~257 and ~273):

```ts
        if (adminPw !== null && normalizeCode(password) === normalizeCode(adminPw)) {
          // Issue bootstrap token — valid only for /auth/bootstrap/promote
```

```ts
        if (participantPw === null || normalizeCode(password) !== normalizeCode(participantPw)) {
          return json({ ok: false, error: "Incorrect password" }, 401);
        }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/worker.test.ts`
Expected: PASS — all existing `/auth/verify-code` and `/auth/login` tests still pass (they use exact-match codes, which normalize to themselves), plus the two new tests pass.

- [ ] **Step 5: Update `doc/setup.md`**

In the "Setting a password for your project" section (around line 159), add a note directly after the existing "One password, whole project" callout:

```markdown
> **Case and separators don't matter.** `letmein`, `LetMeIn`, and `LET-ME-IN` are all the
> same code to a participant — the app uppercases and strips `-`/`_`/spaces before
> comparing. Choose whatever's easiest to read on a flyer or QR code; you don't need to
> worry about participants mistyping the case.
```

- [ ] **Step 6: Run the full test suite, lint, and typecheck**

Run: `npm test && npm run lint && npx svelte-check`
Expected: all green (pre-existing baseline plus the new tests from this task)

- [ ] **Step 7: Commit**

```bash
git add src/worker/routes/authRoutes.ts src/test/worker.test.ts doc/setup.md
git commit -m "fix: normalize hunt-code/password comparison for case and separator leniency"
```

---

## Phase 1 — Theme and structural tokens

### Task 3: Add `SearchPlane`/`DepthWordmark` tokens and `intro` theme values

**Files:**
- Modify: `src/types/theme.ts` (extend `Theme` interface)
- Modify: `src/theme/themes.ts` (add values to all three presets)
- Modify: `src/App.svelte:88-112` (sync new colour tokens to CSS custom properties)
- Modify: `src/styles/tokens.css` (structural tokens only — see note below)
- Test: `src/test/App.test.ts` (create if it doesn't already cover token sync — check first with `ls src/test/App*`)

**Interfaces:**
- Produces: `Theme.intro: { motion: 'search'|'static'|'none'; sheen: boolean }` and the ten colour fields below, consumed by `SearchPlane` (Tasks 9-11) and `DepthWordmark` (Task 12) via `$themeStore.theme`.

**Important — read before editing `tokens.css`:** `src/theme/themes.ts` values are synced to CSS custom properties **imperatively** by `App.svelte`'s `$effect` (`root.style.setProperty(...)`), which runs regardless of any `data-theme` attribute. `tokens.css`'s `:root[data-theme="app"]`/`:root[data-theme="GWC"]` blocks are never actually applied — nothing in the app ever sets a `data-theme` attribute on `<html>` (only `data-fontsize` is set, in the same `App.svelte`). **Do not add the new `--search-*`/`--intro-*`/`--sheen-image` tokens to those per-theme blocks** — that would create more dead CSS matching an existing (pre-existing, out of scope to fix) pattern. Add them only to `tokens.css`'s base `:root` block as static fallback defaults, and drive the real per-theme values through `themes.ts` + `App.svelte`, exactly like every existing `--color-*` token.

- [ ] **Step 1: Extend the `Theme` type**

In `src/types/theme.ts`, add after the `swipe: SwipeConfig;` line:

```ts
export interface IntroConfig {
  motion: 'search' | 'static' | 'none';
  sheen: boolean;
}
```

And add to the `Theme` interface:

```ts
  searchGrid: string;
  searchEdge: string;
  searchEdgeActive: string;
  searchEdgeVisited: string;
  searchNode: string;
  searchNodeActive: string;
  searchNodeHalo: string;
  searchLabel: string;
  searchPinStem: string;
  searchPinHead: string;
  introFog: string;
  introScrim: string;
  sheenImage: string;
  intro: IntroConfig;
```

- [ ] **Step 2: Add values to all three presets in `src/theme/themes.ts`**

Add to `wireframe` (values resolve to existing tokens per spec §3.1/§11 — grid/edges to border, nodes to text, no sheen):

```ts
    searchGrid: "#dddddd",
    searchEdge: "#dddddd",
    searchEdgeActive: "#555555",
    searchEdgeVisited: "#bbbbbb",
    searchNode: "#dddddd",
    searchNodeActive: "#111111",
    searchNodeHalo: "rgba(17,17,17,.12)",
    searchLabel: "#666666",
    searchPinStem: "#555555",
    searchPinHead: "#111111",
    introFog: "linear-gradient(#ffffff 40%, rgba(255,255,255,0))",
    introScrim: "linear-gradient(rgba(255,255,255,0), rgba(255,255,255,.74) 44%, rgba(255,255,255,.94))",
    sheenImage: "none",
    intro: { motion: "static", sheen: false },
```

Add to `app`:

```ts
    searchGrid: "#27354d",
    searchEdge: "#243350",
    searchEdgeActive: "#f59e0b",
    searchEdgeVisited: "#334c6e",
    searchNode: "#33415c",
    searchNodeActive: "#f59e0b",
    searchNodeHalo: "rgba(245,158,11,.12)",
    searchLabel: "#a7bad0",
    searchPinStem: "#b06f09",
    searchPinHead: "#f59e0b",
    introFog: "linear-gradient(#0f172a 40%, rgba(15,23,42,0))",
    introScrim: "linear-gradient(rgba(5,10,20,0), rgba(5,10,20,.74) 44%, rgba(5,10,20,.94))",
    sheenImage: "linear-gradient(104deg,#e7eef7 8%,#ffd88a 26%,#f59e0b 42%,#ffe6a8 58%,#e7eef7 76%,#f0b84a 92%)",
    intro: { motion: "search", sheen: true },
```

Add to `GWC` (pale blue grid on white, navy nodes, flag-red current node, no sheen per spec §11):

```ts
    searchGrid: "#dbe6ff",
    searchEdge: "#dbe6ff",
    searchEdgeActive: "#BF0A30",
    searchEdgeVisited: "#a8c0ea",
    searchNode: "#c7d6f5",
    searchNodeActive: "#BF0A30",
    searchNodeHalo: "rgba(191,10,48,.12)",
    searchLabel: "#374151",
    searchPinStem: "#002868",
    searchPinHead: "#BF0A30",
    introFog: "linear-gradient(#ffffff 40%, rgba(255,255,255,0))",
    introScrim: "linear-gradient(rgba(255,255,255,0), rgba(255,255,255,.74) 44%, rgba(255,255,255,.94))",
    sheenImage: "none",
    intro: { motion: "search", sheen: false },
```

- [ ] **Step 3: Sync the new colour tokens in `App.svelte`**

Add inside the existing `$effect` in `src/App.svelte`, after the `--color-clue-border-color` line:

```ts
    root.style.setProperty("--search-grid", theme.searchGrid);
    root.style.setProperty("--search-edge", theme.searchEdge);
    root.style.setProperty("--search-edge-active", theme.searchEdgeActive);
    root.style.setProperty("--search-edge-visited", theme.searchEdgeVisited);
    root.style.setProperty("--search-node", theme.searchNode);
    root.style.setProperty("--search-node-active", theme.searchNodeActive);
    root.style.setProperty("--search-node-halo", theme.searchNodeHalo);
    root.style.setProperty("--search-label", theme.searchLabel);
    root.style.setProperty("--search-pin-stem", theme.searchPinStem);
    root.style.setProperty("--search-pin-head", theme.searchPinHead);
    root.style.setProperty("--intro-fog", theme.introFog);
    root.style.setProperty("--intro-scrim", theme.introScrim);
    root.style.setProperty("--sheen-image", theme.sheenImage);
```

- [ ] **Step 4: Add structural tokens to `src/styles/tokens.css`**

Add to the base `:root` block (after `--field-min-height`) — these are theme-independent and also serve as fallback values before `App.svelte`'s effect runs on first paint:

```css
  --font-size-display: 40px;
  --font-map: 'Barlow Semi Condensed', 'Roboto Condensed', 'Arial Narrow', sans-serif;
  --sheet-radius: 1.125rem;
  --search-grid: #dddddd;
  --search-edge: #dddddd;
  --search-edge-active: #555555;
  --search-edge-visited: #bbbbbb;
  --search-node: #dddddd;
  --search-node-active: #111111;
  --search-node-halo: rgba(17,17,17,.12);
  --search-label: #666666;
  --search-pin-stem: #555555;
  --search-pin-head: #111111;
  --intro-fog: linear-gradient(#ffffff 40%, rgba(255,255,255,0));
  --intro-scrim: linear-gradient(rgba(255,255,255,0), rgba(255,255,255,.74) 44%, rgba(255,255,255,.94));
  --sheen-image: none;
```

Add the `data-fontsize` rescale for `--font-size-display` to both the `medium` and `large` blocks, one step above the existing `--font-size-3xl` progression:

```css
/* inside :root[data-fontsize="medium"] */
  --font-size-display: 46px;
/* inside :root[data-fontsize="large"] */
  --font-size-display: 52px;
```

- [ ] **Step 5: Write a token-sync regression test**

Check whether `src/test/App.test.ts` exists first (`ls src/test | grep -i app`). If it doesn't, create it:

```ts
// src/test/App.test.ts
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte/svelte5";
import App from "../App.svelte";
import { themeStore } from "../stores/themeStore";

describe("App theme token sync", () => {
  it("syncs the new search/intro tokens onto <html> for the active theme", () => {
    themeStore.setThemeName("app");
    render(App);
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--search-node-active")).toBe("#f59e0b");
    expect(style.getPropertyValue("--sheen-image")).toContain("linear-gradient");
  });

  it("clears the sheen image for GWC (no shimmer on a civic brand)", () => {
    themeStore.setThemeName("GWC");
    render(App);
    expect(document.documentElement.style.getPropertyValue("--sheen-image")).toBe("none");
  });
});
```

If `App.test.ts` already exists, add these two `it` blocks to its existing top-level `describe` instead of creating a new file.

- [ ] **Step 6: Run the test**

Run: `npx vitest run src/test/App.test.ts`
Expected: PASS

- [ ] **Step 7: Run full suite, lint, typecheck**

Run: `npm test && npm run lint && npx svelte-check`
Expected: all green

- [ ] **Step 8: Commit**

```bash
git add src/types/theme.ts src/theme/themes.ts src/App.svelte src/styles/tokens.css src/test/App.test.ts
git commit -m "feat: add SearchPlane/DepthWordmark theme tokens and intro behavior values"
```

---

## Phase 2 — Pure logic

### Task 4: `searchWalk.ts` — procedural tree geometry

**Files:**
- Create: `src/utils/searchWalk.ts`
- Test: `src/test/searchWalk.test.ts`

**Interfaces:**
- Produces: `pickChildCount(rand)`, `angularSpacing(k, rand)`, `jitterHeading(baseHeading, rand)`, `edgeLength(rand)`, `splitDurationMs(k)`, `lerpCamera(cam, target, factor?)`, `computeChildHeadings(parentHeading, k, rand)`, `HEAD_ANGLE = -Math.PI / 2`. All pure, all take an injectable `rand: () => number` (defaulting to `Math.random`) so tests can be deterministic. Consumed by `SearchPlane` (Tasks 9-10).

- [ ] **Step 1: Write the failing tests**

```ts
// src/test/searchWalk.test.ts
import { describe, it, expect } from "vitest";
import {
  HEAD_ANGLE,
  pickChildCount,
  angularSpacing,
  jitterHeading,
  edgeLength,
  splitDurationMs,
  lerpCamera,
  computeChildHeadings,
} from "../utils/searchWalk";

function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("pickChildCount", () => {
  it("returns 2 for the bottom 30% of the random range", () => {
    expect(pickChildCount(seq([0.0]))).toBe(2);
    expect(pickChildCount(seq([0.29]))).toBe(2);
  });
  it("returns 3 for the next 38%", () => {
    expect(pickChildCount(seq([0.3]))).toBe(3);
    expect(pickChildCount(seq([0.67]))).toBe(3);
  });
  it("returns 4 for the remaining 32%", () => {
    expect(pickChildCount(seq([0.68]))).toBe(4);
    expect(pickChildCount(seq([0.999]))).toBe(4);
  });
});

describe("angularSpacing", () => {
  it("uses the base value for k=2 plus jitter in [0, 0.12)", () => {
    const spacing = angularSpacing(2, seq([0]));
    expect(spacing).toBeCloseTo(0.74, 5);
    const spacingJittered = angularSpacing(2, seq([1]));
    expect(spacingJittered).toBeCloseTo(0.74 + 0.12, 5);
  });
  it("uses the base value for k=3", () => {
    expect(angularSpacing(3, seq([0]))).toBeCloseTo(0.6, 5);
  });
  it("uses the base value for k=4", () => {
    expect(angularSpacing(4, seq([0]))).toBeCloseTo(0.5, 5);
  });
});

describe("jitterHeading", () => {
  it("jitters within ±0.275 of the base heading", () => {
    const max = jitterHeading(HEAD_ANGLE, seq([1]));
    const min = jitterHeading(HEAD_ANGLE, seq([0]));
    expect(max - HEAD_ANGLE).toBeCloseTo(0.275, 5);
    expect(min - HEAD_ANGLE).toBeCloseTo(-0.275, 5);
  });
  it("clamps to within ±1.15 of straight-ahead even from an extreme base heading", () => {
    const extreme = HEAD_ANGLE + 2; // way past the clamp
    const result = jitterHeading(extreme, seq([0.5]));
    expect(result).toBeLessThanOrEqual(HEAD_ANGLE + 1.15);
    expect(result).toBeGreaterThanOrEqual(HEAD_ANGLE - 1.15);
  });
});

describe("edgeLength", () => {
  it("returns a value in [68, 94]", () => {
    expect(edgeLength(seq([0]))).toBe(68);
    expect(edgeLength(seq([1]))).toBe(94);
  });
});

describe("splitDurationMs", () => {
  it("matches (k-1) * 330 + 450", () => {
    expect(splitDurationMs(2)).toBe(780);
    expect(splitDurationMs(3)).toBe(1110);
    expect(splitDurationMs(4)).toBe(1440);
  });
});

describe("lerpCamera", () => {
  it("moves the camera 4.5% of the remaining distance toward the target by default", () => {
    const next = lerpCamera({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(next.x).toBeCloseTo(4.5, 5);
    expect(next.y).toBeCloseTo(0, 5);
  });
  it("accepts a custom factor", () => {
    const next = lerpCamera({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.5);
    expect(next.x).toBeCloseTo(50, 5);
  });
});

describe("computeChildHeadings", () => {
  it("returns k headings, evenly fanned around the parent heading by the spacing", () => {
    const headings = computeChildHeadings(HEAD_ANGLE, 3, seq([0, 0, 0, 0, 0]));
    expect(headings).toHaveLength(3);
    // 3 children, spacing 0.6 rad apart, centred on the parent heading
    expect(headings[0]).toBeCloseTo(HEAD_ANGLE - 0.6, 4);
    expect(headings[1]).toBeCloseTo(HEAD_ANGLE, 4);
    expect(headings[2]).toBeCloseTo(HEAD_ANGLE + 0.6, 4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/searchWalk.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement `searchWalk.ts`**

```ts
// src/utils/searchWalk.ts
export const HEAD_ANGLE = -Math.PI / 2;
const HEADING_CLAMP = 1.15;

export interface Point {
  x: number;
  y: number;
}

/** 2 children 30% of the time, 3 children 38%, 4 children 32%. */
export function pickChildCount(rand: () => number = Math.random): 2 | 3 | 4 {
  const r = rand();
  if (r < 0.3) return 2;
  if (r < 0.68) return 3;
  return 4;
}

const BASE_SPACING: Record<2 | 3 | 4, number> = { 2: 0.74, 3: 0.6, 4: 0.5 };

/** Angular gap between adjacent children for a k-way split, plus rand(0, 0.12) jitter. */
export function angularSpacing(k: 2 | 3 | 4, rand: () => number = Math.random): number {
  return BASE_SPACING[k] + rand() * 0.12;
}

function clampToHeadingRange(angle: number): number {
  const min = HEAD_ANGLE - HEADING_CLAMP;
  const max = HEAD_ANGLE + HEADING_CLAMP;
  return Math.min(max, Math.max(min, angle));
}

/** Jitters a base heading by up to ±0.275 rad, then clamps within ±1.15 of straight-ahead. */
export function jitterHeading(baseHeading: number, rand: () => number = Math.random): number {
  const jitter = (rand() * 2 - 1) * 0.275;
  return clampToHeadingRange(baseHeading + jitter);
}

/** Edge length in px, uniform in [68, 94]. */
export function edgeLength(rand: () => number = Math.random): number {
  return 68 + rand() * (94 - 68);
}

/** Total time (ms) for a k-way split to fully resolve: (k - 1) * 330 + 450. */
export function splitDurationMs(k: 2 | 3 | 4): number {
  return (k - 1) * 330 + 450;
}

/** Moves `cam` a fraction of the way toward `target`. Default factor 0.045/frame. */
export function lerpCamera(cam: Point, target: Point, factor = 0.045): Point {
  return {
    x: cam.x + (target.x - cam.x) * factor,
    y: cam.y + (target.y - cam.y) * factor,
  };
}

/**
 * Returns k headings fanned evenly around `parentHeading`, `spacing` radians
 * apart (see `angularSpacing`), each further jittered by `jitterHeading`.
 * `rand` is called once for the spacing draw and once per child for jitter —
 * pass a `rand` that yields at least `1 + k` values for a fully deterministic test.
 */
export function computeChildHeadings(
  parentHeading: number,
  k: 2 | 3 | 4,
  rand: () => number = Math.random,
): number[] {
  const spacing = angularSpacing(k, rand);
  const span = spacing * (k - 1);
  const start = parentHeading - span / 2;
  const headings: number[] = [];
  for (let i = 0; i < k; i++) {
    headings.push(clampToHeadingRange(start + i * spacing));
  }
  return headings;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/searchWalk.test.ts`
Expected: PASS (all describe blocks)

- [ ] **Step 5: Commit**

```bash
git add src/utils/searchWalk.ts src/test/searchWalk.test.ts
git commit -m "feat: add searchWalk pure geometry module for the SearchPlane attract animation"
```

---

### Task 5: `searchWalk.ts` — node/edge aging (fade + prune)

**Files:**
- Modify: `src/utils/searchWalk.ts` (add aging helpers)
- Modify: `src/test/searchWalk.test.ts` (add aging tests)

**Interfaces:**
- Produces: `ageStep(nodes: AgingNode[]): AgingNode[]`, `AgingNode = { id: string; age: number }`, `FADE_AFTER_STEPS = 7`, `removeAfterSteps(isWideViewport: boolean): number` (13, or 18 at `>= 1200px` per spec §2/§5.4). Consumed by `SearchPlane` (Task 10) to decide which nodes/edges to fade/unmount.

- [ ] **Step 1: Write the failing tests**

Append to `src/test/searchWalk.test.ts`:

```ts
import { ageStep, FADE_AFTER_STEPS, removeAfterSteps } from "../utils/searchWalk";

describe("removeAfterSteps", () => {
  it("is 13 by default and 18 for wide viewports", () => {
    expect(removeAfterSteps(false)).toBe(13);
    expect(removeAfterSteps(true)).toBe(18);
  });
});

describe("ageStep", () => {
  it("increments every node's age by 1 per split", () => {
    const next = ageStep([{ id: "a", age: 0 }, { id: "b", age: 6 }]);
    expect(next).toEqual([{ id: "a", age: 1 }, { id: "b", age: 7 }]);
  });

  it("FADE_AFTER_STEPS is 7", () => {
    expect(FADE_AFTER_STEPS).toBe(7);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/searchWalk.test.ts -t "ageStep|removeAfterSteps"`
Expected: FAIL — exports don't exist yet.

- [ ] **Step 3: Implement**

Append to `src/utils/searchWalk.ts`:

```ts
export const FADE_AFTER_STEPS = 7;
const REMOVE_AFTER_STEPS_DEFAULT = 13;
const REMOVE_AFTER_STEPS_WIDE = 18;

/** 18 at >= 1200px viewports (spec §2), 13 otherwise. */
export function removeAfterSteps(isWideViewport: boolean): number {
  return isWideViewport ? REMOVE_AFTER_STEPS_WIDE : REMOVE_AFTER_STEPS_DEFAULT;
}

export interface AgingNode {
  id: string;
  age: number;
}

/** Advances every node's age by one split. Caller filters/fades based on the result. */
export function ageStep<T extends AgingNode>(nodes: T[]): T[] {
  return nodes.map((n) => ({ ...n, age: n.age + 1 }));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/test/searchWalk.test.ts`
Expected: PASS (full file)

- [ ] **Step 5: Commit**

```bash
git add src/utils/searchWalk.ts src/test/searchWalk.test.ts
git commit -m "feat: add node-aging helpers to searchWalk for fade/prune"
```

---

### Task 6: `placeNames.ts` — decorative map labels

**Files:**
- Create: `src/utils/placeNames.ts`
- Test: `src/test/placeNames.test.ts`

**Interfaces:**
- Produces: `pickPlaceName(used: Set<string>, rand?: () => number): string`. Consumed by `SearchPlane` (Task 10) to label newly-current nodes. **Scoped only to decorative map labels** — not the team-name generator (that's Task 7's `teamNameGenerator.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// src/test/placeNames.test.ts
import { describe, it, expect } from "vitest";
import { pickPlaceName, PLACE_NAMES } from "../utils/placeNames";

describe("pickPlaceName", () => {
  it("returns a name from PLACE_NAMES", () => {
    const name = pickPlaceName(new Set());
    expect(PLACE_NAMES).toContain(name);
  });

  it("avoids names already in the `used` set when an unused one exists", () => {
    const used = new Set(PLACE_NAMES.slice(0, PLACE_NAMES.length - 1));
    const name = pickPlaceName(used);
    expect(name).toBe(PLACE_NAMES[PLACE_NAMES.length - 1]);
  });

  it("falls back to a repeat once every name is used", () => {
    const used = new Set(PLACE_NAMES);
    const name = pickPlaceName(used);
    expect(PLACE_NAMES).toContain(name);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/placeNames.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

```ts
// src/utils/placeNames.ts
/**
 * Decorative, fictional place-name labels for SearchPlane's procedural
 * attract animation (e.g. the "search" mode label on a newly-current node).
 * Not real locations, and not the team-name generator — see teamNameGenerator.ts.
 */
export const PLACE_NAMES = [
  "Old Market", "Station Square", "Canal Bridge", "The Windmill",
  "North Gate", "Garden Court", "Merchant Row", "Clocktower",
  "Riverside Walk", "The Arcade", "Chapel Lane", "Harbor View",
  "Founders Square", "The Promenade", "Mill Corner", "East Bastion",
  "Wall Walk", "Crumbly Castle", "Fearsome Fortress", "Marvelous Mall",
  "Art District", "Breakaway Beach", "Middle Park", "Statue Square",
  "Famous Building", "Slightly less Famous Building"
];

/** Picks an unused name if one exists, otherwise a random repeat. */
export function pickPlaceName(used: Set<string>, rand: () => number = Math.random): string {
  const unused = PLACE_NAMES.filter((n) => !used.has(n));
  const pool = unused.length > 0 ? unused : PLACE_NAMES;
  return pool[Math.floor(rand() * pool.length) % pool.length];
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/test/placeNames.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/placeNames.ts src/test/placeNames.test.ts
git commit -m "feat: add placeNames decorative label generator for SearchPlane"
```

---

### Task 7: Extend `teamNameGenerator.ts` with optional project-seeded nouns

**Files:**
- Modify: `src/utils/teamNameGenerator.ts`
- Modify/Create: `src/test/teamNameGenerator.test.ts` (create if it doesn't already exist — check with `ls src/test | grep -i teamName`)

**Interfaces:**
- Produces: `generateTeamName(seedNouns?: string[]): string` — same name, now optionally accepts a second noun pool; existing zero-arg callers (none currently take an argument) are unaffected. Consumed by `TeamSetupPage` (Task 18).

- [ ] **Step 1: Write the failing test**

```ts
// src/test/teamNameGenerator.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { generateTeamName, TEAM_NAME_ADJECTIVES, TEAM_NAME_NOUNS } from "../utils/teamNameGenerator";

describe("generateTeamName", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns 'Adjective Noun' from the default global lists with no argument", () => {
    const name = generateTeamName();
    const [adjective, noun] = name.split(" ");
    expect(TEAM_NAME_ADJECTIVES).toContain(adjective);
    expect(TEAM_NAME_NOUNS).toContain(noun);
  });

  it("draws the noun from seedNouns when provided and non-empty", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const name = generateTeamName(["Vredespaleis", "Binnenhof"]);
    expect(name.endsWith("Vredespaleis")).toBe(true);
  });

  it("falls back to the global noun list when seedNouns is empty", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const name = generateTeamName([]);
    const [, noun] = name.split(" ");
    expect(TEAM_NAME_NOUNS).toContain(noun);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/teamNameGenerator.test.ts`
Expected: FAIL — `generateTeamName` doesn't accept an argument, second test's assertion fails.

- [ ] **Step 3: Implement**

Replace the existing `generateTeamName` function body in `src/utils/teamNameGenerator.ts`:

```ts
export function generateTeamName(seedNouns?: string[]): string {
  const adjective =
    TEAM_NAME_ADJECTIVES[Math.floor(Math.random() * TEAM_NAME_ADJECTIVES.length)];
  const nounPool = seedNouns && seedNouns.length > 0 ? seedNouns : TEAM_NAME_NOUNS;
  const noun = nounPool[Math.floor(Math.random() * nounPool.length)];
  return `${adjective} ${noun}`;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/test/teamNameGenerator.test.ts`
Expected: PASS

- [ ] **Step 5: Run the existing `JoinTeamPage`/callers' tests to confirm no regression**

Run: `npx vitest run -t "teamName"`
Expected: PASS (no existing caller passes an argument, so behavior is unchanged for them)

- [ ] **Step 6: Commit**

```bash
git add src/utils/teamNameGenerator.ts src/test/teamNameGenerator.test.ts
git commit -m "feat: allow generateTeamName to draw nouns from a project-seeded list"
```

---

### Task 8: `huntSummary.ts` — resolve a project to a single known route, when possible

**Files:**
- Create: `src/utils/huntSummary.ts`
- Test: `src/test/huntSummary.test.ts`

**Interfaces:**
- Consumes: `loadText` (`src/utils/loadText.ts`), `loadLocations` (`src/utils/loadLocations.ts`), `locationTotal` (`src/utils/routeEntries.ts`), types `CitiesText`, `RoutesData`, `Coordinates` (`src/types/data.ts`).
- Produces: `haversineMeters(a: Coordinates, b: Coordinates): number`, `resolveHuntSummary(project: string, lang: string): Promise<HuntSummary | null>`, `interface HuntSummary { cityId: string; routeId: string; stopCount: number; distanceMeters: number | null; durationMinutes: number }`. Consumed by `JoinSheet` (Task 17, for stat chips) and `TeamSetupPage` (Task 18, for the auto-skip navigation decision).

- [ ] **Step 1: Write the failing tests**

```ts
// src/test/huntSummary.test.ts
import { describe, it, expect, vi } from "vitest";
import { haversineMeters, resolveHuntSummary } from "../utils/huntSummary";

describe("haversineMeters", () => {
  it("returns ~0 for identical points", () => {
    const p = { latitude: 52.0799, longitude: 4.3133 };
    expect(haversineMeters(p, p)).toBeCloseTo(0, 1);
  });

  it("returns a plausible distance for two known Den Haag points (~800m apart)", () => {
    const a = { latitude: 52.0799, longitude: 4.3133 }; // Binnenhof
    const b = { latitude: 52.085, longitude: 4.3007 }; // Vredespaleis, roughly
    const d = haversineMeters(a, b);
    expect(d).toBeGreaterThan(500);
    expect(d).toBeLessThan(1500);
  });
});

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn(),
}));
vi.mock("../utils/loadLocations", () => ({
  loadLocations: vi.fn(),
}));

import { loadText } from "../utils/loadText";
import { loadLocations } from "../utils/loadLocations";

describe("resolveHuntSummary", () => {
  it("returns null when the project has more than one city", async () => {
    vi.mocked(loadText).mockResolvedValueOnce({
      items: [{ id: "den_haag", name: "Den Haag" }, { id: "amsterdam", name: "Amsterdam" }],
    } as any);
    const result = await resolveHuntSummary("democrats_abroad", "en");
    expect(result).toBeNull();
  });

  it("returns null when the single city has more than one route", async () => {
    vi.mocked(loadText)
      .mockResolvedValueOnce({ items: [{ id: "den_haag", name: "Den Haag" }] } as any)
      .mockResolvedValueOnce({
        short_loop: { description: "short", locations: ["001_loc_a"] },
        extended_route: { description: "long", locations: ["001_loc_a", "002_loc_b"] },
      } as any);
    const result = await resolveHuntSummary("democrats_abroad", "en");
    expect(result).toBeNull();
  });

  it("returns a summary when exactly one city and one route exist", async () => {
    vi.mocked(loadText)
      .mockResolvedValueOnce({ items: [{ id: "den_haag", name: "Den Haag" }] } as any)
      .mockResolvedValueOnce({
        short_loop: { description: "short", locations: ["001_loc_a", "002_loc_b"] },
      } as any);
    vi.mocked(loadLocations).mockResolvedValueOnce([
      { coordinates: { latitude: 52.0799, longitude: 4.3133 } },
      { coordinates: { latitude: 52.085, longitude: 4.3007 } },
    ] as any);
    const result = await resolveHuntSummary("democrats_abroad", "en");
    expect(result).toEqual({
      cityId: "den_haag",
      routeId: "short_loop",
      stopCount: 2,
      distanceMeters: expect.any(Number),
      durationMinutes: 24, // 2 stops * 12 min/stop
    });
  });

  it("returns distanceMeters: null when any stop is missing coordinates, without dropping stopCount", async () => {
    vi.mocked(loadText)
      .mockResolvedValueOnce({ items: [{ id: "den_haag", name: "Den Haag" }] } as any)
      .mockResolvedValueOnce({
        short_loop: { description: "short", locations: ["001_loc_a", "002_loc_b"] },
      } as any);
    vi.mocked(loadLocations).mockResolvedValueOnce([
      { coordinates: { latitude: 52.0799, longitude: 4.3133 } },
      {}, // no coordinates
    ] as any);
    const result = await resolveHuntSummary("democrats_abroad", "en");
    expect(result?.distanceMeters).toBeNull();
    expect(result?.stopCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/huntSummary.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

```ts
// src/utils/huntSummary.ts
import { loadText } from "./loadText";
import { loadLocations } from "./loadLocations";
import type { CitiesText, RoutesData, Coordinates } from "../types/data";

const MINUTES_PER_STOP = 12;
const EARTH_RADIUS_METERS = 6371000;

export interface HuntSummary {
  cityId: string;
  routeId: string;
  stopCount: number;
  distanceMeters: number | null;
  durationMinutes: number;
}

/** Great-circle distance between two lat/long points, in meters. */
export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/**
 * Resolves a project to hunt-level stats — but only when it unambiguously
 * has exactly one city and that city has exactly one route. Otherwise
 * returns null: the caller (JoinSheet, TeamSetupPage) falls back to the
 * existing city/route picker screens rather than guessing.
 */
export async function resolveHuntSummary(
  project: string,
  lang: string,
): Promise<HuntSummary | null> {
  const cities = await loadText<CitiesText>(lang, `projects/${project}/cities`);
  if (!cities || cities.items.length !== 1) {
    return null;
  }
  const cityId = cities.items[0].id;

  const routes = await loadText<RoutesData>(lang, `projects/${project}/${cityId}/routes`);
  const routeIds = routes ? Object.keys(routes) : [];
  if (routeIds.length !== 1) {
    return null;
  }
  const routeId = routeIds[0];
  const route = routes![routeId];

  const locationPaths = route.locations.map((id) => `projects/${project}/${cityId}/${id}`);
  const entries = await loadLocations(lang, locationPaths);
  const stopCount = entries.length;

  const coords = entries
    .map((e) => (e as { coordinates?: Coordinates }).coordinates)
    .filter((c): c is Coordinates => !!c);

  const distanceMeters =
    coords.length === entries.length && coords.length > 1
      ? coords.slice(1).reduce((sum, c, i) => sum + haversineMeters(coords[i], c), 0)
      : null;

  return {
    cityId,
    routeId,
    stopCount,
    distanceMeters,
    durationMinutes: stopCount * MINUTES_PER_STOP,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/test/huntSummary.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/huntSummary.ts src/test/huntSummary.test.ts
git commit -m "feat: add huntSummary — resolves a project to route stats only when unambiguous"
```

---

## Phase 3 — `AppForm` extension

### Task 9: `random_value` gains `reroll`/`editable` (both default `false`)

**Files:**
- Modify: `src/types/data.ts:18-32` (`FormField` interface)
- Modify: `src/data/schemas/form.schema.json` (properties)
- Modify: `src/utils/loadLocations.ts` (`KNOWN_FORM_FIELD_KEYS`, around line 16-30)
- Modify: `src/components/AppForm.svelte:761-780` (`random_value` render branch)
- Modify: `src/test/AppForm.test.ts` (add new tests near the existing `random_value` block, ~line 1049-1207)
- Modify: `src/test/loadText.test.ts` or wherever `KNOWN_FORM_FIELD_KEYS` validation is tested (search `grep -rn "KNOWN_FORM_FIELD_KEYS\|schema_error" src/test` to find it first)

**Interfaces:**
- Produces: `FormField.reroll?: boolean`, `FormField.editable?: boolean` (both optional, undefined treated as `false`). No change to any existing field's rendered output when absent.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/AppForm.test.ts`, directly after the existing `"random_value: rolled value is passed to onSubmit"` test (~line 1121):

```ts
test("random_value: existing usage without reroll/editable behaves exactly as before (no reroll button, locked once picked)", () => {
  const fields: FormField[] = [
    { id: "assigned_child", type: "random_value" as FormFieldType, label: "Reveal", values: ["Alpha"] },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.queryByLabelText(/suggest another/i)).not.toBeInTheDocument();
});

test("random_value: reroll true renders a dice button that replaces the picked value", async () => {
  const fields: FormField[] = [
    {
      id: "assigned_child",
      type: "random_value" as FormFieldType,
      label: "Team name",
      values: ["Alpha", "Beta", "Gamma"],
      reroll: true,
    },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  // reroll fields auto-pick a value on mount rather than waiting for a first tap —
  // team setup wants a prefilled field, never an empty one (spec §8.2)
  const before = screen.getByTestId("random-value-result").textContent;
  await fireEvent.click(screen.getByRole("button", { name: /suggest another/i }));
  const after = screen.getByTestId("random-value-result").textContent;
  expect(["Alpha", "Beta", "Gamma"]).toContain(after);
  expect(before).not.toBeNull();
});

test("random_value: editable true renders a text input seeded with the picked value instead of static text", () => {
  const fields: FormField[] = [
    {
      id: "assigned_child",
      type: "random_value" as FormFieldType,
      label: "Team name",
      values: ["Alpha"],
      editable: true,
    },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByLabelText("Team name")).toHaveValue("Alpha");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/AppForm.test.ts -t "reroll|editable|behaves exactly as before"`
Expected: FAIL — `reroll`/`editable` aren't recognized types on `FormField`, and `AppForm.svelte` doesn't render a dice button or input for `random_value`.

- [ ] **Step 3: Update `FormField` type**

In `src/types/data.ts`, add to the `FormField` interface:

```ts
  reroll?: boolean;
  editable?: boolean;
```

- [ ] **Step 4: Update `form.schema.json`**

Add to the `properties` object:

```json
      "reroll":   { "type": "boolean" },
      "editable": { "type": "boolean" }
```

- [ ] **Step 5: Add the two keys to `KNOWN_FORM_FIELD_KEYS` in `loadLocations.ts`**

```ts
const KNOWN_FORM_FIELD_KEYS = new Set([
  "id", "type", "label", "subtext", "options", "values", "min", "max",
  "isRequired", "value", "storeDefaultValue", "config", "source",
  "reroll", "editable",
]);
```

- [ ] **Step 6: Update the `random_value` render branch in `AppForm.svelte`**

Replace the existing branch (lines 761-780):

```svelte
          {:else if field.type === "random_value"}
            {@const picked = values[id] as string | undefined}
            {@const options = field.values ?? []}
            {#if field.editable}
              <input
                id={domId}
                type="text"
                value={picked ?? ""}
                oninput={(e) => { values[id] = (e.target as HTMLInputElement).value; }}
                class="af-input"
              />
            {:else if picked}
              <p class="af-random-value-result" data-testid="random-value-result">{picked}</p>
            {:else if !field.reroll}
              <button
                type="button"
                class="af-random-value-btn"
                disabled={options.length === 0}
                onclick={() => {
                  if (options.length > 0) {
                    values[id] = options[Math.floor(Math.random() * options.length)];
                  }
                }}
              >
                <Dice5 size={18} aria-hidden="true" />
                Reveal a name
              </button>
            {/if}
            {#if field.reroll}
              {#if !picked}
                {@const _ = (values[id] = options[Math.floor(Math.random() * options.length)])}
              {/if}
              <button
                type="button"
                onclick={() => {
                  if (options.length > 0) {
                    values[id] = options[Math.floor(Math.random() * options.length)];
                  }
                }}
                aria-label="Suggest another name"
                class="af-random-value-reroll-btn"
              >
                <Dice5 size={20} aria-hidden="true" />
              </button>
            {/if}
          {/if}
```

Note: the `{@const _ = (values[id] = ...)}` auto-pick-on-mount trick is intentionally explicit rather than hidden in an `$effect`, matching this component's existing style of doing field-local state updates directly in the template (see the `image-picker`/`coord-picker` branches above it). If `editable` and `reroll` are both `true`, the input renders (per the branch order above) and the reroll button still appears below it, letting the participant either type or roll — this matches TeamSetupPage's need for a prefilled-but-changeable field with a dice button (spec §8.2).

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/test/AppForm.test.ts`
Expected: PASS (including all pre-existing `random_value` tests — confirms `reroll`/`editable` default `false` and don't touch existing behavior)

- [ ] **Step 8: Locate and extend the `KNOWN_FORM_FIELD_KEYS`/schema regression test**

Run: `grep -rn "KNOWN_FORM_FIELD_KEYS\|lineCount" src/test/loadText.test.ts` to find the existing pattern used for the `config`/`lineCount` addition (devlog 29/07/2026 mentions 5 tests covering this pattern for a prior field addition). Add matching tests asserting `reroll`/`editable` pass through without producing a `schema_error` sentinel, and that an unknown extra key still does.

- [ ] **Step 9: Run full suite, lint, typecheck, YAML validation**

Run: `npm test && npm run lint && npx svelte-check && npm run validate:yaml`
Expected: all green — `003_form_jewish_children_museum.yaml` is untouched and still validates/renders identically since it sets neither `reroll` nor `editable`.

- [ ] **Step 10: Commit**

```bash
git add src/types/data.ts src/data/schemas/form.schema.json src/utils/loadLocations.ts src/components/AppForm.svelte src/test/AppForm.test.ts src/test/loadText.test.ts
git commit -m "feat: add optional reroll/editable to random_value fields, defaulting false"
```

---

## Phase 4 — `SearchPlane`

### Task 10: `SearchPlane` — structure, layers, grid, frozen mode

**Files:**
- Create: `src/components/SearchPlane.svelte`, `src/components/SearchPlane.css`
- Test: `src/test/SearchPlane.test.ts`

**Interfaces:**
- Consumes: `$themeStore` (for `--search-*` tokens and `theme.intro`), tokens from Task 3.
- Produces: `SearchPlane` Svelte component, props `{ mode: 'search' | 'route' | 'frozen'; anchor: number; route?: Stop[]; paused?: boolean }` where `Stop = { id: string }` (route mode's minimal shape — Task 12 extends this once `TeamSetupPage`/`JoinSheet` need real stop data). Consumed by `LandingPage` (Task 13), `JoinSheet` (Task 17), `TeamSetupPage` (Task 18).

This task covers the static parts only: DOM structure/z-order (spec §5.2), the infinite grid (§5.3), and `mode: 'frozen'` (§5.6, one pre-generated tree with no transitions). The animated `search`/`route` modes are Task 11.

- [ ] **Step 1: Write the failing tests**

```ts
// src/test/SearchPlane.test.ts
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte/svelte5";
import SearchPlane from "../components/SearchPlane.svelte";

describe("SearchPlane structure", () => {
  it("renders the four layers (grid, world, pins, labels) as plane children", () => {
    const { container } = render(SearchPlane, { props: { mode: "frozen", anchor: 64 } });
    const plane = container.querySelector(".search-plane__plane");
    expect(plane?.querySelector(".search-plane__grid")).not.toBeNull();
    expect(plane?.querySelector(".search-plane__world")).not.toBeNull();
    expect(plane?.querySelector(".search-plane__pins")).not.toBeNull();
    expect(plane?.querySelector(".search-plane__labels")).not.toBeNull();
  });

  it("positions the plane at the given anchor percentage", () => {
    const { container } = render(SearchPlane, { props: { mode: "frozen", anchor: 46 } });
    const plane = container.querySelector(".search-plane__plane") as HTMLElement;
    expect(plane.style.top).toBe("46%");
  });

  it("frozen mode renders a settled tree with no rAF loop and a lit head node", () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");
    const { container } = render(SearchPlane, { props: { mode: "frozen", anchor: 64 } });
    expect(rafSpy).not.toHaveBeenCalled();
    expect(container.querySelector(".search-plane__node--active")).not.toBeNull();
    rafSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/SearchPlane.test.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement `SearchPlane.svelte`**

```svelte
<script lang="ts">
  import { themeStore } from "../stores/themeStore";
  import "./SearchPlane.css";

  export interface Stop {
    id: string;
  }

  let {
    mode,
    anchor,
    route,
    paused = false,
  }: {
    mode: "search" | "route" | "frozen";
    anchor: number;
    route?: Stop[];
    paused?: boolean;
  } = $props();

  // A single deterministic pre-generated tree for `frozen` mode (spec §5.6):
  // no timers, no randomness, drawn once, fully settled.
  const FROZEN_NODES = [
    { id: "n0", x: 0, y: 0, active: false },
    { id: "n1", x: 40, y: -80, active: false },
    { id: "n2", x: -30, y: -150, active: false },
    { id: "n3", x: 10, y: -230, active: true },
  ];
  const FROZEN_EDGES = [
    { id: "e0", x1: 0, y1: 0, x2: 40, y2: -80 },
    { id: "e1", x1: 40, y1: -80, x2: -30, y2: -150 },
    { id: "e2", x1: -30, y1: -150, x2: 10, y2: -230 },
  ];
</script>

<div class="search-plane" aria-hidden="true">
  <div class="search-plane__plane" style={`top: ${anchor}%;`}>
    <div class="search-plane__grid"></div>
    <div class="search-plane__world">
      {#if mode === "frozen"}
        {#each FROZEN_EDGES as edge (edge.id)}
          <div
            class="search-plane__edge search-plane__edge--visited"
            style={`left:${edge.x1}px; top:${edge.y1}px; width:${Math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1)}px; transform: rotate(${Math.atan2(edge.y2 - edge.y1, edge.x2 - edge.x1)}rad);`}
          ></div>
        {/each}
        {#each FROZEN_NODES as node (node.id)}
          <div
            class={`search-plane__node${node.active ? " search-plane__node--active" : ""}`}
            style={`left:${node.x}px; top:${node.y}px;`}
          ></div>
        {/each}
      {/if}
    </div>
    <div class="search-plane__pins"></div>
    <div class="search-plane__labels"></div>
  </div>
</div>
```

```css
/* src/components/SearchPlane.css */
.search-plane {
  position: absolute;
  inset: 0;
  overflow: hidden;
  perspective: 520px;
  perspective-origin: 50% 22%;
  pointer-events: none;
}

.search-plane__plane {
  position: absolute;
  left: 50%;
  transform-style: preserve-3d;
  transform: rotateX(58deg);
}

.search-plane__grid {
  position: absolute;
  width: 1700px;
  height: 1700px;
  left: -850px;
  top: -850px;
  background-image:
    repeating-linear-gradient(0deg, var(--search-grid) 0 1px, transparent 1px 46px),
    repeating-linear-gradient(90deg, var(--search-grid) 0 1px, transparent 1px 46px);
  mask-image: radial-gradient(
    circle at 50% 50%,
    #000 0%,
    #000 var(--search-fade-solid, 11%),
    transparent var(--search-fade-edge, 40%)
  );
  transform: translateZ(0);
}

.search-plane__world,
.search-plane__pins,
.search-plane__labels {
  position: absolute;
  left: 0;
  top: 0;
}

.search-plane__world {
  transform: translateZ(0);
}

.search-plane__pins {
  transform: translateZ(2px);
}

.search-plane__labels {
  transform: translateZ(4px);
}

.search-plane__node {
  position: absolute;
  width: 10px;
  height: 10px;
  margin: -5px;
  border-radius: 50%;
  background: var(--search-node);
}

.search-plane__node--active {
  background: var(--search-node-active);
  box-shadow: 0 0 0 8px var(--search-node-halo);
}

.search-plane__edge {
  position: absolute;
  height: 2px;
  background: var(--search-edge);
  transform-origin: 0 50%;
}

.search-plane__edge--visited {
  background: var(--search-edge-visited);
}

.search-plane__edge--active {
  background: var(--search-edge-active);
}

@media (min-width: 720px) {
  .search-plane__grid { --search-fade-solid: 14%; --search-fade-edge: 46%; }
}
@media (min-width: 1200px) {
  .search-plane__grid { --search-fade-solid: 18%; --search-fade-edge: 54%; }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/test/SearchPlane.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchPlane.svelte src/components/SearchPlane.css src/test/SearchPlane.test.ts
git commit -m "feat: add SearchPlane structure, grid, and frozen mode"
```

---

### Task 11: `SearchPlane` — animated `search` mode (rAF loop, pause, lifecycle)

**Files:**
- Modify: `src/components/SearchPlane.svelte`, `src/components/SearchPlane.css`
- Modify: `src/test/SearchPlane.test.ts`

**Interfaces:**
- Consumes: `searchWalk.ts`'s `pickChildCount`, `computeChildHeadings`, `edgeLength`, `splitDurationMs`, `lerpCamera`, `ageStep`, `removeAfterSteps`, `FADE_AFTER_STEPS` (Tasks 4-5); `placeNames.ts`'s `pickPlaceName` (Task 6).
- Produces: live `search` mode behavior; `paused` prop honored (no new split scheduled, in-flight timers still complete); rAF + timers cleared on `visibilitychange` (hidden) and component destroy.

- [ ] **Step 1: Write the failing tests**

```ts
// append to src/test/SearchPlane.test.ts
import { fireEvent } from "@testing-library/svelte/svelte5";

describe("SearchPlane search mode", () => {
  it("starts a requestAnimationFrame loop when mode is search and not paused", () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    render(SearchPlane, { props: { mode: "search", anchor: 64, paused: false } });
    expect(rafSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
  });

  it("does not schedule a new split while paused, but keeps the rAF loop for camera easing", () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    render(SearchPlane, { props: { mode: "search", anchor: 64, paused: true } });
    vi.advanceTimersByTime(5000);
    // No split-related timers should have fired to grow new nodes
    const growCalls = setTimeoutSpy.mock.calls.length;
    expect(growCalls).toBe(0);
    vi.useRealTimers();
  });

  it("stops the rAF loop and clears timers on unmount", () => {
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = render(SearchPlane, { props: { mode: "search", anchor: 64 } });
    unmount();
    expect(cancelSpy).toHaveBeenCalled();
  });

  it("stops the rAF loop when the document becomes hidden", () => {
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");
    render(SearchPlane, { props: { mode: "search", anchor: 64 } });
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cancelSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/SearchPlane.test.ts -t "search mode"`
Expected: FAIL — no rAF loop exists yet in the component.

- [ ] **Step 3: Implement**

Add to the `<script>` block of `SearchPlane.svelte`:

```svelte
<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    HEAD_ANGLE, pickChildCount, computeChildHeadings, edgeLength,
    splitDurationMs, lerpCamera, ageStep, removeAfterSteps, FADE_AFTER_STEPS,
  } from "../utils/searchWalk";
  import { pickPlaceName } from "../utils/placeNames";
  // ... existing imports/props from Task 10 ...

  interface LiveNode { id: string; x: number; y: number; heading: number; age: number; current: boolean; label?: string; }
  interface LiveEdge { id: string; fromId: string; toId: string; state: "growing" | "active" | "visited"; }

  let nodes = $state<LiveNode[]>([{ id: "root", x: 0, y: 0, heading: HEAD_ANGLE, age: 0, current: true }]);
  let edges = $state<LiveEdge[]>([]);
  let camera = { x: 0, y: 0 };
  let cameraTarget = { x: 0, y: 0 };
  let usedLabels = new Set<string>();
  let rafId: number | null = null;
  let splitTimer: ReturnType<typeof setTimeout> | null = null;

  function isWideViewport(): boolean {
    return typeof window !== "undefined" && window.innerWidth >= 1200;
  }

  function scheduleSplit() {
    if (mode !== "search" || paused) return;
    const parent = nodes.find((n) => n.current);
    if (!parent) return;
    const k = pickChildCount();
    const headings = computeChildHeadings(parent.heading, k);
    const children: LiveNode[] = headings.map((heading, i) => {
      const len = edgeLength();
      return {
        id: `${parent.id}-${Date.now()}-${i}`,
        x: parent.x + Math.cos(heading) * len,
        y: parent.y + Math.sin(heading) * len,
        heading,
        age: 0,
        current: false,
      };
    });
    nodes = [...nodes, ...children];
    edges = [
      ...edges,
      ...children.map((c) => ({ id: `edge-${c.id}`, fromId: parent.id, toId: c.id, state: "growing" as const })),
    ];

    const duration = splitDurationMs(k);
    splitTimer = setTimeout(() => {
      if (mode !== "search") return;
      const chosen = children[Math.floor(Math.random() * children.length)];
      nodes = nodes.map((n) => ({ ...n, current: n.id === chosen.id }));
      cameraTarget = { x: chosen.x, y: chosen.y };
      const label = pickPlaceName(usedLabels);
      usedLabels.add(label);
      nodes = nodes.map((n) => (n.id === chosen.id ? { ...n, label } : n));
      edges = edges.map((e) => (e.toId === chosen.id ? { ...e, state: "active" } : e));
      nodes = ageStep(nodes as (LiveNode & { age: number })[]) as LiveNode[];
      const limit = removeAfterSteps(isWideViewport());
      nodes = nodes.filter((n) => n.current || n.age < limit);
      setTimeout(() => {
        edges = edges.map((e) => (e.toId === chosen.id ? { ...e, state: "visited" } : e));
        scheduleSplit();
      }, 1300);
    }, duration + 250);
  }

  function frame() {
    camera = lerpCamera(camera, cameraTarget);
    rafId = requestAnimationFrame(frame);
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (splitTimer !== null) {
      clearTimeout(splitTimer);
      splitTimer = null;
    }
  }

  function start() {
    if (mode !== "search") return;
    rafId = requestAnimationFrame(frame);
    scheduleSplit();
  }

  function handleVisibility() {
    if (document.visibilityState === "hidden") {
      stop();
    } else if (mode === "search") {
      start();
    }
  }

  $effect(() => {
    if (mode === "search") {
      start();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stop();
    };
  });

  onDestroy(stop);
</script>
```

Add fade styling driven by `FADE_AFTER_STEPS` to `SearchPlane.css`:

```css
.search-plane__node--fading {
  opacity: 0.3;
  transition: opacity 400ms ease-out;
}
```

And in the template's `world` layer (replacing the Task 10 static-only branch with a live one when `mode === "search"`), render `nodes`/`edges` the same way as the frozen branch but keyed to live state, adding `search-plane__node--fading` when `node.age >= FADE_AFTER_STEPS` and `search-plane__node--active` when `node.current`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/test/SearchPlane.test.ts`
Expected: PASS

- [ ] **Step 5: Manual verification note**

This component is inherently visual — the automated tests above cover lifecycle correctness (rAF starts/stops, pause behavior, cleanup) but not the actual look of the animation. Per this project's rule, do not use Playwright or any browser automation to verify it; the user will check it visually via `npm run dev`.

- [ ] **Step 6: Run full suite, lint, typecheck**

Run: `npm test && npm run lint && npx svelte-check`
Expected: all green

- [ ] **Step 7: Commit**

```bash
git add src/components/SearchPlane.svelte src/components/SearchPlane.css src/test/SearchPlane.test.ts
git commit -m "feat: animate SearchPlane search mode with pause and lifecycle cleanup"
```

---

### Task 12: `SearchPlane` — `route` mode

**Files:**
- Modify: `src/components/SearchPlane.svelte`, `src/components/SearchPlane.css`
- Modify: `src/test/SearchPlane.test.ts`

**Interfaces:**
- Consumes: `route: Stop[]` prop, where `Stop = { id: string }` (Task 10's minimal shape is sufficient — route mode only needs a count and order, not real coordinates, per spec §5.5).
- Produces: a static wandering path rendered from `route`, camera anchored on stop 1, labels on first/middle/last stops only.

- [ ] **Step 1: Write the failing tests**

```ts
// append to src/test/SearchPlane.test.ts
describe("SearchPlane route mode", () => {
  const stops = Array.from({ length: 15 }, (_, i) => ({ id: `stop-${i}` }));

  it("renders one node per stop, all active-styled, with edges between consecutive stops", () => {
    const { container } = render(SearchPlane, { props: { mode: "route", anchor: 46, route: stops } });
    expect(container.querySelectorAll(".search-plane__node--active").length).toBe(15);
    expect(container.querySelectorAll(".search-plane__edge--visited").length).toBe(14);
  });

  it("labels only the first, middle, and last stops", () => {
    const { container } = render(SearchPlane, { props: { mode: "route", anchor: 46, route: stops } });
    expect(container.querySelectorAll(".search-plane__label").length).toBe(3);
  });

  it("does not start a rAF loop in route mode (no camera easing needed — anchored on stop 1)", () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");
    render(SearchPlane, { props: { mode: "route", anchor: 46, route: stops } });
    expect(rafSpy).not.toHaveBeenCalled();
    rafSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/SearchPlane.test.ts -t "route mode"`
Expected: FAIL — route rendering doesn't exist yet.

- [ ] **Step 3: Implement**

Add a derived route-path builder to `SearchPlane.svelte`, using the same heading-jitter approach as search mode but with route mode's own parameters (spec §5.5: step length 30-42px, jitter ±0.35 clamped within ±0.8 of straight-ahead):

```svelte
<script lang="ts">
  // ... existing imports ...

  function buildRoutePath(stops: Stop[]): { nodes: LiveNode[]; edges: LiveEdge[] } {
    let heading = HEAD_ANGLE;
    let x = 0, y = 0;
    const routeNodes: LiveNode[] = [];
    const routeEdges: LiveEdge[] = [];
    stops.forEach((stop, i) => {
      if (i > 0) {
        const jitter = (Math.random() * 2 - 1) * 0.35;
        heading = Math.min(HEAD_ANGLE + 0.8, Math.max(HEAD_ANGLE - 0.8, heading + jitter));
        const len = 30 + Math.random() * 12;
        x += Math.cos(heading) * len;
        y += Math.sin(heading) * len;
      }
      const label =
        i === 0 || i === stops.length - 1 || i === Math.floor(stops.length / 2)
          ? `Stop ${i + 1}`
          : undefined;
      routeNodes.push({ id: stop.id, x, y, heading, age: 0, current: true, label });
      if (i > 0) {
        routeEdges.push({ id: `route-edge-${i}`, fromId: stops[i - 1].id, toId: stop.id, state: "visited" });
      }
    });
    return { nodes: routeNodes, edges: routeEdges };
  }

  let routePath = $derived(mode === "route" && route ? buildRoutePath(route) : null);
</script>
```

Wire the template's `world`/`labels` layers to render `routePath.nodes`/`routePath.edges` when `mode === "route"`, each node getting `.search-plane__node--active`, each edge `.search-plane__edge--visited`, and a `.search-plane__label` element in the labels layer for nodes with a `label`. Camera: since route mode is static (not animated per spec §5.5 — "anchored on stop 1"), set `.search-plane__plane`'s `transform` to translate so stop 1 sits at the anchor with no rAF loop — do not call `start()` when `mode === "route"`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/test/SearchPlane.test.ts`
Expected: PASS (full file — structure, frozen, search, and route describe blocks)

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchPlane.svelte src/components/SearchPlane.css src/test/SearchPlane.test.ts
git commit -m "feat: add SearchPlane route mode for a resolved hunt's real stops"
```

---

## Phase 5 — `DepthWordmark`

### Task 13: `DepthWordmark`

**Files:**
- Create: `src/components/DepthWordmark.svelte`, `src/components/DepthWordmark.css`
- Modify: `src/styles/global.css` (add the sheen `@keyframes`)
- Test: `src/test/DepthWordmark.test.ts`

**Interfaces:**
- Consumes: `$themeStore.theme.intro.sheen`.
- Produces: `DepthWordmark` component, props `{ project?: string }` (renders 2 lines when absent, 3 when present). Consumed by `LandingPage` (Task 14), `TeamSetupPage` (Task 18).

- [ ] **Step 1: Write the failing tests**

```ts
// src/test/DepthWordmark.test.ts
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte/svelte5";
import DepthWordmark from "../components/DepthWordmark.svelte";
import { themeStore } from "../stores/themeStore";

describe("DepthWordmark", () => {
  it("renders two lines when no project is given", () => {
    const { container } = render(DepthWordmark, { props: {} });
    expect(container.querySelectorAll(".depth-wordmark__line")).toHaveLength(2);
  });

  it("renders a third, more-indented line when a project is given", () => {
    const { container } = render(DepthWordmark, { props: { project: "Democrats Abroad" } });
    const lines = container.querySelectorAll(".depth-wordmark__line");
    expect(lines).toHaveLength(3);
    expect(lines[2].textContent).toBe("Democrats Abroad");
  });

  it("applies the sheen class only to the deepest visible line", () => {
    themeStore.setThemeName("app"); // intro.sheen: true
    const { container } = render(DepthWordmark, { props: { project: "Democrats Abroad" } });
    const lines = container.querySelectorAll(".depth-wordmark__line");
    expect(lines[0].classList.contains("depth-wordmark__line--sheen")).toBe(false);
    expect(lines[1].classList.contains("depth-wordmark__line--sheen")).toBe(false);
    expect(lines[2].classList.contains("depth-wordmark__line--sheen")).toBe(true);
  });

  it("gates sheen off entirely when intro.sheen is false", () => {
    themeStore.setThemeName("GWC"); // intro.sheen: false
    const { container } = render(DepthWordmark, { props: { project: "Democrats Abroad" } });
    expect(container.querySelector(".depth-wordmark__line--sheen")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/DepthWordmark.test.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement**

```svelte
<!-- src/components/DepthWordmark.svelte -->
<script lang="ts">
  import { themeStore } from "../stores/themeStore";
  import "./DepthWordmark.css";

  let { project }: { project?: string } = $props();

  let sheenEnabled = $derived($themeStore.theme.intro.sheen);
  let lines = $derived(
    project ? ["Searchspace", "Scavenger Hunt", project] : ["Searchspace", "Scavenger Hunt"],
  );
</script>

<div class="depth-wordmark">
  {#each lines as line, i (i)}
    <div
      class={`depth-wordmark__line${i === lines.length - 1 && sheenEnabled ? " depth-wordmark__line--sheen" : ""}`}
      style={`padding-left: ${i * 20}px; animation-delay: ${-i * 2.6}s;`}
    >
      {line}
    </div>
  {/each}
</div>
```

```css
/* src/components/DepthWordmark.css */
.depth-wordmark {
  display: flex;
  flex-direction: column;
}

.depth-wordmark__line {
  font-family: var(--font-family);
  font-size: var(--font-size-display);
  font-weight: 700;
  line-height: 0.98;
  letter-spacing: -0.03em;
  color: var(--color-text);
}

.depth-wordmark__line--sheen {
  background-image: var(--sheen-image);
  background-size: 280% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  animation: depth-wordmark-sheen 13s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .depth-wordmark__line--sheen {
    animation: none;
    background-position: 140% 0;
  }
}
```

Add to `src/styles/global.css`:

```css
@keyframes depth-wordmark-sheen {
  to {
    background-position: 280% 0;
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/test/DepthWordmark.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/DepthWordmark.svelte src/components/DepthWordmark.css src/styles/global.css src/test/DepthWordmark.test.ts
git commit -m "feat: add DepthWordmark with theme-gated sheen"
```

---

## Phase 6 — `LandingPage`

### Task 14: `LandingPage`

**Files:**
- Create: `src/pages/LandingPage.svelte`, `src/pages/LandingPage.css`
- Test: `src/test/LandingPage.test.ts`

**Interfaces:**
- Consumes: `SearchPlane` (Task 10-12), `DepthWordmark` (Task 13), `WideButton` (existing), `titleBarStore`, `$themeStore.theme.intro.motion`.
- Produces: `LandingPage` component. Takes no route params directly — the sheet-open/resolved states are owned by `JoinSheet` (Task 17), which `LandingPage` hosts and controls via local `$state` driven by the current route (wired in Task 19).

- [ ] **Step 1: Write the failing tests**

```ts
// src/test/LandingPage.test.ts
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte/svelte5";
import LandingPage from "../pages/LandingPage.svelte";

describe("LandingPage", () => {
  it("renders the two-line wordmark, sub-line, and primary CTA on first paint", () => {
    render(LandingPage, { props: {} });
    expect(screen.getByText("Searchspace")).toBeInTheDocument();
    expect(screen.getByText("Scavenger Hunt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start hunting/i })).toBeInTheDocument();
  });

  it("renders the three nav items with icon-above-label", () => {
    render(LandingPage, { props: {} });
    expect(screen.getByText("Gallery")).toBeInTheDocument();
    expect(screen.getByText("Past hunts")).toBeInTheDocument();
    expect(screen.getByText("Self-host")).toBeInTheDocument();
  });

  it("the primary CTA is never disabled, even before the background animation has produced any nodes", () => {
    render(LandingPage, { props: {} });
    expect(screen.getByRole("button", { name: /start hunting/i })).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/LandingPage.test.ts`
Expected: FAIL — page doesn't exist.

- [ ] **Step 3: Implement**

```svelte
<!-- src/pages/LandingPage.svelte -->
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { themeStore } from "../stores/themeStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import SearchPlane from "../components/SearchPlane.svelte";
  import DepthWordmark from "../components/DepthWordmark.svelte";
  import "./LandingPage.css";

  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });

  let theme = $derived($themeStore.theme);
</script>

<div class="landing-page">
  <SearchPlane mode={theme.intro.motion === "none" ? "frozen" : theme.intro.motion === "static" ? "frozen" : "search"} anchor={64} />
  <div class="landing-page__fog"></div>
  <div class="landing-page__content">
    <DepthWordmark />
    <p class="landing-page__sub">
      Discover the city <strong class="landing-page__sub-accent">together</strong>, one clue at a time.
    </p>
  </div>
  <div class="landing-page__scrim"></div>
  <div class="landing-page__controls">
    <button
      type="button"
      class={`landing-page__cta landing-page__cta--${theme.defaultButtonColor}`}
      onclick={() => push("/start")}
    >
      Start hunting
    </button>
    <nav class="landing-page__nav">
      <button type="button" class="landing-page__nav-item">Gallery</button>
      <button type="button" class="landing-page__nav-item">Past hunts</button>
      <button type="button" class="landing-page__nav-item">Self-host</button>
    </nav>
  </div>
</div>
```

Note: `WideButton` (`src/components/WideButton.svelte`) was deliberately **not** reused here — it requires non-optional `project`/`cityId` props and a `target: WideButtonTarget` resolved via `resolvePageUrl` (built for the completion screen's data-driven navigation buttons), neither of which fits a plain "push to `/start`" CTA before any project is known. A plain button styled off `theme.defaultButtonColor` (the same token `WideButton` itself resolves its colour from) keeps the same visual language without forcing an ill-fitting prop shape.

```css
/* src/pages/LandingPage.css */
.landing-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.landing-page__content {
  position: relative;
  z-index: 1;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--gap-section) var(--gap-block) 0;
}

.landing-page__sub {
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
}

.landing-page__sub-accent {
  color: var(--color-accent);
  font-weight: 700;
}

.landing-page__fog {
  position: absolute;
  inset: 0 0 auto 0;
  height: 40%;
  background: var(--intro-fog);
  pointer-events: none;
}

.landing-page__scrim {
  position: absolute;
  inset: auto 0 0 0;
  height: 45%;
  background: var(--intro-scrim);
  pointer-events: none;
}

.landing-page__controls {
  position: relative;
  z-index: 1;
  margin-top: auto;
  max-width: var(--content-max);
  width: 100%;
  margin-inline: auto;
  padding: 0 var(--gap-block) var(--gap-block);
}

.landing-page__cta {
  display: block;
  width: 100%;
  min-height: var(--field-min-height);
  border: none;
  border-radius: 8px;
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.landing-page__cta--primary {
  background: var(--color-accent);
  color: var(--color-background);
}

.landing-page__cta--secondary {
  background: transparent;
  border: 1px solid var(--color-accent);
  color: var(--color-accent);
}

.landing-page__nav {
  display: flex;
  justify-content: space-around;
  margin-top: var(--gap-block);
}

.landing-page__nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 11px 0;
  min-width: 44px;
  min-height: 44px;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/test/LandingPage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/LandingPage.svelte src/pages/LandingPage.css src/test/LandingPage.test.ts
git commit -m "feat: add LandingPage attract screen"
```

---

## Phase 7 — Join sheet and team setup

### Task 15: `JoinSheet` — `empty`/`checking`/`invalid` states

**Files:**
- Create: `src/components/JoinSheet.svelte`, `src/components/JoinSheet.css`
- Test: `src/test/JoinSheet.test.ts`

**Interfaces:**
- Consumes: `postVerifyCode` (`src/utils/api.ts`). Note: `normalizeCode` (Task 1) is consumed only server-side (Task 2) — the client sends the user's raw trimmed input and relies on the server normalizing both sides for comparison (spec §4.1); the sheet's input only gets a CSS `text-transform: uppercase` for display, no JS-side normalization.
- Produces: `JoinSheet` component, props `{ open: boolean; initialCode?: string; onResolved: (project: string) => void; onJoin: (project: string) => void; onDemo: () => void; onClose: () => void }`. `onResolved` fires once code resolution succeeds (informational — the host doesn't need to navigate on it, see Task 18); `onJoin(project)` fires only when the participant taps "Join this hunt" in the found state (Task 16) — that's the one that should trigger navigation to team setup, carrying the *resolved project id* (not the raw typed code) since that's what `TeamSetupPage` needs. When `initialCode` is non-empty on mount (deep link / QR target, e.g. landing on `#/join/<code>`), the sheet auto-submits immediately rather than flashing the empty state first. Consumed by `LandingPage`'s sheet host (Task 16 finishes wiring the `found` state; Task 18 wires routing).

- [ ] **Step 1: Write the failing tests**

```ts
// src/test/JoinSheet.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import JoinSheet from "../components/JoinSheet.svelte";
import * as api from "../utils/api";

afterEach(() => vi.restoreAllMocks());

function baseProps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    open: true,
    onResolved: vi.fn(),
    onJoin: vi.fn(),
    onDemo: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("JoinSheet — empty state", () => {
  it("disables Find hunt until at least 3 characters are entered", async () => {
    render(JoinSheet, { props: baseProps() });
    const button = screen.getByRole("button", { name: /find hunt/i });
    expect(button).toBeDisabled();
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "ab" } });
    expect(button).toBeDisabled();
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "abc" } });
    expect(button).not.toBeDisabled();
  });

  it("calls onDemo when the demo button is tapped, without calling postVerifyCode", async () => {
    const onDemo = vi.fn();
    const spy = vi.spyOn(api, "postVerifyCode");
    render(JoinSheet, { props: baseProps({ onDemo }) });
    await fireEvent.click(screen.getByRole("button", { name: /try the demo/i }));
    expect(onDemo).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("JoinSheet — checking/invalid states", () => {
  it("shows a busy state on submit and calls postVerifyCode with the raw trimmed input", async () => {
    const spy = vi.spyOn(api, "postVerifyCode").mockImplementation(
      () => new Promise(() => {}), // never resolves — inspect the busy state
    );
    render(JoinSheet, { props: baseProps() });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: " letmein " } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    expect(spy).toHaveBeenCalledWith("letmein");
    expect(screen.getByRole("button", { name: /checking/i })).toBeInTheDocument();
  });

  it("shows an inline, accessible error and does not call onResolved when the code is invalid", async () => {
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: false, error: "Invalid code" });
    const onResolved = vi.fn();
    render(JoinSheet, { props: baseProps({ onResolved }) });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "wrong" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() =>
      expect(screen.getByText("No hunt with that code. Check it with your organiser.")).toBeInTheDocument(),
    );
    const error = screen.getByText("No hunt with that code. Check it with your organiser.");
    expect(error).toHaveAttribute("aria-live", "polite");
    expect(onResolved).not.toHaveBeenCalled();
  });

  it("calls onResolved with the project id on success", async () => {
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    const onResolved = vi.fn();
    render(JoinSheet, { props: baseProps({ onResolved }) });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "letmein" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("democrats_abroad"));
  });

  it("auto-submits immediately when initialCode is set (deep link), without waiting for a form submit", () => {
    const spy = vi.spyOn(api, "postVerifyCode").mockImplementation(() => new Promise(() => {}));
    render(JoinSheet, { props: baseProps({ initialCode: "letmein" }) });
    expect(spy).toHaveBeenCalledWith("letmein");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/JoinSheet.test.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement**

```svelte
<!-- src/components/JoinSheet.svelte -->
<script lang="ts">
  import { postVerifyCode } from "../utils/api";
  import "./JoinSheet.css";

  let {
    open,
    initialCode = "",
    onResolved,
    onJoin,
    onDemo,
    onClose,
  }: {
    open: boolean;
    initialCode?: string;
    onResolved: (project: string) => void;
    onJoin: (project: string) => void;
    onDemo: () => void;
    onClose: () => void;
  } = $props();

  let code = $state(initialCode);
  let status = $state<"empty" | "checking" | "invalid">("empty");
  let error = $state<string | null>(null);

  let canSubmit = $derived(code.trim().length >= 3);

  async function verify(rawCode: string) {
    status = "checking";
    error = null;
    try {
      const trimmed = rawCode.trim();
      const data = await postVerifyCode(trimmed);
      if (data.ok && data.mode === "project" && data.project) {
        onResolved(data.project);
      } else if (data.ok && data.mode === "demo") {
        onDemo();
      } else {
        status = "invalid";
        error = "No hunt with that code. Check it with your organiser.";
      }
    } catch {
      status = "invalid";
      error = "Connection error. Please try again.";
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (!canSubmit) return;
    verify(code);
  }

  // Deep link / QR target (#/join/<code>): resolve immediately on mount
  // rather than making the participant re-submit a code they already typed
  // elsewhere (spec §13: "cold load lands in the found state without
  // flashing the empty sheet"). Runs once — initialCode is a mount-time prop.
  $effect(() => {
    if (initialCode.trim().length >= 3) {
      verify(initialCode);
    }
  });
</script>

<div
  class={`join-sheet${open ? " join-sheet--open" : ""}`}
  role="dialog"
  aria-modal="true"
  aria-hidden={!open}
  inert={!open}
>
    <p class="join-sheet__eyebrow">Join a hunt</p>
    <h2 class="join-sheet__heading">Enter your hunt code</h2>
    <p class="join-sheet__help" id="join-sheet-help">
      Your organiser gave you a code, or it's on the QR you scanned.
    </p>
    <form onsubmit={handleSubmit} class="join-sheet__form">
      <label class="join-sheet__label" for="hunt-code">Hunt code</label>
      <input
        id="hunt-code"
        type="text"
        autocapitalize="off"
        autocomplete="off"
        enterkeyhint="go"
        bind:value={code}
        aria-describedby={error ? "join-sheet-error" : "join-sheet-help"}
        class="join-sheet__input"
      />
      {#if error}
        <p id="join-sheet-error" class="join-sheet__error" aria-live="polite">{error}</p>
      {/if}
      <button type="submit" class="join-sheet__primary" disabled={!canSubmit || status === "checking"}>
        {status === "checking" ? "Checking…" : "Find hunt"}
      </button>
    </form>
    <div class="join-sheet__divider"></div>
    <button type="button" class="join-sheet__demo" onclick={onDemo}>
      No code? Try the demo
    </button>
</div>
```

The sheet is now always in the DOM (needed so `transform: translateY()` can actually transition rather than mount/unmount abruptly) and toggles visibility via the `.join-sheet--open` class plus `inert`/`aria-hidden` when closed — `inert` keeps it unfocusable and unclickable while off-screen without removing it. Update the CSS (Step 3 below) accordingly: the base `.join-sheet` rule becomes the *closed* (off-screen) state, and `.join-sheet--open` is what brings it on-screen.

```css
/* src/components/JoinSheet.css */
.join-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  background: var(--color-surface);
  border-radius: var(--sheet-radius) var(--sheet-radius) 0 0;
  padding: var(--gap-block);
  transform: translateY(100%);
  transition: transform 320ms ease-out;
}

.join-sheet--open {
  transform: translateY(0);
}

.join-sheet__eyebrow {
  font-family: var(--font-map);
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

.join-sheet__input {
  font-family: var(--font-map);
  text-transform: uppercase;
  letter-spacing: 0.2em;
  min-height: var(--field-min-height);
  width: 100%;
  border: 1px solid var(--field-border);
  border-radius: 8px;
  padding: 0 12px;
}

.join-sheet__primary,
.join-sheet__demo {
  min-height: 46px;
  width: 100%;
}

.join-sheet__error {
  color: var(--color-error);
}

@media (min-width: 720px) {
  .join-sheet {
    position: absolute;
    left: 50%;
    bottom: auto;
    top: 50%;
    transform: translate(-50%, calc(-50% + 6px));
    opacity: 0;
    max-width: var(--content-max);
    border-radius: var(--sheet-radius);
    transition: transform 320ms ease-out, opacity 320ms ease-out;
  }
  .join-sheet--open {
    transform: translate(-50%, -50%);
    opacity: 1;
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/test/JoinSheet.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/JoinSheet.svelte src/components/JoinSheet.css src/test/JoinSheet.test.ts
git commit -m "feat: add JoinSheet empty/checking/invalid states"
```

---

### Task 16: `JoinSheet` — `found` state (single-route vs. general case)

**Files:**
- Modify: `src/components/JoinSheet.svelte`, `src/components/JoinSheet.css`
- Modify: `src/test/JoinSheet.test.ts`
- Create: `src/components/HuntSummary.svelte`, `src/components/HuntSummary.css`
- Test: `src/test/HuntSummary.test.ts`

**Interfaces:**
- Consumes: `resolveHuntSummary` (Task 8), `loadText` (for project/city/organiser display text).
- Produces: `HuntSummary` component, props `{ summary: import("../utils/huntSummary").HuntSummary | null; projectName: string; cityLabel: string; organiser: string }` — pure presentational chip row, used inside `JoinSheet`'s found state.

- [ ] **Step 1: Write the failing tests for `HuntSummary`**

```ts
// src/test/HuntSummary.test.ts
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte/svelte5";
import HuntSummary from "../components/HuntSummary.svelte";

describe("HuntSummary", () => {
  it("renders stops/distance/duration chips when a summary is known", () => {
    render(HuntSummary, {
      props: {
        summary: { cityId: "den_haag", routeId: "short_loop", stopCount: 15, distanceMeters: 2400, durationMinutes: 120 },
        projectName: "Democrats Abroad",
        cityLabel: "Den Haag",
        organiser: "Democrats Abroad NL",
      },
    });
    expect(screen.getByText("15 stops")).toBeInTheDocument();
    expect(screen.getByText("2.4 km")).toBeInTheDocument();
    expect(screen.getByText("~2 hours")).toBeInTheDocument();
  });

  it("drops the distance chip when distanceMeters is null, without dropping the others", () => {
    render(HuntSummary, {
      props: {
        summary: { cityId: "den_haag", routeId: "short_loop", stopCount: 15, distanceMeters: null, durationMinutes: 120 },
        projectName: "Democrats Abroad",
        cityLabel: "Den Haag",
        organiser: "Democrats Abroad NL",
      },
    });
    expect(screen.getByText("15 stops")).toBeInTheDocument();
    expect(screen.queryByText(/km/)).not.toBeInTheDocument();
  });

  it("renders no chips at all, and a city-count line instead, when summary is null", () => {
    render(HuntSummary, {
      props: { summary: null, projectName: "Democrats Abroad", cityLabel: "3 cities", organiser: "Democrats Abroad NL" },
    });
    expect(screen.queryByText(/stops/)).not.toBeInTheDocument();
    expect(screen.getByText(/3 cities/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/HuntSummary.test.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement `HuntSummary.svelte`**

```svelte
<!-- src/components/HuntSummary.svelte -->
<script lang="ts">
  import type { HuntSummary as Summary } from "../utils/huntSummary";
  import "./HuntSummary.css";

  let { summary, projectName, cityLabel, organiser }: {
    summary: Summary | null;
    projectName: string;
    cityLabel: string;
    organiser: string;
  } = $props();

  function formatDistance(m: number): string {
    return `${(m / 1000).toFixed(1)} km`;
  }
  function formatDuration(minutes: number): string {
    const hours = minutes / 60;
    return `~${hours % 1 === 0 ? hours : hours.toFixed(1)} hours`;
  }
</script>

<h2 class="hunt-summary__title">{projectName}</h2>
<p class="hunt-summary__help">
  {cityLabel} · hosted by {organiser}
</p>
{#if summary}
  <div class="hunt-summary__chips">
    <span class="hunt-summary__chip">{summary.stopCount} stops</span>
    {#if summary.distanceMeters !== null}
      <span class="hunt-summary__chip">{formatDistance(summary.distanceMeters)}</span>
    {/if}
    <span class="hunt-summary__chip">{formatDuration(summary.durationMinutes)}</span>
  </div>
{/if}
```

```css
/* src/components/HuntSummary.css */
.hunt-summary__chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: var(--gap-field);
}

.hunt-summary__chip {
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 4px 12px;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
```

- [ ] **Step 4: Run to verify `HuntSummary` passes**

Run: `npx vitest run src/test/HuntSummary.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing `JoinSheet` found-state tests**

Add to `src/test/JoinSheet.test.ts`:

```ts
import * as huntSummaryApi from "../utils/huntSummary";
import * as loadTextApi from "../utils/loadText";

describe("JoinSheet — found state", () => {
  it("shows the found state with chips when the project resolves to a single city/route", async () => {
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue({
      cityId: "den_haag", routeId: "short_loop", stopCount: 15, distanceMeters: 2400, durationMinutes: 120,
    });
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue({ "project.name": "Democrats Abroad" } as any);
    render(JoinSheet, { props: baseProps() });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "letmein" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() => expect(screen.getByText("15 stops")).toBeInTheDocument());
    expect(screen.getByText("No account needed. You'll pick a team name next.")).toBeInTheDocument();
  });

  it("shows the found state without chips when the project has more than one city/route", async () => {
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(null);
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue({ "project.name": "Democrats Abroad" } as any);
    render(JoinSheet, { props: baseProps() });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "letmein" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() =>
      expect(
        screen.getByText("No account needed. You'll pick a team name, then a city and route, next."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/stops/)).not.toBeInTheDocument();
  });

  it("cold-loading with initialCode set lands directly in the found state, never flashing the empty form", async () => {
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(null);
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue({ "project.name": "Democrats Abroad" } as any);
    render(JoinSheet, { props: baseProps({ initialCode: "letmein" }) });
    expect(screen.queryByRole("button", { name: /find hunt/i })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: /join this hunt/i })).toBeInTheDocument());
  });

  it("calls onJoin (not onResolved again) when 'Join this hunt' is tapped", async () => {
    vi.spyOn(api, "postVerifyCode").mockResolvedValue({ ok: true, mode: "project", project: "democrats_abroad" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(null);
    vi.spyOn(loadTextApi, "loadText").mockResolvedValue({ "project.name": "Democrats Abroad" } as any);
    const onJoin = vi.fn();
    render(JoinSheet, { props: baseProps({ onJoin }) });
    await fireEvent.input(screen.getByLabelText("Hunt code"), { target: { value: "letmein" } });
    await fireEvent.click(screen.getByRole("button", { name: /find hunt/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /join this hunt/i })).toBeInTheDocument());
    await fireEvent.click(screen.getByRole("button", { name: /join this hunt/i }));
    expect(onJoin).toHaveBeenCalledWith("democrats_abroad");
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run src/test/JoinSheet.test.ts -t "found state"`
Expected: FAIL — `JoinSheet` doesn't call `resolveHuntSummary` or render `HuntSummary` yet.

- [ ] **Step 7: Implement the found state in `JoinSheet.svelte`**

Extend the script and template:

```svelte
<script lang="ts">
  // ... existing imports from Task 15 ...
  import { resolveHuntSummary, type HuntSummary as Summary } from "../utils/huntSummary";
  import { loadText } from "../utils/loadText";
  import HuntSummaryView from "./HuntSummary.svelte";
  import { languageStore } from "../stores/languageStore";

  // ... existing state from Task 15 ...
  let resolvedProject = $state<string | null>(null);
  let summary = $state<Summary | null>(null);
  let projectName = $state("");

  async function handleResolved(project: string) {
    resolvedProject = project;
    const lang = $languageStore.currentLang;
    const [projectMeta, huntSummary] = await Promise.all([
      loadText<Record<string, unknown>>(lang, `projects/${project}/${project}`),
      resolveHuntSummary(project, lang),
    ]);
    projectName = (projectMeta?.["project.name"] as string) ?? project;
    summary = huntSummary;
    onResolved(project);
  }
</script>
```

Replace the `data.ok && data.mode === "project"` branch inside `verify()` (Task 15) to call `handleResolved(data.project)` instead of `onResolved(data.project)` directly — `handleResolved` still calls `onResolved(project)` itself once the extra data has loaded, so the Task 15 `onResolved` contract is unchanged, just fired slightly later. Add the found-state markup after the form (shown when `resolvedProject` is set):

```svelte
{#if resolvedProject}
  <p class="join-sheet__eyebrow join-sheet__eyebrow--success">Hunt found</p>
  <HuntSummaryView
    {summary}
    {projectName}
    cityLabel={summary ? "" : "multiple cities"}
    organiser={projectName}
  />
  <button type="button" class="join-sheet__primary" onclick={() => onJoin(resolvedProject)}>Join this hunt</button>
  <p class="join-sheet__note">
    {summary
      ? "No account needed. You'll pick a team name next."
      : "No account needed. You'll pick a team name, then a city and route, next."}
  </p>
{/if}
```

`onJoin` was already added to the props list in Task 15 — this task just wires the button to it. No retrofit needed later in Task 18.

Note: this task's tests stub `resolveHuntSummary`/`loadText` directly — the real `cityLabel` wiring (reading the actual city name/count and organiser from project data, per spec §8.1's exact copy: `<city> · <language> · hosted by <organiser>`) is refined in Task 19 once `JoinSheet` is wired into real routing and can be checked end-to-end against real project YAML. Keep this task scoped to: found state renders, chips are conditional on `summary`, and the correct note copy is chosen.

- [ ] **Step 8: Run to verify pass**

Run: `npx vitest run src/test/JoinSheet.test.ts`
Expected: PASS (full file)

- [ ] **Step 9: Commit**

```bash
git add src/components/JoinSheet.svelte src/components/JoinSheet.css src/components/HuntSummary.svelte src/components/HuntSummary.css src/test/JoinSheet.test.ts src/test/HuntSummary.test.ts
git commit -m "feat: add JoinSheet found state with conditional hunt-stat chips"
```

---

### Task 17: `TeamSetupPage`

**Files:**
- Create: `src/pages/TeamSetupPage.svelte`, `src/pages/TeamSetupPage.css`
- Test: `src/test/TeamSetupPage.test.ts`

**Interfaces:**
- Consumes: `AppForm` (extended in Task 9), `generateTeamName` (Task 7), `postLogin` (`src/utils/api.ts`), `resolveHuntSummary` (Task 8), `DepthWordmark` (Task 13), `SearchPlane` (Task 10-12), `titleBarStore`.
- Produces: `TeamSetupPage` component, route param `{ project: string }`. On successful login, navigates to `/${project}/${cityId}/${routeId}` when `resolveHuntSummary` resolves, else `/${project}`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/test/TeamSetupPage.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { push } from "svelte-spa-router";
import TeamSetupPage from "../pages/TeamSetupPage.svelte";
import * as api from "../utils/api";
import * as huntSummaryApi from "../utils/huntSummary";

vi.mock("svelte-spa-router", () => ({ push: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("TeamSetupPage", () => {
  it("prefills a team name and calls postLogin with the stashed code as password on Continue", async () => {
    sessionStorage.setItem(
      "pendingHuntAuth",
      JSON.stringify({ project: "democrats_abroad", password: "letmein" }),
    );
    const loginSpy = vi
      .spyOn(api, "postLogin")
      .mockResolvedValue({ ok: true, teamName: "Rowdy Herring", isAdmin: false });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(null);

    render(TeamSetupPage, { props: { params: { project: "democrats_abroad" } } });
    expect((screen.getByLabelText("Team name") as HTMLInputElement).value.length).toBeGreaterThan(0);

    await fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() =>
      expect(loginSpy).toHaveBeenCalledWith(
        expect.objectContaining({ project: "democrats_abroad", password: "letmein" }),
      ),
    );
  });

  it("navigates straight into RoutePage when the project resolves to exactly one city/route", async () => {
    sessionStorage.setItem(
      "pendingHuntAuth",
      JSON.stringify({ project: "democrats_abroad", password: "letmein" }),
    );
    vi.spyOn(api, "postLogin").mockResolvedValue({ ok: true, teamName: "Rowdy Herring", isAdmin: false });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue({
      cityId: "den_haag", routeId: "short_loop", stopCount: 2, distanceMeters: null, durationMinutes: 24,
    });

    render(TeamSetupPage, { props: { params: { project: "democrats_abroad" } } });
    await fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/democrats_abroad/den_haag/short_loop"));
  });

  it("navigates to the project's city picker when more than one city/route exists", async () => {
    sessionStorage.setItem(
      "pendingHuntAuth",
      JSON.stringify({ project: "democrats_abroad", password: "letmein" }),
    );
    vi.spyOn(api, "postLogin").mockResolvedValue({ ok: true, teamName: "Rowdy Herring", isAdmin: false });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(null);

    render(TeamSetupPage, { props: { params: { project: "democrats_abroad" } } });
    await fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/democrats_abroad"));
  });

  it("surfaces the returned error on a failed login without navigating", async () => {
    sessionStorage.setItem(
      "pendingHuntAuth",
      JSON.stringify({ project: "democrats_abroad", password: "wrong" }),
    );
    vi.spyOn(api, "postLogin").mockResolvedValue({ ok: false, error: "Incorrect password" });
    vi.spyOn(huntSummaryApi, "resolveHuntSummary").mockResolvedValue(null);

    render(TeamSetupPage, { props: { params: { project: "democrats_abroad" } } });
    await fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await waitFor(() => expect(screen.getByText("Incorrect password")).toBeInTheDocument());
    expect(push).not.toHaveBeenCalledWith(expect.stringMatching(/^\/democrats_abroad/));
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/TeamSetupPage.test.ts`
Expected: FAIL — page doesn't exist.

- [ ] **Step 3: Implement**

```svelte
<!-- src/pages/TeamSetupPage.svelte -->
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { authStore } from "../stores/authStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import AppForm from "../components/AppForm.svelte";
  import DepthWordmark from "../components/DepthWordmark.svelte";
  import { generateTeamName } from "../utils/teamNameGenerator";
  import { postLogin } from "../utils/api";
  import { resolveHuntSummary } from "../utils/huntSummary";
  import type { FormField } from "../types/data";
  import "./TeamSetupPage.css";

  let { params }: { params: { project: string } } = $props();

  titleBarStore.set({ title: "Join the hunt", progress: { current: 2, total: 2 }, backPath: null });

  const teamNameValue = generateTeamName();
  const fields: FormField[] = [
    {
      id: "teamName",
      type: "random_value",
      label: "Team name",
      values: [teamNameValue],
      reroll: true,
      editable: true,
    },
  ];

  let error = $state<string | null>(null);

  function readPendingPassword(): string | null {
    const raw = sessionStorage.getItem("pendingHuntAuth");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { project?: string; password?: string };
      return parsed.project === params.project ? (parsed.password ?? null) : null;
    } catch {
      return null;
    }
  }

  async function handleSubmit(values: Record<string, unknown>) {
    const password = readPendingPassword();
    const teamName = String(values.teamName ?? teamNameValue);
    if (!password) {
      push(`/start`);
      return;
    }
    const data = await postLogin({ project: params.project, teamName, password });
    if (!data.ok) {
      error = data.error || "Something went wrong. Please try again.";
      return;
    }
    authStore.loginParticipant(params.project, data.teamName ?? teamName, data.contact ?? "", data.isAdmin ?? false);
    sessionStorage.removeItem("pendingHuntAuth");

    if (data.isAdmin) {
      push("/editor");
      return;
    }
    const lang = $languageStore.currentLang;
    const summary = await resolveHuntSummary(params.project, lang);
    push(summary ? `/${params.project}/${summary.cityId}/${summary.routeId}` : `/${params.project}`);
  }
</script>

<div class="team-setup-page">
  <DepthWordmark project={params.project} />
  <p class="team-setup-page__eyebrow">Step 2 of 2</p>
  <h2 class="team-setup-page__heading">Name your team</h2>
  <p class="team-setup-page__help">It shows on the leaderboard and on every photo you take.</p>
  {#if error}
    <p class="team-setup-page__error" aria-live="polite">{error}</p>
  {/if}
  <AppForm {fields} onSubmit={handleSubmit} submitLabel="Continue" />
</div>
```

Note: `AppForm`'s existing `onSubmit` contract expects a `Promise<void>` and shows its own confirm/busy/error states — check `src/components/AppForm.svelte`'s exact `onSubmit` prop type before wiring `handleSubmit` in (`grep -n "onSubmit" src/components/AppForm.svelte` — it's `(values) => Promise<void>` per `doc/architecture.md`'s Unified Form System section). Since `handleSubmit` above needs to surface a login error distinctly from `AppForm`'s generic error path, either (a) throw inside `handleSubmit` and let `AppForm`'s existing error UI show `data.error`, or (b) keep the local `error` state as written and skip throwing. Prefer (a) for consistency with every other `AppForm` consumer (`ChallengeForm`, `EditorLocationForm`) — throw `new Error(data.error || "Something went wrong. Please try again.")` instead of setting local `error`, and delete the local `{#if error}` block, relying on `AppForm`'s built-in error display. Adjust the Step 1 tests' error assertion accordingly if `AppForm`'s error text isn't rendered with `aria-live="polite"` by default — confirm against `AppForm.svelte`'s existing submit-error markup (it already has this per the Global Constraints/Coding Conventions "Accessibility baseline already in place" note in `ui-design-handover.md`).

```css
/* src/pages/TeamSetupPage.css */
.team-setup-page {
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--gap-section) var(--gap-block);
}

.team-setup-page__eyebrow {
  font-family: var(--font-map);
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-top: var(--gap-block);
}

.team-setup-page__error {
  color: var(--color-error);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/test/TeamSetupPage.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/TeamSetupPage.svelte src/pages/TeamSetupPage.css src/test/TeamSetupPage.test.ts
git commit -m "feat: add TeamSetupPage wired to existing postLogin auth"
```

---

## Phase 8 — Routing and cleanup

### Task 18: Route table — add new routes, delete old pages

**Files:**
- Modify: `src/App.svelte` (route table)
- Delete: `src/pages/AppPage.svelte`, `src/pages/AppPage.css`, `src/pages/CodeEntryPage.svelte`, `src/pages/CodeEntryPage.css`, `src/pages/JoinTeamPage.svelte`, `src/pages/JoinTeamPage.css`
- Delete: `src/test/AppPage.test.ts`, `src/test/CodeEntryPage.test.ts`, `src/test/JoinTeamPage.test.ts` (check exact names first: `ls src/test | grep -iE "apppage|codeentry|jointeam"`)
- Modify: `doc/architecture.md`'s routing table (File Structure and Routing sections)
- Test: `src/test/App.test.ts` (route wiring — extend the file from Task 3)

**Interfaces:**
- Wires `LandingPage` (Task 14) to `#/`, `#/start`, `#/join/:code`; `TeamSetupPage` (Task 17) to `#/join/:project/team`. Note the deliberate param-name difference: `:code` is whatever the participant typed/scanned (not yet known to be a valid project), while the team-setup route uses `:project` — the already-*resolved* project id — because `TeamSetupPage` (Task 17) destructures `params.project` directly for `postLogin`/`resolveHuntSummary` calls. `JoinSheet`'s `onJoin(project)` (Task 16) is what performs this code→project handoff by pushing to the resolved id, not the raw code.

- [ ] **Step 1: Write the failing routing tests**

Add to `src/test/App.test.ts`:

```ts
import { location } from "svelte-spa-router";

describe("Landing/join routing", () => {
  it("renders LandingPage for /, /start, and /join/:code", () => {
    for (const path of ["/", "/start", "/join/abc123"]) {
      location.set(path);
      const { container, unmount } = render(App);
      expect(container.querySelector(".landing-page")).not.toBeNull();
      unmount();
    }
  });

  it("renders TeamSetupPage for /join/:project/team", () => {
    location.set("/join/democrats_abroad/team");
    const { container } = render(App);
    expect(container.querySelector(".team-setup-page")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/App.test.ts -t "Landing/join routing"`
Expected: FAIL — routes don't exist yet, old pages still mounted at `/`/`/start`.

- [ ] **Step 3: Update the route table in `App.svelte`**

Find the existing route object (near the route definitions referenced in `doc/architecture.md`'s Routing table) and replace the `/`, `/start`, `/join/:project` entries:

```ts
    "/": wrap({ component: asRoute(LandingPage) }),
    "/start": wrap({ component: asRoute(LandingPage) }),
    "/join/:code": wrap({ component: asRoute(LandingPage) }),
    "/join/:project/team": wrap({ component: asRoute(TeamSetupPage) }),
```

Add the imports:

```ts
import LandingPage from "./pages/LandingPage.svelte";
import TeamSetupPage from "./pages/TeamSetupPage.svelte";
```

Remove the old imports (`AppPage`, `CodeEntryPage`, `JoinTeamPage`) and their route entries.

`LandingPage` needs to know which of the three states it's in (sheet closed / open-empty / open-resolving-a-code) from the route, and must set the join-flow step-count progress (spec §8.3: `Step 1 of 2` while the sheet is open, cleared when it's closed) — extend `LandingPage`'s script (Task 14), **removing** Task 14's original unconditional `titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });` line and replacing it with the reactive version below:

```svelte
<script lang="ts">
  // ... existing LandingPage script ...
  import { push, location } from "svelte-spa-router";
  import JoinSheet from "../components/JoinSheet.svelte";

  let { params }: { params?: { code?: string } } = $props();

  let sheetOpen = $derived($location !== "/");
  let initialCode = $derived(params?.code ?? "");

  $effect(() => {
    titleBarStore.set(
      sheetOpen
        ? { title: "Join the hunt", progress: { current: 1, total: 2 }, backPath: "/" }
        : { title: "Freedom Hunt", progress: null, backPath: null },
    );
  });

  function handleJoin(project: string) {
    push(`/join/${project}/team`);
  }
</script>
```

Per spec §9 ("Code entry → found" is a same-route content cross-fade — resolving a code never navigates by itself; only tapping "Join this hunt" moves to team setup, a real route change), `onResolved` needs no navigation handler at all here; only `onJoin` (Task 16, fired with the resolved project id) does. Add inside `LandingPage`'s template:

```svelte
<JoinSheet
  open={sheetOpen}
  {initialCode}
  onResolved={() => {}}
  onJoin={handleJoin}
  onDemo={() => push("/login/demo")}
  onClose={() => push("/")}
/>
```

- [ ] **Step 4: Delete the old pages and their tests**

```bash
rm src/pages/AppPage.svelte src/pages/AppPage.css
rm src/pages/CodeEntryPage.svelte src/pages/CodeEntryPage.css
rm src/pages/JoinTeamPage.svelte src/pages/JoinTeamPage.css
rm src/test/AppPage.test.ts src/test/CodeEntryPage.test.ts src/test/JoinTeamPage.test.ts
```

(Adjust filenames to whatever `ls src/test | grep -iE "apppage|codeentry|jointeam"` actually shows.)

- [ ] **Step 5: Update `doc/architecture.md`'s routing table**

Replace the `AppPage`/`CodeEntryPage`/`JoinTeamPage` rows in both the File Structure and Routing sections with `LandingPage`/`TeamSetupPage`, matching the new route table from Step 3.

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run src/test/App.test.ts`
Expected: PASS

- [ ] **Step 7: Run full suite, lint, typecheck, YAML validation**

Run: `npm test && npm run lint && npx svelte-check && npm run validate:yaml`
Expected: all green — this is the integration point for every prior task, so treat any failure here as a real regression to fix, not a flaky test.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: wire LandingPage/TeamSetupPage into routing, remove superseded pages"
```

---

### Task 19: Transitions polish (sheet motion, plane pause/re-anchor, reduced motion)

**Files:**
- Modify: `src/components/JoinSheet.css`, `src/components/SearchPlane.svelte`, `src/pages/LandingPage.svelte`
- Modify: `src/styles/global.css` (shared transition keyframes, if any beyond the sheen one from Task 13)
- Test: `src/test/LandingPage.test.ts`, `src/test/JoinSheet.test.ts` (extend)

**Interfaces:**
- Wires `SearchPlane`'s `paused` prop (already implemented in Task 11) to `JoinSheet`'s `open` state via `LandingPage`.

- [ ] **Step 1: Write the failing test**

Add to `src/test/LandingPage.test.ts`:

```ts
it("pauses SearchPlane while the join sheet is open", () => {
  const { container, component } = render(LandingPage, { props: { params: { code: "abc" } } });
  // With a route param present (sheet open), the plane should receive paused: true.
  // Verified indirectly: SearchPlane renders no rAF-driving effect while paused.
  const rafSpy = vi.spyOn(window, "requestAnimationFrame");
  expect(rafSpy).not.toHaveBeenCalledWith(expect.anything()); // no growth scheduled while paused
});
```

Add to `src/test/JoinSheet.test.ts`:

```ts
it("collapses all transitions to ~1ms under prefers-reduced-motion", () => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const { container } = render(JoinSheet, { props: { open: true, onResolved: vi.fn(), onDemo: vi.fn(), onClose: vi.fn() } });
  const sheet = container.querySelector(".join-sheet") as HTMLElement;
  expect(getComputedStyle(sheet).transitionDuration).not.toBe("320ms");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/test/LandingPage.test.ts src/test/JoinSheet.test.ts -t "pause|reduced-motion"`
Expected: FAIL — `paused` isn't wired, no reduced-motion CSS override exists yet.

- [ ] **Step 3: Wire `paused` in `LandingPage.svelte`**

```svelte
<script lang="ts">
  // ...
  let planePaused = $derived(sheetOpen);
</script>

<SearchPlane mode={/* per Task 14 */} anchor={64} paused={planePaused} />
```

- [ ] **Step 4: Add reduced-motion overrides to `JoinSheet.css`**

```css
@media (prefers-reduced-motion: reduce) {
  .join-sheet {
    transition-duration: 1ms;
  }
}
```

Add the same `1ms` override to `SearchPlane.css` and `LandingPage.css` for any transition/animation declared in those files, and confirm `SearchPlane.svelte`'s `start()` (Task 11) checks `window.matchMedia("(prefers-reduced-motion: reduce)").matches` and renders `mode="frozen"` behavior instead of starting the rAF loop — add this check now if Task 11 didn't already include it:

```svelte
<script lang="ts">
  // in SearchPlane.svelte, near `start()`:
  let prefersReducedMotion = $derived(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
</script>
```

Use `prefersReducedMotion` to force `mode === "frozen"` rendering and skip `start()` entirely — apply this in the template's mode-selection logic (`mode === "frozen" || prefersReducedMotion`) everywhere Task 10-12 branched on `mode` directly.

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/test/LandingPage.test.ts src/test/JoinSheet.test.ts src/test/SearchPlane.test.ts`
Expected: PASS

- [ ] **Step 6: Run full suite, lint, typecheck**

Run: `npm test && npm run lint && npx svelte-check`
Expected: all green

- [ ] **Step 7: Commit**

```bash
git add src/components/JoinSheet.css src/components/SearchPlane.svelte src/components/SearchPlane.css src/pages/LandingPage.svelte src/pages/LandingPage.css src/test/LandingPage.test.ts src/test/JoinSheet.test.ts
git commit -m "feat: wire SearchPlane pause to sheet state, add prefers-reduced-motion overrides"
```

---

## Final verification

- [ ] Run `npm test`, `npm run lint`, `npx svelte-check`, and `npm run validate:yaml` one more time from a clean state and confirm all green.
- [ ] Manually exercise the flow via `npm run dev` (per this project's rule, do not use Playwright/browser automation — the user verifies manually): landing → tap "Start hunting" → enter a real dev-provisioned code in mixed case with a dash → confirm it resolves → "Join this hunt" → team setup, roll the dice, edit the name, "Continue" → confirm it lands either directly in `RoutePage` (single-city/route project) or on `ProjectPage` (multi-city project) → confirm the demo button reaches the existing `/login/demo` flow unchanged.
- [ ] Switch theme (☰ menu) mid-flow at least once on the sheet and on team setup; confirm no layout break and that `GWC`/`wireframe` show no sheen.
- [ ] Re-read `doc/superpowers/specs/2026-07-30-landing-join-flow-design.md`'s §13 acceptance checklist top to bottom against the running app.
- [ ] Update `doc/devlog/_devlog.md` per `CLAUDE.md`'s Session End instruction (this is the user's/session's job at the end, not a task to check off mid-plan).

---

## Notes for whoever executes this plan

- Task 17's `handleSubmit`/`AppForm` error-wiring note (Step 3) and Task 18's `LandingPage` sheet-navigation note (Step 3) both flag a design decision to confirm against the *actual* current shape of `AppForm`'s `onSubmit` contract and `svelte-spa-router`'s `$location` store API at execution time — re-check those two integration points against the live code before writing them, since this plan was written from a point-in-time read of the codebase and small signature details (exact prop names) are the most likely thing to have drifted.
- `src/utils/api.ts:214` currently has `await fetch("\auth\logout", ...)` (backslashes, not forward slashes) inside `postLogout()` — this is a pre-existing bug unrelated to this plan (it silently breaks logout) that was noticed while researching Task 17/18. Not in scope here; flag it to the user separately.
