# Completion Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the end-of-hunt experience with a new `completion` route-entry
template-type — a stop-screen-shaped hero+card, three real stats (stops completed,
photos taken, time on foot), a choreographed one-shot arrival sequence, and an inline
voter-registration link — without touching the existing `007_splash_completion.yaml`.

**Architecture:** A new template-type follows the existing four-type pattern
(`text`/`splash`/`options`/`checkpoint`) end to end: type → schema → `RouteScreen`
dispatch → `validate-yaml.ts` wiring. The three stats are computed from data this app
already tracks (form-submission state, upload results) rather than authored, and a new
`submittedAt` timestamp on the existing local `FormState` (mirroring
`form_submissions.submitted_at` server-side) is the only new data being tracked. The
choreography is a `$effect` keyed on `isCurrent`, copying `SplashScreen.svelte`'s
existing mount-timing pattern verbatim.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + `@testing-library/svelte/svelte5`,
`ajv` (JSON Schema), `lucide-svelte` icons, `marked` (via `MarkdownText`).

**Spec:** `doc/superpowers/specs/2026-07-29-completion-screen-design.md` — read this
first for the full rationale behind every decision below.

## Global Constraints

- TypeScript only — `.svelte` (`<script lang="ts">`) and `.ts`. No `.js`/`.jsx`/`.tsx` in
  `src/`.
- Styling via co-located `.css` files imported at the top of each `.svelte` file; BEM-like
  class names (`component-name__element--modifier`); colours via `var(--color-*)`; no
  Tailwind, no CSS modules.
- Svelte 5 runes only (`$state`, `$derived`, `$derived.by`, `$effect`, `$props`) — never
  Svelte 4 `$:`.
- `formStorage.ts`'s `STORAGE_VERSION` bumps its **minor** segment only for additive,
  backward-compatible `FormState` changes (its own documented rule) — never the major
  segment for anything in this plan.
- No abstractions for one-off things — reuse existing tokens (`--content-max`,
  `--gap-section`, `--gap-block`) and existing visual patterns (section-label
  icon+uppercase style, badge sizing) by value, matching `ChallengeCard.css` exactly
  where the spec says to.
- Never use Playwright or any browser automation to verify a change — this project's
  `CLAUDE.md` reserves manual verification for the user. Automated verification here is
  Vitest, `npm run typecheck`, `npm run lint`, and `npm run validate:yaml` only.
- **Do not invoke git commands.** This repository's `CLAUDE.md` states the user controls
  git exclusively. Every task ends with a "stage for review" step that lists the changed
  files — it never runs `git add`/`git commit`. Committing is the user's call.
- Test commands: `npm run test:run -- <path>` (single file), `npm run test:run` (whole
  suite), `npm run typecheck`, `npm run lint`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/types/data.ts` | `FormState.submittedAt`, `CompletionEntry`, `CompletionStats`, `RouteEntry` union |
| `src/utils/formStorage.ts` | `STORAGE_VERSION` bump, `submittedAt` round-trip |
| `src/components/ChallengeForm.svelte` | Stamps `submittedAt` once, on first successful submit |
| `src/utils/completionStats.ts` (new) | `computePhotosTaken`, `computeElapsedSinceFirstSubmission`, `formatElapsed` |
| `src/types/storyline.ts` | `StatVisibility` gains `"count_up"` |
| `src/data/schemas/stats.schema.json` | `visibility` enum gains `"count_up"` |
| `src/components/StoryStats.svelte` (+ `.css`) | `staggerMs` prop, count-up animation, pop class |
| `src/stores/titleBarStore.ts` | `progress.animateMs` |
| `src/components/TitleBar.svelte` | Reads `animateMs` as an inline `transition-duration` |
| `src/data/schemas/completion.schema.json` (new) | Schema for the new template-type |
| `scripts/validate-yaml.ts` | Wiring for the new pattern/schema |
| `src/components/CompletionScreen.svelte` (+ `.css`, new) | The screen itself: static structure, then choreography |
| `src/components/RouteScreen.svelte` | Dispatch case for `"completion"` |
| `src/pages/RoutePage.svelte` | Computes the three stats, stages the progress-bar fill, passes `stats` down |

---

### Task 1: `FormState.submittedAt` + `STORAGE_VERSION` bump

**Files:**
- Modify: `src/types/data.ts:126-132`
- Modify: `src/utils/formStorage.ts`
- Test: `src/test/formStorage.test.ts`

**Interfaces:**
- Produces: `FormState.submittedAt?: number` (epoch ms, optional); `STORAGE_VERSION =
  "1.2"`.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/formStorage.test.ts` (after the existing "round-trips the exact state"
test):

```ts
test("saveFormState then loadFormState round-trips submittedAt when present", () => {
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1");
  const state = {
    values: {},
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
    submittedAt: 1690000000000,
  };
  saveFormState(key, state);
  expect(loadFormState(key)).toEqual(state);
});

test("loadFormState reads a pre-submittedAt payload (version 1.1) with submittedAt undefined", () => {
  const key = "pre-submittedat-key";
  localStorage.setItem(
    key,
    JSON.stringify({
      version: "1.1",
      values: {},
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    }),
  );
  expect(loadFormState(key).submittedAt).toBeUndefined();
});
```

Also change the existing version-envelope test's expectation from `"1.1"` to `"1.2"`:

```ts
test("saveFormState writes a version envelope that loadFormState reads back transparently", () => {
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1");
  saveFormState(key, {
    values: { note: "hi" },
    uploads: {},
    submitted: false,
    skipped: false,
    touchedFields: [],
  });
  const raw = JSON.parse(localStorage.getItem(key)!);
  expect(raw.version).toBe("1.2");
  expect(loadFormState(key)).toEqual({
    values: { note: "hi" },
    uploads: {},
    submitted: false,
    skipped: false,
    touchedFields: [],
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/formStorage.test.ts`
Expected: FAIL — `raw.version` is still `"1.1"`; `submittedAt` round-trip test fails
because `saveFormState`/`loadFormState` don't carry the field yet.

- [ ] **Step 3: Add `submittedAt` to the `FormState` type**

In `src/types/data.ts`, change:

```ts
export interface FormState {
  values: Record<string, unknown>;
  uploads: Record<string, PhotoUploadStatus>;
  submitted: boolean;
  skipped: boolean;
  touchedFields: string[];
}
```

to:

```ts
export interface FormState {
  values: Record<string, unknown>;
  uploads: Record<string, PhotoUploadStatus>;
  submitted: boolean;
  skipped: boolean;
  touchedFields: string[];
  submittedAt?: number;
}
```

- [ ] **Step 4: Bump `STORAGE_VERSION` and thread `submittedAt` through `loadFormState`**

In `src/utils/formStorage.ts`, change:

```ts
const STORAGE_VERSION = "1.1";
```

to:

```ts
const STORAGE_VERSION = "1.2";
```

And change `loadFormState`'s return object:

```ts
    return {
      values: parsed.values ?? {},
      uploads: parsed.uploads ?? {},
      submitted: parsed.submitted ?? false,
      skipped: parsed.skipped ?? false,
      touchedFields: parsed.touchedFields ?? [],
    };
```

to:

```ts
    return {
      values: parsed.values ?? {},
      uploads: parsed.uploads ?? {},
      submitted: parsed.submitted ?? false,
      skipped: parsed.skipped ?? false,
      touchedFields: parsed.touchedFields ?? [],
      submittedAt: parsed.submittedAt,
    };
```

`saveFormState` needs no change — it already spreads the whole `state` object it's
given (`JSON.stringify({ version: STORAGE_VERSION, ...state })`), so a `submittedAt` key
present on the passed-in state is already persisted.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:run -- src/test/formStorage.test.ts`
Expected: PASS (all tests in the file, including the pre-existing ones).

- [ ] **Step 6: Stage for review**

List changed files (`src/types/data.ts`, `src/utils/formStorage.ts`,
`src/test/formStorage.test.ts`) for the user. Do not run `git add`/`git commit` — leave
staging and committing to the user.

---

### Task 2: `ChallengeForm.svelte` stamps `submittedAt` once

**Files:**
- Modify: `src/components/ChallengeForm.svelte`
- Test: `src/test/ChallengeForm.test.ts`

**Interfaces:**
- Consumes: `FormState.submittedAt` (Task 1).
- Produces: every `saveFormState` call from `ChallengeForm` now includes `submittedAt`,
  set exactly once (on the first successful submit for that location) and never
  overwritten by a later re-submit.

- [ ] **Step 1: Write the failing test**

Add to `src/test/ChallengeForm.test.ts` (in the "Local storage persistence and resubmit
behavior" section):

```ts
test("stamps submittedAt on first successful submit and keeps it across a re-submit", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1700000000000);
  render(ChallengeForm, {
    props: { form, locationId: "1", routeId: "short_loop", cityId: "den_haag", project: "demo" },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), { target: { value: "some text" } });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  await screen.findByRole("button", { name: /saved/i });
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1");
  expect(JSON.parse(localStorage.getItem(key)!).submittedAt).toBe(1700000000000);

  vi.setSystemTime(1700000005000);
  await fireEvent.input(screen.getByLabelText("Your note"), { target: { value: "updated text" } });
  await fireEvent.click(screen.getByRole("button", { name: "Re-submit" }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  await screen.findByRole("button", { name: /saved/i });
  expect(JSON.parse(localStorage.getItem(key)!).submittedAt).toBe(1700000000000);
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/test/ChallengeForm.test.ts`
Expected: FAIL — `submittedAt` is `undefined` in the saved state (not yet written).

- [ ] **Step 3: Add `submittedAt` state and thread it through `persist()`**

In `src/components/ChallengeForm.svelte`, add a new state variable alongside the
existing ones:

```ts
  let touchedFields = $state<string[]>(stored.touchedFields);
```

becomes:

```ts
  let touchedFields = $state<string[]>(stored.touchedFields);
  let submittedAt = $state<number | undefined>(stored.submittedAt);
```

Change `persist()`'s signature and body:

```ts
  function persist(
    vals: Record<string, unknown>,
    ups: Record<string, PhotoUploadStatus>,
    submitted: boolean,
    skp: boolean,
    touched: string[],
  ) {
    if (storeInLocalStorage) {
      saveFormState(storageKey, { values: vals, uploads: ups, submitted, skipped: skp, touchedFields: touched });
    }
  }
```

to:

```ts
  function persist(
    vals: Record<string, unknown>,
    ups: Record<string, PhotoUploadStatus>,
    submitted: boolean,
    skp: boolean,
    touched: string[],
    stampedAt: number | undefined,
  ) {
    if (storeInLocalStorage) {
      saveFormState(storageKey, {
        values: vals,
        uploads: ups,
        submitted,
        skipped: skp,
        touchedFields: touched,
        submittedAt: stampedAt,
      });
    }
  }
```

Update the three existing call sites to pass the new argument:

```ts
  function handleValuesChange(values: Record<string, unknown>) {
    latestValues = values;
    persist(
      values,
      untrack(() => latestUploads),
      untrack(() => hasSubmittedOnce),
      untrack(() => skipped),
      untrack(() => touchedFields),
      untrack(() => submittedAt),
    );
  }

  function handleUploadsChange(uploads: Record<string, PhotoUploadStatus>) {
    latestUploads = uploads;
    persist(
      untrack(() => latestValues),
      uploads,
      untrack(() => hasSubmittedOnce),
      untrack(() => skipped),
      untrack(() => touchedFields),
      untrack(() => submittedAt),
    );
  }

  function handleTouchedFieldsChange(fields: string[]) {
    touchedFields = fields;
    persist(
      untrack(() => latestValues),
      untrack(() => latestUploads),
      untrack(() => hasSubmittedOnce),
      untrack(() => skipped),
      fields,
      untrack(() => submittedAt),
    );
  }
```

And `handleSuccess()`:

```ts
  function handleSuccess() {
    hasSubmittedOnce = true;
    baseValues = latestValues;
    baseUploads = latestUploads;
    persist(latestValues, latestUploads, true, skipped, untrack(() => touchedFields));
    onFormStatusChange?.({ submitted: true, missingLabels: [] });
  }
```

to:

```ts
  function handleSuccess() {
    hasSubmittedOnce = true;
    baseValues = latestValues;
    baseUploads = latestUploads;
    if (submittedAt === undefined) {
      submittedAt = Date.now();
    }
    persist(latestValues, latestUploads, true, skipped, untrack(() => touchedFields), submittedAt);
    onFormStatusChange?.({ submitted: true, missingLabels: [] });
  }
```

The `if (submittedAt === undefined)` guard is what makes this "only the first time" —
a later re-submit finds `submittedAt` already set and skips restamping it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/test/ChallengeForm.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Stage for review**

List changed files (`src/components/ChallengeForm.svelte`,
`src/test/ChallengeForm.test.ts`). Do not run `git add`/`git commit`.

---

### Task 3: `src/utils/completionStats.ts`

**Files:**
- Create: `src/utils/completionStats.ts`
- Test: `src/test/completionStats.test.ts` (new)

**Interfaces:**
- Consumes: `buildFormStorageKey`/`loadFormState` (existing), `FormState.submittedAt`
  (Task 1).
- Produces: `computePhotosTaken(project, city, route, locationIds): number`;
  `computeElapsedSinceFirstSubmission(project, city, route, locationIds, now): number |
  undefined`; `formatElapsed(ms: number): string`.

- [ ] **Step 1: Write the failing tests**

Create `src/test/completionStats.test.ts`:

```ts
import { buildFormStorageKey, saveFormState } from "../utils/formStorage";
import {
  computePhotosTaken,
  computeElapsedSinceFirstSubmission,
  formatElapsed,
} from "../utils/completionStats";

beforeEach(() => {
  localStorage.clear();
});

test("computePhotosTaken sums successful uploads across every location", () => {
  saveFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "001"), {
    values: {},
    uploads: {
      pic: { status: "success", httpCode: 200 },
      pic2: { status: "error", httpCode: 500 },
    },
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  saveFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "002"), {
    values: {},
    uploads: { pic: { status: "success", httpCode: 200 } },
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  expect(computePhotosTaken("demo", "den_haag", "short_loop", ["001", "002"])).toBe(2);
});

test("computePhotosTaken returns 0 when no location has ever been visited", () => {
  expect(computePhotosTaken("demo", "den_haag", "short_loop", ["001", "002"])).toBe(0);
});

test("computeElapsedSinceFirstSubmission returns now minus the earliest submittedAt across all locations", () => {
  saveFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "001"), {
    values: {},
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
    submittedAt: 1_000,
  });
  saveFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "002"), {
    values: {},
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
    submittedAt: 5_000,
  });
  expect(
    computeElapsedSinceFirstSubmission("demo", "den_haag", "short_loop", ["001", "002"], 10_000),
  ).toBe(9_000);
});

test("computeElapsedSinceFirstSubmission returns undefined when nothing was ever submitted", () => {
  expect(
    computeElapsedSinceFirstSubmission("demo", "den_haag", "short_loop", ["001", "002"], 10_000),
  ).toBeUndefined();
});

test("formatElapsed renders minutes only under an hour", () => {
  expect(formatElapsed(45 * 60_000)).toBe("45m");
});

test("formatElapsed renders hours and minutes over an hour", () => {
  expect(formatElapsed((2 * 60 + 18) * 60_000)).toBe("2h 18m");
});

test("formatElapsed rounds to the nearest minute", () => {
  expect(formatElapsed(90_000)).toBe("2m");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/completionStats.test.ts`
Expected: FAIL with "Cannot find module '../utils/completionStats'".

- [ ] **Step 3: Write the implementation**

Create `src/utils/completionStats.ts`:

```ts
import { buildFormStorageKey, loadFormState } from "./formStorage";

export function computePhotosTaken(
  project: string,
  city: string,
  route: string | undefined,
  locationIds: string[],
): number {
  return locationIds.reduce((total, locId) => {
    const state = loadFormState(buildFormStorageKey(project, city, route, locId));
    const successCount = Object.values(state.uploads).filter(
      (upload) => upload.status === "success",
    ).length;
    return total + successCount;
  }, 0);
}

export function computeElapsedSinceFirstSubmission(
  project: string,
  city: string,
  route: string | undefined,
  locationIds: string[],
  now: number,
): number | undefined {
  const timestamps = locationIds
    .map((locId) => loadFormState(buildFormStorageKey(project, city, route, locId)).submittedAt)
    .filter((timestamp): timestamp is number => timestamp !== undefined);
  if (timestamps.length === 0) {
    return undefined;
  }
  return now - Math.min(...timestamps);
}

const MS_PER_MINUTE = 60_000;

export function formatElapsed(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / MS_PER_MINUTE));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/test/completionStats.test.ts`
Expected: PASS.

- [ ] **Step 5: Stage for review**

List changed files (`src/utils/completionStats.ts`, `src/test/completionStats.test.ts`).
Do not run `git add`/`git commit`.

---

### Task 4: `StoryStats` generalization — `count_up` visibility + `staggerMs`

**Files:**
- Modify: `src/types/storyline.ts`
- Modify: `src/data/schemas/stats.schema.json`
- Modify: `src/components/StoryStats.svelte`
- Modify: `src/components/StoryStats.css`
- Test: `src/test/StoryStats.test.ts`

**Interfaces:**
- Produces: `StatVisibility = "visible" | "click_to_reveal" | "count_up"`; new optional
  `staggerMs?: number` prop on `StoryStats.svelte` (default `0`).

- [ ] **Step 1: Write the failing tests**

Add to `src/test/StoryStats.test.ts`:

```ts
test("count_up numeric item starts at 0 and animates up to its final value", () => {
  vi.useFakeTimers();
  render(StoryStats, {
    props: { block: block({ items: [{ value: 100, label: "stops", visibility: "count_up" }] }) },
  });
  expect(screen.getByText("0")).toBeInTheDocument();
  vi.advanceTimersByTime(600);
  expect(screen.getByText("100")).toBeInTheDocument();
  vi.useRealTimers();
});

test("count_up items honor staggerMs — a later item hasn't started while an earlier one already has", () => {
  vi.useFakeTimers();
  const { container } = render(StoryStats, {
    props: {
      block: block({
        items: [
          { value: 100, label: "a", visibility: "count_up" },
          { value: 100, label: "b", visibility: "count_up" },
        ],
      }),
      staggerMs: 150,
    },
  });
  vi.advanceTimersByTime(60);
  const values = container.querySelectorAll(".story-stats__value");
  expect(Number(values[0].textContent)).toBeGreaterThan(0);
  expect(Number(values[1].textContent)).toBe(0);
  vi.useRealTimers();
});

test("a string value under count_up visibility renders verbatim and is never animated", () => {
  render(StoryStats, {
    props: {
      block: block({ items: [{ value: "2h 18m", label: "time on foot", visibility: "count_up" }] }),
    },
  });
  expect(screen.getByText("2h 18m")).toBeInTheDocument();
});

test("under prefers-reduced-motion, a count_up item shows its final value immediately with no ramp", () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  render(StoryStats, {
    props: { block: block({ items: [{ value: 100, label: "stops", visibility: "count_up" }] }) },
  });
  expect(screen.getByText("100")).toBeInTheDocument();
  window.matchMedia = originalMatchMedia;
});

test("adds the pop class to a count_up item once its ramp finishes", () => {
  vi.useFakeTimers();
  const { container } = render(StoryStats, {
    props: { block: block({ items: [{ value: 5, label: "a", visibility: "count_up" }] }) },
  });
  vi.advanceTimersByTime(600);
  expect(container.querySelector(".story-stats__value--pop")).toBeInTheDocument();
  vi.useRealTimers();
});

test("existing visible/click_to_reveal items are unaffected by the count_up addition", () => {
  render(StoryStats, {
    props: {
      block: block({
        items: [
          { value: "6,870", label: "school book bans" },
          { value: "23", label: "states", visibility: "click_to_reveal" },
        ],
      }),
    },
  });
  expect(screen.getByText("6,870")).toBeInTheDocument();
  expect(screen.queryByText("23")).not.toBeInTheDocument();
  expect(screen.getByTestId("story-stats-cover-1")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/StoryStats.test.ts`
Expected: FAIL — TypeScript rejects `"count_up"` as an invalid `StatVisibility`, and no
count-up/pop behavior exists yet.

- [ ] **Step 3: Widen `StatVisibility`**

In `src/types/storyline.ts`, change:

```ts
export type StatVisibility = "visible" | "click_to_reveal";
```

to:

```ts
export type StatVisibility = "visible" | "click_to_reveal" | "count_up";
```

- [ ] **Step 4: Widen the schema enum**

In `src/data/schemas/stats.schema.json`, change:

```json
          "visibility": { "type": "string", "enum": ["visible", "click_to_reveal"] }
```

to:

```json
          "visibility": { "type": "string", "enum": ["visible", "click_to_reveal", "count_up"] }
```

- [ ] **Step 5: Implement the count-up in `StoryStats.svelte`**

Replace the full file with:

```svelte
<script lang="ts">
  import "./StoryStats.css";
  import type { StoryBlock } from "../types/storyline";

  let {
    block,
    staggerMs = 0,
  }: { block: Extract<StoryBlock, { type: "stats" }>; staggerMs?: number } = $props();

  let revealed = $state<Record<number, boolean>>({});
  let animatedValues = $state<Record<number, number>>(
    Object.fromEntries(
      block.doc.items
        .map((item, idx) => [idx, item] as const)
        .filter(([, item]) => item.visibility === "count_up" && typeof item.value === "number")
        .map(([idx]) => [idx, 0]),
    ),
  );
  let popped = $state<Record<number, boolean>>({});

  function toggle(idx: number): void {
    revealed = { ...revealed, [idx]: true };
  }

  function display(value: number | string): string {
    return typeof value === "number" ? value.toLocaleString("en-US") : value;
  }

  function displayItem(item: { value: number | string }, idx: number): string {
    if (typeof item.value === "number" && animatedValues[idx] !== undefined) {
      return display(animatedValues[idx]);
    }
    return display(item.value);
  }

  const COUNT_UP_DURATION_MS = 600;
  const COUNT_UP_STEPS = 20;
  const COUNT_UP_STEP_MS = COUNT_UP_DURATION_MS / COUNT_UP_STEPS;

  $effect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
    const startTimers: ReturnType<typeof setTimeout>[] = [];
    const tickTimers: ReturnType<typeof setInterval>[] = [];

    block.doc.items.forEach((item, idx) => {
      if (item.visibility !== "count_up" || typeof item.value !== "number") {
        return;
      }
      const target = item.value;
      if (prefersReducedMotion) {
        animatedValues = { ...animatedValues, [idx]: target };
        return;
      }
      startTimers.push(
        setTimeout(() => {
          let step = 0;
          const interval = setInterval(() => {
            step += 1;
            const progress = Math.min(1, step / COUNT_UP_STEPS);
            animatedValues = { ...animatedValues, [idx]: Math.round(target * progress) };
            if (progress >= 1) {
              clearInterval(interval);
              popped = { ...popped, [idx]: true };
            }
          }, COUNT_UP_STEP_MS);
          tickTimers.push(interval);
        }, idx * staggerMs),
      );
    });

    return () => {
      startTimers.forEach(clearTimeout);
      tickTimers.forEach(clearInterval);
    };
  });

  let anyHiddenCovered = $derived(
    block.doc.items.some(
      (item, idx) => item.visibility === "click_to_reveal" && !revealed[idx],
    ),
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
          <div
            class="story-stats__value"
            class:story-stats__value--pop={popped[idx]}
          >
            {displayItem(item, idx)}
          </div>
        {/if}
        <div class="story-stats__label">{item.label}</div>
      </div>
    {/each}
  </div>
  {#if block.doc.footnote}
    <p class="story-stats__footnote">{block.doc.footnote}</p>
  {/if}
</div>
```

- [ ] **Step 6: Add the pop keyframe to `StoryStats.css`**

In `src/components/StoryStats.css`, change:

```css
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

to:

```css
@media (prefers-reduced-motion: no-preference) {
  .story-stats__value {
    animation: story-stats-reveal 0.2s ease;
  }

  .story-stats__value--pop {
    animation: story-stats-pop 0.28s ease-out;
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

@keyframes story-stats-pop {
  0% {
    transform: scale(1);
  }
  45% {
    transform: scale(1.14);
  }
  100% {
    transform: scale(1);
  }
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:run -- src/test/StoryStats.test.ts`
Expected: PASS (all tests in the file, including every pre-existing one).

- [ ] **Step 8: Stage for review**

List changed files (`src/types/storyline.ts`, `src/data/schemas/stats.schema.json`,
`src/components/StoryStats.svelte`, `src/components/StoryStats.css`,
`src/test/StoryStats.test.ts`). Do not run `git add`/`git commit`.

---

### Task 5: `titleBarStore` gains `progress.animateMs`

**Files:**
- Modify: `src/stores/titleBarStore.ts`
- Modify: `src/components/TitleBar.svelte`
- Test: `src/test/TitleBar.test.ts`

**Interfaces:**
- Produces: `TitleBarState.progress` gains an optional `animateMs?: number`, read by
  `TitleBar.svelte` as an inline `transition-duration` override on
  `.titlebar__progress-fill`.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/TitleBar.test.ts`:

```ts
test("overrides the progress fill's transition duration when animateMs is set", () => {
  titleBarStore.set({
    title: "Test",
    progress: { current: 6, total: 8, animateMs: 900 },
    backPath: null,
  });
  render(TitleBar);
  const fill = screen
    .getByTestId("progress-bar")
    .querySelector(".titlebar__progress-fill") as HTMLElement;
  expect(fill.style.transitionDuration).toBe("900ms");
});

test("leaves the progress fill's transition duration unset when animateMs is absent", () => {
  titleBarStore.set({
    title: "Test",
    progress: { current: 2, total: 3 },
    backPath: null,
  });
  render(TitleBar);
  const fill = screen
    .getByTestId("progress-bar")
    .querySelector(".titlebar__progress-fill") as HTMLElement;
  expect(fill.style.transitionDuration).toBe("");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/TitleBar.test.ts`
Expected: FAIL — TypeScript rejects `animateMs` on the progress object (not yet in the
type), and the rendered element has no inline `transition-duration` either way.

- [ ] **Step 3: Widen `TitleBarState`**

In `src/stores/titleBarStore.ts`, change:

```ts
export interface TitleBarState {
  title?: string;
  progress?: { current: number; total: number } | null;
  backPath?: string | null;
  subtitle?: string;
  isDirty?: boolean;
}
```

to:

```ts
export interface TitleBarState {
  title?: string;
  progress?: { current: number; total: number; animateMs?: number } | null;
  backPath?: string | null;
  subtitle?: string;
  isDirty?: boolean;
}
```

- [ ] **Step 4: Read `animateMs` in `TitleBar.svelte`**

In `src/components/TitleBar.svelte`, change:

```svelte
  {#if $titleBarStore.progress}
    <div
      data-testid="progress-bar"
      class="titlebar__progress-track"
    >
      <div
        class="titlebar__progress-fill"
        style="width: {($titleBarStore.progress.current /
          $titleBarStore.progress.total) *
          100}%"
      ></div>
    </div>
  {/if}
```

to:

```svelte
  {#if $titleBarStore.progress}
    <div
      data-testid="progress-bar"
      class="titlebar__progress-track"
    >
      <div
        class="titlebar__progress-fill"
        style="width: {($titleBarStore.progress.current /
          $titleBarStore.progress.total) *
          100}%;{$titleBarStore.progress.animateMs !== undefined
          ? ` transition-duration: ${$titleBarStore.progress.animateMs}ms;`
          : ''}"
      ></div>
    </div>
  {/if}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:run -- src/test/TitleBar.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 6: Stage for review**

List changed files (`src/stores/titleBarStore.ts`, `src/components/TitleBar.svelte`,
`src/test/TitleBar.test.ts`). Do not run `git add`/`git commit`.

---

### Task 6: New `completion` template-type — types, schema, `validate-yaml.ts`

**Files:**
- Modify: `src/types/data.ts`
- Create: `src/data/schemas/completion.schema.json`
- Modify: `scripts/validate-yaml.ts`
- Test: `src/test/completionSchema.test.ts` (new)

**Interfaces:**
- Produces: `CompletionEntry` (new), `CompletionStats` (new), both exported from
  `src/types/data.ts`; `RouteEntry` union includes `CompletionEntry`.

- [ ] **Step 1: Write the failing tests**

Create `src/test/completionSchema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import Ajv from "ajv";

const schemaPath = new URL("../data/schemas/completion.schema.json", import.meta.url);
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const validDoc = {
  "template-type": "completion",
  image: "lange-vijverberg.jpg",
  title: "You made it.",
  subtitle: "Democrats Abroad 2026 Scavenger Hunt",
  place: "The Hague · short loop",
  registration: {
    text: "Check your voter registration",
    url: "https://www.democratsabroad.org/nl",
  },
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

test("rejects a completion entry missing registration", () => {
  const { registration: _registration, ...withoutRegistration } = validDoc;
  expect(validate(withoutRegistration)).toBe(false);
});

test("rejects a registration object missing url", () => {
  expect(validate({ ...validDoc, registration: { text: "Check" } })).toBe(false);
});

test("rejects an unknown top-level property", () => {
  expect(validate({ ...validDoc, unexpected_field: true })).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/completionSchema.test.ts`
Expected: FAIL — `completion.schema.json` does not exist yet.

- [ ] **Step 3: Add `CompletionEntry`/`CompletionStats` to `src/types/data.ts`**

Add near the other route-entry interfaces (after `OptionsEntry`, before
`FormsRequirement`):

```ts
export interface CompletionEntry {
  "template-type": "completion";
  image: string;
  title: string;
  subtitle: string;
  place: string;
  caption?: string;
  closing_text?: string;
  registration: { text: string; url: string };
  hint?: string;
  "nav-bar"?: NavBarConfig;
}

export interface CompletionStats {
  stopsCompleted: number;
  stopsTotal: number;
  photosCount: number | "—";
  timeOnFoot: string;
}
```

Change the `RouteEntry` union:

```ts
export type RouteEntry = LocationEntry | TextEntry | SplashEntry | OptionsEntry | CheckpointEntry;
```

to:

```ts
export type RouteEntry =
  | LocationEntry
  | TextEntry
  | SplashEntry
  | OptionsEntry
  | CheckpointEntry
  | CompletionEntry;
```

- [ ] **Step 4: Create `src/data/schemas/completion.schema.json`**

Modeled on `options.schema.json`'s shape:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Completion Screen",
  "type": "object",
  "additionalProperties": false,
  "required": ["template-type", "image", "title", "subtitle", "place", "registration"],
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
    "registration": {
      "type": "object",
      "additionalProperties": false,
      "required": ["text", "url"],
      "properties": {
        "text": { "type": "string" },
        "url": { "type": "string" }
      }
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:run -- src/test/completionSchema.test.ts`
Expected: PASS.

- [ ] **Step 6: Wire the new schema into `scripts/validate-yaml.ts`**

This step has no dedicated Vitest coverage (none of the other five template-type
schemas do either — this script is exercised by `npm run validate:yaml` directly, per
this repo's existing convention). Add the compiled validator, alongside the other six:

```ts
const validateStats = ajv.compile(loadSchema("stats.schema.json"));
```

becomes:

```ts
const validateStats = ajv.compile(loadSchema("stats.schema.json"));
const validateCompletion = ajv.compile(loadSchema("completion.schema.json"));
```

Add the new filename pattern, alongside the other six:

```ts
const STATS_PATTERN = /^\d+_stats_.*\.yaml$/;
```

becomes:

```ts
const STATS_PATTERN = /^\d+_stats_.*\.yaml$/;
const COMPLETION_PATTERN = /^\d+_completion_.*\.yaml$/;
```

Add a new block to the `violations` array, alongside the other six:

```ts
  ...findFiles(DATA_DIR, STATS_PATTERN).flatMap((filePath) =>
    checkStatsFile(filePath).map((msg) => ({ filePath, msg })),
  ),
];
```

becomes:

```ts
  ...findFiles(DATA_DIR, STATS_PATTERN).flatMap((filePath) =>
    checkStatsFile(filePath).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, COMPLETION_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateCompletion).map((msg) => ({ filePath, msg })),
  ),
];
```

- [ ] **Step 7: Verify the script still runs clean**

Run: `npm run validate:yaml`
Expected: exits 0, same as before this task (no `*_completion_*.yaml` files exist yet in
`src/data/text/en/projects/`, so the new block matches zero files — it must not error on
an empty match set).

- [ ] **Step 8: Run the full suite and typecheck**

Run: `npm run test:run` then `npm run typecheck`
Expected: both PASS — confirms the widened `RouteEntry` union doesn't break any
exhaustive `template-type` switch elsewhere in the codebase.

- [ ] **Step 9: Stage for review**

List changed files (`src/types/data.ts`, `src/data/schemas/completion.schema.json`,
`scripts/validate-yaml.ts`, `src/test/completionSchema.test.ts`). Do not run `git
add`/`git commit`.

---

### Task 7: `CompletionScreen.svelte` (+ `.css`) — static structure

**Files:**
- Create: `src/components/CompletionScreen.svelte`
- Create: `src/components/CompletionScreen.css`
- Test: `src/test/CompletionScreen.test.ts` (new)

**Interfaces:**
- Consumes: `CompletionStats` (Task 6), `StoryStats` (Task 4, used here with plain
  `"visible"` items only — `"count_up"` is wired in Task 8).
- Produces: `CompletionScreen` component, props:
  `{ image: string; title: string; subtitle: string; place: string; caption?: string;
  closingText?: string; registration: { text: string; url: string }; hint?: string;
  stats: CompletionStats; project: string; cityId: string }`.

No choreography yet — everything renders in its final, visible state. Task 8 adds the
arrival sequence on top without changing any of this task's assertions.

- [ ] **Step 1: Write the failing tests**

Create `src/test/CompletionScreen.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import CompletionScreen from "../components/CompletionScreen.svelte";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));
vi.mock("svelte-spa-router", () => ({ push: vi.fn() }));

const baseProps = {
  image: "lange-vijverberg.jpg",
  title: "You made it.",
  subtitle: "Democrats Abroad 2026 Scavenger Hunt",
  place: "The Hague · short loop",
  registration: {
    text: "Check your voter registration",
    url: "https://www.democratsabroad.org/nl",
  },
  stats: { stopsCompleted: 6, stopsTotal: 8, photosCount: 12 as number | "—", timeOnFoot: "2h 18m" },
  project: "democrats_abroad",
  cityId: "den_haag",
};

test("renders title, subtitle, and place from props", () => {
  render(CompletionScreen, { props: baseProps });
  expect(screen.getByText("You made it.")).toBeInTheDocument();
  expect(screen.getByText("Democrats Abroad 2026 Scavenger Hunt")).toBeInTheDocument();
  expect(screen.getByText("The Hague · short loop")).toBeInTheDocument();
});

test("renders the registration link pointing at the authored URL", () => {
  render(CompletionScreen, { props: baseProps });
  const link = screen.getByRole("link", { name: "Check your voter registration" });
  expect(link).toHaveAttribute("href", "https://www.democratsabroad.org/nl");
  expect(link).toHaveAttribute("target", "_blank");
});

test("renders a secondary button that navigates to the route's results_download page", async () => {
  const { push } = await import("svelte-spa-router");
  render(CompletionScreen, { props: baseProps });
  await fireEvent.click(screen.getByRole("button", { name: "See your answers" }));
  expect(push).toHaveBeenCalledWith("/democrats_abroad/den_haag/results_download");
});

test("renders caption and closing text when provided", () => {
  render(CompletionScreen, {
    props: { ...baseProps, caption: "Recorded 29 July 2026.", closingText: "Thank you." },
  });
  expect(screen.getByText("Recorded 29 July 2026.")).toBeInTheDocument();
  expect(screen.getByText("Thank you.")).toBeInTheDocument();
});

test("omits caption and closing text elements when absent", () => {
  render(CompletionScreen, { props: baseProps });
  expect(document.querySelector(".cmpl-caption")).not.toBeInTheDocument();
  expect(document.querySelector(".cmpl-closer")).not.toBeInTheDocument();
});

test("renders the hint line when provided", () => {
  render(CompletionScreen, { props: { ...baseProps, hint: "Takes about 2 minutes." } });
  expect(screen.getByText("Takes about 2 minutes.")).toBeInTheDocument();
});

test("shows stops-completed, photos-taken, and time-on-foot stats", () => {
  render(CompletionScreen, { props: baseProps });
  expect(screen.getByText("6")).toBeInTheDocument();
  expect(screen.getByText("12")).toBeInTheDocument();
  expect(screen.getByText("2h 18m")).toBeInTheDocument();
});

test("shows a placeholder dash for photos-taken when local storage was disabled", () => {
  render(CompletionScreen, {
    props: { ...baseProps, stats: { ...baseProps.stats, photosCount: "—" } },
  });
  expect(screen.getByText("—")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/CompletionScreen.test.ts`
Expected: FAIL with "Cannot find module '../components/CompletionScreen.svelte'".

- [ ] **Step 3: Write `src/components/CompletionScreen.svelte`**

```svelte
<script lang="ts">
  import { push } from "svelte-spa-router";
  import { Check, Sparkles } from "lucide-svelte";
  import { fetchImage, getCachedImageUrl } from "../assets/AssetManager";
  import { themeStore } from "../stores/themeStore";
  import MarkdownText from "./MarkdownText.svelte";
  import StoryStats from "./StoryStats.svelte";
  import type { StoryBlock } from "../types/storyline";
  import type { CompletionStats } from "../types/data";
  import "./CompletionScreen.css";

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
  } = $props();

  let heroSrc = $state<string | null>(null);

  $effect.pre(() => {
    heroSrc = getCachedImageUrl(image) ?? null;
  });

  $effect(() => {
    if (getCachedImageUrl(image)) {
      return undefined;
    }
    let cancelled = false;
    fetchImage(image).then((url) => {
      if (!cancelled) {
        heroSrc = url;
      }
    });
    return () => {
      cancelled = true;
    };
  });

  let statsBlock = $derived<Extract<StoryBlock, { type: "stats" }>>({
    type: "stats",
    ref: "completion",
    doc: {
      items: [
        {
          value: stats.stopsCompleted,
          label: `Stops completed (of ${stats.stopsTotal})`,
          visibility: "visible",
        },
        { value: stats.photosCount, label: "Photos taken", visibility: "visible" },
        { value: stats.timeOnFoot, label: "Time on foot", visibility: "visible" },
      ],
    },
  });

  function goToResults() {
    push(`/${project}/${cityId}/results_download`);
  }
</script>

<div class="cmpl-root">
  <div class="cmpl-hero">
    {#if heroSrc}
      <img src={heroSrc} alt="" class="cmpl-hero-img" />
    {/if}
  </div>

  <div class="cmpl-card">
    <div class="cmpl-badge" style="background: {$themeStore.theme.accent}">
      <Check size={22} aria-hidden="true" />
    </div>
    <div>
      <div class="cmpl-title">{title}</div>
      <div class="cmpl-subtitle">{subtitle}</div>
      <div class="cmpl-place">{place}</div>
    </div>
  </div>

  <div class="cmpl-section">
    <div class="cmpl-section-label">
      <Sparkles size={12} aria-hidden="true" />
      Your hunt
    </div>
    <StoryStats block={statsBlock} />
  </div>

  {#if caption}
    <p class="cmpl-caption">{caption}</p>
  {/if}

  {#if closingText}
    <div class="cmpl-closer">
      <MarkdownText text={closingText} />
    </div>
  {/if}

  <div class="cmpl-actions">
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
</div>
```

- [ ] **Step 4: Write `src/components/CompletionScreen.css`**

```css
/* src/components/CompletionScreen.css */

.cmpl-root {
  background: var(--color-background);
}

.cmpl-hero {
  position: relative;
  max-width: var(--content-max);
  margin-inline: auto;
  aspect-ratio: 16 / 9;
  max-height: 35vh;
  overflow: hidden;
}

.cmpl-hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 55%;
  display: block;
  transform: translateZ(0) scale(1.04);
  will-change: transform;
  backface-visibility: hidden;
}

.cmpl-card {
  max-width: var(--content-max);
  margin: -40px auto 0;
  padding: 16px 18px;
  box-sizing: border-box;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  display: flex;
  gap: 14px;
  align-items: flex-start;
  position: relative;
  z-index: 1;
}

.cmpl-badge {
  min-width: 44px;
  height: 44px;
  color: #fff;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cmpl-title {
  font-size: var(--font-size-lg);
  font-weight: 800;
  color: var(--color-text);
  line-height: 1.2;
}

.cmpl-subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  font-weight: 600;
  margin-top: 3px;
}

.cmpl-place {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.cmpl-section {
  max-width: var(--content-max);
  margin: var(--gap-section) auto 0;
  padding-inline: 16px;
  box-sizing: border-box;
}

.cmpl-section-label {
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.cmpl-caption {
  max-width: var(--content-max);
  margin: 10px auto 0;
  padding-inline: 16px;
  box-sizing: border-box;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.cmpl-closer {
  max-width: var(--content-max);
  margin: var(--gap-block) auto 0;
  padding: 15px 17px;
  box-sizing: border-box;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.cmpl-actions {
  max-width: var(--content-max);
  margin: var(--gap-section) auto 0;
  padding: 0 16px 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

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

.cmpl-hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 2px 0 0;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:run -- src/test/CompletionScreen.test.ts`
Expected: PASS.

- [ ] **Step 6: Stage for review**

List changed files (`src/components/CompletionScreen.svelte`,
`src/components/CompletionScreen.css`, `src/test/CompletionScreen.test.ts`). Do not run
`git add`/`git commit`.

---

### Task 8: Choreography — reveal sequence, Ken Burns, confetti, vibrate, reduced motion

**Files:**
- Modify: `src/components/CompletionScreen.svelte`
- Modify: `src/components/CompletionScreen.css`
- Modify: `src/test/CompletionScreen.test.ts`

**Interfaces:**
- Produces: `CompletionScreen` gains an `isCurrent?: boolean` prop (default `true`). The
  arrival sequence runs once per transition of `isCurrent` to `true`, mirroring
  `SplashScreen.svelte`'s existing pattern.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/CompletionScreen.test.ts` (add `afterEach(() => { vi.useRealTimers();
});` near the top of the file too, mirroring `SplashScreen.test.ts`):

```ts
afterEach(() => {
  vi.useRealTimers();
});

test("does not start the arrival sequence while isCurrent is false", () => {
  vi.useFakeTimers();
  const { container } = render(CompletionScreen, {
    props: { ...baseProps, isCurrent: false },
  });
  vi.advanceTimersByTime(3000);
  expect(container.querySelector(".cmpl-reveal--in")).not.toBeInTheDocument();
  expect(container.querySelector(".confetti-effect")).not.toBeInTheDocument();
});

test("reveals the card, badge, stats, caption, closer, and actions in order", () => {
  vi.useFakeTimers();
  const { container } = render(CompletionScreen, {
    props: { ...baseProps, caption: "c", closingText: "d", isCurrent: true },
  });
  const cardEl = container.querySelector(".cmpl-card")!;
  const badgeEl = container.querySelector(".cmpl-badge")!;
  expect(cardEl).not.toHaveClass("cmpl-reveal--in");

  vi.advanceTimersByTime(120);
  expect(cardEl).toHaveClass("cmpl-reveal--in");
  expect(badgeEl).not.toHaveClass("cmpl-badge--in");

  vi.advanceTimersByTime(260); // total 380ms
  expect(badgeEl).toHaveClass("cmpl-badge--in");

  vi.advanceTimersByTime(400); // total 780ms
  expect(container.querySelector(".confetti-effect")).toBeInTheDocument();

  vi.advanceTimersByTime(220); // total 1000ms
  expect(container.querySelector(".cmpl-section")).toHaveClass("cmpl-reveal--in");

  vi.advanceTimersByTime(520); // total 1520ms
  expect(container.querySelector(".cmpl-caption")).toHaveClass("cmpl-reveal--in");

  vi.advanceTimersByTime(160); // total 1680ms
  expect(container.querySelector(".cmpl-closer")).toHaveClass("cmpl-reveal--in");

  vi.advanceTimersByTime(220); // total 1900ms
  expect(container.querySelector(".cmpl-actions")).toHaveClass("cmpl-reveal--in");
});

test("plays Ken Burns once isCurrent is true", () => {
  const { container } = render(CompletionScreen, { props: { ...baseProps, isCurrent: true } });
  expect(container.querySelector(".cmpl-hero")).toHaveClass("cmpl-hero--play");
});

test("stops the sequence and Ken Burns when isCurrent goes false mid-sequence", async () => {
  vi.useFakeTimers();
  const { container, rerender } = render(CompletionScreen, {
    props: { ...baseProps, isCurrent: true },
  });
  vi.advanceTimersByTime(400);
  expect(container.querySelector(".cmpl-card")).toHaveClass("cmpl-reveal--in");

  await rerender({ ...baseProps, isCurrent: false });
  expect(container.querySelector(".cmpl-hero")).not.toHaveClass("cmpl-hero--play");

  vi.advanceTimersByTime(3000);
  expect(container.querySelector(".confetti-effect")).not.toBeInTheDocument();
});

test("restarts the sequence fresh on re-entry (isCurrent false then true again)", async () => {
  vi.useFakeTimers();
  const { container, rerender } = render(CompletionScreen, {
    props: { ...baseProps, isCurrent: true },
  });
  vi.advanceTimersByTime(3000);
  expect(container.querySelector(".cmpl-actions")).toHaveClass("cmpl-reveal--in");

  await rerender({ ...baseProps, isCurrent: false });
  expect(container.querySelector(".cmpl-actions")).not.toHaveClass("cmpl-reveal--in");

  await rerender({ ...baseProps, isCurrent: true });
  expect(container.querySelector(".cmpl-actions")).not.toHaveClass("cmpl-reveal--in");
  vi.advanceTimersByTime(1900);
  expect(container.querySelector(".cmpl-actions")).toHaveClass("cmpl-reveal--in");
});

test("under prefers-reduced-motion, every reveal is final immediately and confetti never mounts", () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  const { container } = render(CompletionScreen, {
    props: { ...baseProps, caption: "c", closingText: "d", isCurrent: true },
  });
  expect(container.querySelector(".cmpl-card")).toHaveClass("cmpl-reveal--in");
  expect(container.querySelector(".cmpl-actions")).toHaveClass("cmpl-reveal--in");
  expect(container.querySelector(".cmpl-hero")).not.toHaveClass("cmpl-hero--play");
  expect(container.querySelector(".confetti-effect")).not.toBeInTheDocument();
  window.matchMedia = originalMatchMedia;
});

test("vibrates once when confetti fires", () => {
  vi.useFakeTimers();
  const vibrateSpy = vi.fn();
  Object.defineProperty(navigator, "vibrate", { value: vibrateSpy, configurable: true });
  render(CompletionScreen, { props: { ...baseProps, isCurrent: true } });
  vi.advanceTimersByTime(780);
  expect(vibrateSpy).toHaveBeenCalledWith(40);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/CompletionScreen.test.ts`
Expected: FAIL — no `isCurrent` prop, no reveal classes, no Ken Burns/confetti/vibrate
timing exists yet.

- [ ] **Step 3: Add the choreography to `CompletionScreen.svelte`**

Import `ConfettiEffect` alongside the other imports:

```ts
  import ConfettiEffect from "./effects/ConfettiEffect.svelte";
```

Add `isCurrent` to the props destructure:

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

Change `statsBlock`'s first two items' visibility from `"visible"` to `"count_up"`:

```ts
  let statsBlock = $derived<Extract<StoryBlock, { type: "stats" }>>({
    type: "stats",
    ref: "completion",
    doc: {
      items: [
        {
          value: stats.stopsCompleted,
          label: `Stops completed (of ${stats.stopsTotal})`,
          visibility: "count_up",
        },
        { value: stats.photosCount, label: "Photos taken", visibility: "count_up" },
        { value: stats.timeOnFoot, label: "Time on foot", visibility: "visible" },
      ],
    },
  });
```

Add the choreography state and effect (after `statsBlock`, before `goToResults`):

```ts
  let cardIn = $state(false);
  let badgeIn = $state(false);
  let statsIn = $state(false);
  let captionIn = $state(false);
  let closerIn = $state(false);
  let actionsIn = $state(false);
  let playKenBurns = $state(false);
  let confettiFired = $state(false);

  const STATS_STAGGER_MS = 150;

  function prefersReducedMotion(): boolean {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  }

  $effect(() => {
    if (!isCurrent) {
      cardIn = false;
      badgeIn = false;
      statsIn = false;
      captionIn = false;
      closerIn = false;
      actionsIn = false;
      playKenBurns = false;
      confettiFired = false;
      return undefined;
    }

    if (prefersReducedMotion()) {
      cardIn = true;
      badgeIn = true;
      statsIn = true;
      captionIn = true;
      closerIn = true;
      actionsIn = true;
      playKenBurns = false;
      confettiFired = false;
      return undefined;
    }

    playKenBurns = true;
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => { cardIn = true; }, 120),
      setTimeout(() => { badgeIn = true; }, 380),
      setTimeout(() => {
        confettiFired = true;
        if (typeof navigator.vibrate === "function") {
          navigator.vibrate(40);
        }
      }, 780),
      setTimeout(() => { statsIn = true; }, 1000),
      setTimeout(() => { captionIn = true; }, 1520),
      setTimeout(() => { closerIn = true; }, 1680),
      setTimeout(() => { actionsIn = true; }, 1900),
    ];

    return () => {
      timers.forEach(clearTimeout);
      playKenBurns = false;
    };
  });
```

Update the template — hero, card, badge, stats section, caption, closer, and actions
all gain reveal classes, and confetti mounts conditionally:

```svelte
<div class="cmpl-root">
  <div class="cmpl-hero" class:cmpl-hero--play={playKenBurns}>
    {#if heroSrc}
      <img src={heroSrc} alt="" class="cmpl-hero-img" />
    {/if}
    {#if confettiFired}
      <ConfettiEffect />
    {/if}
  </div>

  <div class="cmpl-card cmpl-reveal" class:cmpl-reveal--in={cardIn}>
    <div
      class="cmpl-badge"
      class:cmpl-badge--in={badgeIn}
      style="background: {$themeStore.theme.accent}"
    >
      <Check size={22} aria-hidden="true" />
    </div>
    <div>
      <div class="cmpl-title">{title}</div>
      <div class="cmpl-subtitle">{subtitle}</div>
      <div class="cmpl-place">{place}</div>
    </div>
  </div>

  <div class="cmpl-section cmpl-reveal" class:cmpl-reveal--in={statsIn}>
    <div class="cmpl-section-label">
      <Sparkles size={12} aria-hidden="true" />
      Your hunt
    </div>
    <StoryStats block={statsBlock} staggerMs={STATS_STAGGER_MS} />
  </div>

  {#if caption}
    <p class="cmpl-caption cmpl-reveal" class:cmpl-reveal--in={captionIn}>{caption}</p>
  {/if}

  {#if closingText}
    <div class="cmpl-closer cmpl-reveal" class:cmpl-reveal--in={closerIn}>
      <MarkdownText text={closingText} />
    </div>
  {/if}

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
</div>
```

- [ ] **Step 4: Add the choreography CSS to `CompletionScreen.css`**

Append:

```css
.cmpl-reveal {
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.2, 0.75, 0.3, 1);
}

.cmpl-reveal--in {
  opacity: 1;
  transform: none;
}

.cmpl-hero--play .cmpl-hero-img {
  animation: cmpl-ken 14s cubic-bezier(0.15, 0.55, 0.3, 1) forwards;
}

@keyframes cmpl-ken {
  from {
    transform: translateZ(0) scale(1.04);
  }
  to {
    transform: translateZ(0) scale(1.13);
  }
}

.cmpl-badge {
  opacity: 0;
  transform: scale(0.5) rotate(-10deg);
}

.cmpl-badge--in {
  animation: cmpl-stamp 0.52s cubic-bezier(0.2, 0.85, 0.3, 1) forwards;
}

@keyframes cmpl-stamp {
  0% {
    opacity: 0;
    transform: scale(0.5) rotate(-10deg);
  }
  55% {
    opacity: 1;
    transform: scale(1.12) rotate(3deg);
  }
  100% {
    opacity: 1;
    transform: scale(1) rotate(-1.5deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cmpl-reveal {
    opacity: 1;
    transform: none;
    transition: none;
  }
  .cmpl-badge {
    opacity: 1;
    transform: none;
  }
  .cmpl-badge--in {
    animation: none;
  }
  .cmpl-hero--play .cmpl-hero-img {
    animation: none;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:run -- src/test/CompletionScreen.test.ts`
Expected: PASS (all tests in the file, including every Task 7 test).

- [ ] **Step 6: Stage for review**

List changed files (`src/components/CompletionScreen.svelte`,
`src/components/CompletionScreen.css`, `src/test/CompletionScreen.test.ts`). Do not run
`git add`/`git commit`.

---

### Task 9: `RouteScreen.svelte` dispatch for `"completion"`

**Files:**
- Modify: `src/components/RouteScreen.svelte`
- Test: `src/test/RouteScreen.test.ts`

**Interfaces:**
- Consumes: `CompletionScreen` (Task 8), `CompletionStats` (Task 6).
- Produces: `RouteScreen` gains an optional `stats?: CompletionStats` prop, forwarded to
  `CompletionScreen` when the entry's `template-type` is `"completion"`.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/RouteScreen.test.ts`:

```ts
test("renders CompletionScreen for a completion entry", () => {
  render(RouteScreen, {
    props: {
      entry: {
        "template-type": "completion",
        image: "lange-vijverberg.jpg",
        title: "You made it.",
        subtitle: "Democrats Abroad 2026 Scavenger Hunt",
        place: "The Hague · short loop",
        registration: { text: "Check your registration", url: "https://example.org" },
      } as RouteEntry,
      index: 9,
      project: "demo",
      cityId: "new_york",
      stats: { stopsCompleted: 5, stopsTotal: 6, photosCount: 3, timeOnFoot: "1h 20m" },
    },
  });
  expect(screen.getByText("You made it.")).toBeInTheDocument();
  expect(screen.getByText("1h 20m")).toBeInTheDocument();
});

test("passes a zeroed placeholder stats object to CompletionScreen when stats is not provided", () => {
  render(RouteScreen, {
    props: {
      entry: {
        "template-type": "completion",
        image: "x.jpg",
        title: "Done",
        subtitle: "s",
        place: "p",
        registration: { text: "t", url: "u" },
      } as RouteEntry,
      index: 9,
    },
  });
  expect(screen.getByText("Done")).toBeInTheDocument();
  expect(screen.getByText("—")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/RouteScreen.test.ts`
Expected: FAIL — `RouteScreen` has no `"completion"` branch yet, and no `stats` prop.

- [ ] **Step 3: Wire the new branch into `RouteScreen.svelte`**

Add the import:

```ts
  import CompletionScreen from "./CompletionScreen.svelte";
```

Widen the type import:

```ts
  import type { RouteEntry, LocationEntry } from "../types/data";
```

to:

```ts
  import type { RouteEntry, LocationEntry, CompletionStats } from "../types/data";
```

Add `stats` to the props destructure:

```ts
  let {
    entry,
    index,
    locationKey = undefined,
    isLast = false,
    isFirst = false,
    routeId = undefined,
    cityId = undefined,
    project = "",
    storeFormsInLocalStorage = true,
    allowResubmit = true,
    badgeStatus = undefined,
    onFormStatusChange = undefined,
    onContinue = undefined,
    onPrev = undefined,
    isCurrent = true,
    stats = undefined,
  }: {
    entry: RouteEntry;
    index: number;
    locationKey?: string;
    isLast?: boolean;
    isFirst?: boolean;
    routeId?: string;
    cityId?: string;
    project?: string;
    storeFormsInLocalStorage?: boolean;
    allowResubmit?: boolean;
    badgeStatus?: "submitted" | "skipped";
    onFormStatusChange?: (
      locationId: string,
      status: { submitted: boolean; missingLabels: string[] },
    ) => void;
    onContinue?: () => void;
    onPrev?: () => void;
    isCurrent?: boolean;
    stats?: CompletionStats;
  } = $props();
```

Add the new branch before the final `{:else}` (ChallengeCard fallback):

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/test/RouteScreen.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Stage for review**

List changed files (`src/components/RouteScreen.svelte`,
`src/test/RouteScreen.test.ts`). Do not run `git add`/`git commit`.

---

### Task 10: `RoutePage.svelte` — compute stats, stage the progress bar

**Files:**
- Modify: `src/pages/RoutePage.svelte`
- Test: `src/test/RoutePage.test.ts`

**Interfaces:**
- Consumes: `computePhotosTaken`/`computeElapsedSinceFirstSubmission`/`formatElapsed`
  (Task 3), `CompletionStats` (Task 6), `stats` prop on `RouteScreen` (Task 9),
  `progress.animateMs` (Task 5).
- Produces: both `<RouteScreen>` render call sites receive a `stats` prop; the
  `titleBarStore` progress effect stages its fill for the completion entry.

- [ ] **Step 1: Write the failing tests**

Add a new fixture to the `vi.hoisted(...)` block at the top of
`src/test/RoutePage.test.ts` (alongside the other `mock*Entries` fixtures — name it
`mockFinishLineEntries` to avoid colliding with the existing, unrelated
`mockCompletionEntries` splash fixture used by the confetti-regression tests further
down this file):

```ts
  mockFinishLineEntries: [
    {
      title: "Loc 1",
      name: { value: "Location 1" },
      coordinates: { latitude: 52.0, longitude: 4.0 },
      storyline: "Story 1",
      breadcrumb: "Step 1",
      challenge: {
        name: "Challenge 1",
        description: "Desc 1",
        form: [{ id: "note", type: "string" as const, label: "Your note", isRequired: true }],
      },
    },
    {
      title: "Loc 2",
      name: { value: "Location 2" },
      coordinates: { latitude: 52.1, longitude: 4.1 },
      storyline: "Story 2",
      breadcrumb: "Step 2",
      challenge: {
        name: "Challenge 2",
        description: "Desc 2",
        form: [{ id: "note2", type: "string" as const, label: "Second note", isRequired: true }],
      },
    },
    {
      "template-type": "completion",
      image: "lange-vijverberg.jpg",
      title: "You made it.",
      subtitle: "Democrats Abroad 2026 Scavenger Hunt",
      place: "The Hague · short loop",
      registration: { text: "Check your registration", url: "https://example.org" },
      "nav-bar": { visible: false },
    },
  ],
```

Add the destructure at the top of the `const { ... } = vi.hoisted(...)` block too:

```ts
const {
  mockLocations,
  mockMixedEntries,
  mockPrecededByTextEntries,
  mockReEntryLockedEntries,
  mockCheckpointGateEntries,
  mockLeadingCheckpointEntries,
  mockCheckpointSucceedEntries,
  mockEulaEntries,
  mockCompletionEntries,
  mockRepeatSplashEntries,
  mockFinishLineEntries,
  huntSettingsFixture,
} = vi.hoisted(() => ({
```

Add the import at the top of the file:

```ts
import { buildFormStorageKey, saveFormState } from "../utils/formStorage";
```

Add the two new tests (near the end of the file, alongside the other integration
tests):

```ts
test("computes stops-completed from real form-submission state, and shows it on the completion screen", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockFinishLineEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.input(screen.getByLabelText("Your note"), { target: { value: "some text" } });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  await screen.findByRole("button", { name: /saved/i });

  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await screen.findByText("Location 2");
  await fireEvent.input(screen.getByLabelText("Second note"), { target: { value: "more text" } });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  await screen.findByRole("button", { name: /saved/i });

  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await screen.findByText("You made it.");

  expect(screen.getByText("2")).toBeInTheDocument();
});

test("shows photos-taken and time-on-foot from local storage, and stages the progress bar from the real stops-completed fraction to 100%", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(8_280_000);
  localStorage.setItem("democrats_abroad/den_haag/short_loop", "2");
  saveFormState(buildFormStorageKey("democrats_abroad", "den_haag", "short_loop", "001"), {
    values: {},
    uploads: { pic: { status: "success", httpCode: 200 } },
    submitted: true,
    skipped: false,
    touchedFields: [],
    submittedAt: 0,
  });
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockFinishLineEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("You made it.");

  expect(screen.getByText("1")).toBeInTheDocument(); // photosCount
  expect(screen.getByText("2h 18m")).toBeInTheDocument(); // timeOnFoot

  let progress: { current: number; total: number; animateMs?: number } | null = null;
  titleBarStore.subscribe((state) => {
    if (state.progress !== undefined) {
      progress = state.progress;
    }
  })();
  expect(progress).toEqual({ current: 1, total: 2, animateMs: 900 });

  vi.advanceTimersByTime(500);
  titleBarStore.subscribe((state) => {
    if (state.progress !== undefined) {
      progress = state.progress;
    }
  })();
  expect(progress).toEqual({ current: 2, total: 2, animateMs: 900 });
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/RoutePage.test.ts`
Expected: FAIL — `RoutePage` doesn't compute stats, doesn't render `CompletionScreen`
correctly (no `stats` passed), and doesn't stage the progress bar.

- [ ] **Step 3: Import `completionStats.ts` in `RoutePage.svelte`**

Add near the other utility imports:

```ts
  import { computePhotosTaken, computeElapsedSinceFirstSubmission, formatElapsed } from "../utils/completionStats";
```

- [ ] **Step 4: Add the stats `$derived`s**

Add after the existing `currentSkipped`/`canAdvance` derived values:

```ts
  // Locations without a challenge form have nothing to submit or skip — they're
  // resolved the moment they're visited, so they must count toward stops-completed
  // even though they never appear in formStatusByIndex/skippedIndices (those are only
  // populated for form-bearing locations).
  let stopsTotal = $derived(locationTotal(entries));
  let stopsCompleted = $derived(
    entries.reduce((count, entry, i) => {
      if (!isLocationEntry(entry)) {
        return count;
      }
      const locId = locationIdAt(routeData?.locations ?? [], i);
      const hasForm = (entry.challenge.form?.length ?? 0) > 0;
      const resolved =
        !hasForm || formStatusByIndex[locId]?.submitted === true || skippedIndices.has(locId);
      return resolved ? count + 1 : count;
    }, 0),
  );
  let photosCount = $derived(
    huntSettings.storeFormsInLocalStorage
      ? computePhotosTaken(params.project, params.city, params.route, routeData?.locations ?? [])
      : ("—" as const),
  );
  let timeOnFoot = $derived.by(() => {
    if (!huntSettings.storeFormsInLocalStorage) {
      return "—";
    }
    const elapsed = computeElapsedSinceFirstSubmission(
      params.project,
      params.city,
      params.route,
      routeData?.locations ?? [],
      Date.now(),
    );
    return elapsed === undefined ? "—" : formatElapsed(elapsed);
  });
  let completionStats = $derived({ stopsCompleted, stopsTotal, photosCount, timeOnFoot });
```

- [ ] **Step 5: Replace the titleBarStore progress effect**

Change:

```ts
  $effect(() => {
    titleBarStore.set({
      title: params.route.replace(/_/g, " "),
      progress:
        locationTotal(entries) > 0
          ? { current: locationOrdinalAt(entries, currentIndex), total: locationTotal(entries) }
          : null,
      backPath: `/${params.project}/${params.city}`,
    });
  });
```

to:

```ts
  $effect(() => {
    if (currentEntry?.["template-type"] === "completion") {
      titleBarStore.set({
        title: params.route.replace(/_/g, " "),
        progress: { current: stopsCompleted, total: stopsTotal, animateMs: 900 },
        backPath: `/${params.project}/${params.city}`,
      });
      const timer = setTimeout(() => {
        titleBarStore.update((state) => ({
          ...state,
          progress: state.progress ? { ...state.progress, current: stopsTotal } : state.progress,
        }));
      }, 500);
      return () => clearTimeout(timer);
    }
    titleBarStore.set({
      title: params.route.replace(/_/g, " "),
      progress:
        stopsTotal > 0
          ? { current: locationOrdinalAt(entries, currentIndex), total: stopsTotal }
          : null,
      backPath: `/${params.project}/${params.city}`,
    });
    return undefined;
  });
```

- [ ] **Step 6: Pass `stats` to both `<RouteScreen>` render sites**

In the snap-mode branch, change:

```svelte
        <RouteScreen
          entry={currentEntry}
          isLast={!canGoForward}
          isFirst={currentIndex <= earliestAllowed}
          index={currentDisplayIndex}
          locationKey={currentLocationKey}
          routeId={params.route}
          cityId={params.city}
          project={params.project}
          storeFormsInLocalStorage={huntSettings.storeFormsInLocalStorage}
          allowResubmit={huntSettings.allowResubmit}
          onFormStatusChange={handleFormStatusChange}
          badgeStatus={computeBadgeStatus(currentLocationKey, currentHasForm)}
          onContinue={() => handleDragEnd(-cardWidth)}
          onPrev={() => handleDragEnd(cardWidth)}
          isCurrent={true}
        />
```

to (adding one line, `stats={completionStats}`):

```svelte
        <RouteScreen
          entry={currentEntry}
          isLast={!canGoForward}
          isFirst={currentIndex <= earliestAllowed}
          index={currentDisplayIndex}
          locationKey={currentLocationKey}
          routeId={params.route}
          cityId={params.city}
          project={params.project}
          storeFormsInLocalStorage={huntSettings.storeFormsInLocalStorage}
          allowResubmit={huntSettings.allowResubmit}
          onFormStatusChange={handleFormStatusChange}
          badgeStatus={computeBadgeStatus(currentLocationKey, currentHasForm)}
          onContinue={() => handleDragEnd(-cardWidth)}
          onPrev={() => handleDragEnd(cardWidth)}
          isCurrent={true}
          stats={completionStats}
        />
```

In the carousel-mode branch, change:

```svelte
              <RouteScreen
                entry={slotEntry}
                isLast={nextNavigableIndex(entries, locIdx) === locIdx}
                isFirst={locIdx <= earliestAllowedIndex(entries, locIdx)}
                index={locationOrdinalAt(entries, locIdx)}
                locationKey={locationIdAt(routeData?.locations ?? [], locIdx)}
                routeId={params.route}
                cityId={params.city}
                project={params.project}
                storeFormsInLocalStorage={huntSettings.storeFormsInLocalStorage}
                allowResubmit={huntSettings.allowResubmit}
                onFormStatusChange={handleFormStatusChange}
                badgeStatus={computeBadgeStatus(locationIdAt(routeData?.locations ?? [], locIdx), isLocationEntry(slotEntry) && (slotEntry.challenge.form?.length ?? 0) > 0)}
                onContinue={() => handleDragEnd(-cardWidth)}
                onPrev={() => handleDragEnd(cardWidth)}
                isCurrent={role === 0}
              />
```

to (adding one line, `stats={role === 0 ? completionStats : undefined}` — only the
current slot needs real stats; peeked neighbors never render `CompletionScreen`'s
choreography since it's gated on `isCurrent` anyway, per Task 8):

```svelte
              <RouteScreen
                entry={slotEntry}
                isLast={nextNavigableIndex(entries, locIdx) === locIdx}
                isFirst={locIdx <= earliestAllowedIndex(entries, locIdx)}
                index={locationOrdinalAt(entries, locIdx)}
                locationKey={locationIdAt(routeData?.locations ?? [], locIdx)}
                routeId={params.route}
                cityId={params.city}
                project={params.project}
                storeFormsInLocalStorage={huntSettings.storeFormsInLocalStorage}
                allowResubmit={huntSettings.allowResubmit}
                onFormStatusChange={handleFormStatusChange}
                badgeStatus={computeBadgeStatus(locationIdAt(routeData?.locations ?? [], locIdx), isLocationEntry(slotEntry) && (slotEntry.challenge.form?.length ?? 0) > 0)}
                onContinue={() => handleDragEnd(-cardWidth)}
                onPrev={() => handleDragEnd(cardWidth)}
                isCurrent={role === 0}
                stats={role === 0 ? completionStats : undefined}
              />
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:run -- src/test/RoutePage.test.ts`
Expected: PASS (all tests in the file, including every pre-existing one — in
particular, re-run the "counts only location entries in the progress indicator..." test
to confirm the non-completion branch of the rewritten effect still behaves identically).

- [ ] **Step 8: Run the full suite, lint, and typecheck**

Run: `npm run test:run`, then `npm run lint`, then `npm run typecheck`
Expected: all PASS.

- [ ] **Step 9: Stage for review**

List changed files (`src/pages/RoutePage.svelte`, `src/test/RoutePage.test.ts`). Do not
run `git add`/`git commit`.

---

## Self-Review

**Spec coverage:**
- New `completion` template-type (type/schema/dispatch/validate-yaml) → Task 6, 9.
- Hero/card/badge/sections structure mirroring `ChallengeCard` → Task 7.
- Choreographed arrival, gated on `isCurrent`, Ken Burns, confetti, vibrate, reduced
  motion → Task 8.
- `StoryStats` generalization (`count_up`, `staggerMs`) → Task 4.
- Progress bar staged fill from real stops-completed → Task 5, 10.
- Three real stats (stops/photos/time) → Task 1, 2, 3, 10.
- Registration CTA (prominent link) + secondary "See your answers" link → Task 7.
- `nav-bar: { visible: false }` reuse for hiding gutter arrows → no code task needed
  (existing mechanism, exercised once the user authors a real YAML file — out of scope
  per the spec, since the user wires `routes.yaml` themselves).

**Placeholder scan:** no "TBD"/"TODO" in any task; every step has literal code, not a
description of code.

**Type consistency:** `CompletionStats` (Task 6) is the one shape threaded through Tasks
7, 9, and 10 — `{ stopsCompleted: number; stopsTotal: number; photosCount: number | "—";
timeOnFoot: string }` everywhere it's referenced. `CompletionEntry` (Task 6) matches the
props `RouteScreen` reads from it in Task 9 (`image`, `title`, `subtitle`, `place`,
`caption`, `closing_text`, `registration`, `hint`) exactly. `computePhotosTaken`/
`computeElapsedSinceFirstSubmission`/`formatElapsed` (Task 3) match their call sites in
Task 10 exactly (same parameter order and count).

Plan complete and saved to `doc/superpowers/plans/2026-07-29-completion-screen.md`. Two
execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review
between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch
execution with checkpoints

Which approach?
