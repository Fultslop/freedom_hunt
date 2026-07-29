# Route Checkpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `checkpoint` route entries that can permanently block backward navigation past a point in a route, and/or gate forward progress on requirements (forms completed, date window), with a generic, extensible requirement engine.

**Architecture:** Checkpoints are a fifth route-entry `template-type`, authored as their own file and listed by filename in `routes.yaml` exactly like every other entry. A checkpoint never becomes the "current" rendered screen — `currentIndex` always skips over it. Crossing a checkpoint (forward or backward) is evaluated by pure helper functions at the moment of the attempt; failures/confirmations surface through one new modal component. A pre-existing bug (location IDs keyed on raw array position instead of a stable count) is fixed first, since it's what checkpoints would otherwise silently break.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + @testing-library/svelte, existing YAML content pipeline (`@modyfi/vite-plugin-yaml`, Ajv schema validation).

## Global Constraints

- TypeScript only; no `.js`/`.jsx`/`.tsx` under `src/`.
- Co-located `.css` files per component; only CSS custom properties for colour, no hard-coded hex except where an existing file already does (e.g. `#fff`/`#000` button text, matching `AppForm.css`/`OptionsScreen.css` precedent).
- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`) — no `$:`.
- New route-entry YAML keys that aren't valid JS identifiers (`re-entry`, `template-type`) use string-literal TS keys, matching the existing `"nav-bar"` / `"template-type"` convention in `src/types/data.ts`.
- Every new/changed test file follows existing Vitest + `@testing-library/svelte/svelte5` conventions already used in `src/test/`.
- Full spec: `doc/superpowers/specs/2026-07-27-route-checkpoints-design.md`. Every task below implements a specific section of it — re-read the relevant section if a step is unclear.

---

### Task 1: Stable location IDs (prerequisite fix)

**Files:**
- Modify: `src/pages/RoutePage.svelte:207-228` (restore loop), `:258` (`currentLocationId`), `:328` (snap-mode `RouteScreen` `index`), `:335` (snap-mode `computeBadgeStatus` call), `:358` (carousel-mode `RouteScreen` `index`), `:365` (carousel-mode `computeBadgeStatus` call)
- Modify: `src/test/RoutePage.test.ts`
- Test: `src/test/RoutePage.test.ts`

**Interfaces:**
- Consumes: `locationOrdinalAt(entries: RouteEntry[], index: number): number` — already exported from `src/utils/routeEntries.ts`, already imported in `RoutePage.svelte`. No new import needed.
- Produces: every `index`/`locationId` value RoutePage passes downstream is now `locationOrdinalAt(entries, arrayIndex)` instead of `arrayIndex + 1`. Later tasks (6, 7) build on this — the checkpoint `forms` requirement evaluator keys its form-completion lookups by this same ordinal.

Today, `ChallengeCard`'s badge number, `ChallengeForm`'s `locationId`, and every `formStatusByIndex`/`skippedIndices`/`buildFormStorageKey` key are the entry's raw array position (`index + 1`). `000_options_eula` already sits at position 0 in the live route, so every location's ID is already off by one from where it "should" be. `locationOrdinalAt` (already used for the "N of M" progress indicator) is the fix — it counts only `location`-type entries, so it's stable no matter what non-location entries (checkpoints included) get inserted around a location.

- [ ] **Step 1: Write the failing badge-stability test**

Add to `src/test/RoutePage.test.ts` (after the existing `"does not render a numbered badge..."` test):

```ts
test("badge number reflects location ordinal, not raw array position, when a non-location entry precedes it", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockMixedEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  expect(screen.getByTestId("location-badge")).toHaveTextContent("1");

  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i })); // -> text screen
  await screen.findByText("Between Stops");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i })); // -> Location 2, raw index 2
  await screen.findByText("Location 2");
  // Location 2 is the 2nd location overall, even though it sits at raw array
  // index 2 (raw position + 1 would wrongly read "3").
  expect(screen.getByTestId("location-badge")).toHaveTextContent("2");
});
```

- [ ] **Step 2: Write the failing form-storage-key-stability test**

Add to the hoisted fixtures block in `src/test/RoutePage.test.ts` (alongside `mockMixedEntries`):

```ts
mockPrecededByTextEntries: [
  { "template-type": "text", title: "Heads up", text: "Read this first." },
  {
    title: "Loc 1",
    name: { value: "Location 1" },
    coordinates: { latitude: 52.0, longitude: 4.0 },
    storyline: "Story 1",
    breadcrumb: "Step 1",
    challenge: {
      name: "Challenge 1",
      description: "Desc 1",
      form: [{ id: "note", type: "string" as const, label: "Your note" }],
    },
  },
],
```

Add the test itself:

```ts
test("form answers persist under a key keyed by location ordinal, unaffected by a preceding non-location entry", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockPrecededByTextEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Heads up");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await screen.findByText("Location 1");
  await fireEvent.input(screen.getByLabelText("Your note"), { target: { value: "some text" } });
  await fireEvent.click(await screen.findByRole("button", { name: /submit/i }));
  await fireEvent.click(await screen.findByRole("button", { name: /confirm/i }));
  await waitFor(() => {
    // Ordinal 1 (it's the first location), not raw-position 2.
    const stored = localStorage.getItem("democrats_abroad/den_haag/short_loop/1/form");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).submitted).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:run -- RoutePage.test.ts`
Expected: the two new tests FAIL — badge shows "3" instead of "2"; the storage key is stored under `.../2/form`, not `.../1/form`.

- [ ] **Step 4: Fix the existing EULA-tracking assertion in advance (it will also change)**

In `src/test/RoutePage.test.ts`, find the test `"clicking a tracked 'continue' option advances and submits a form even with the nav bar hidden"`. It currently asserts:

```ts
expect(postFormSubmit).toHaveBeenCalledWith(
  expect.objectContaining({ locationId: 1, answers: { selected: "I understand" } }),
);
```

Change `locationId: 1` to `locationId: 0` — `mockEulaEntries[0]` is the EULA options screen itself, at a point where zero locations have been passed yet, so its ordinal-based id is `0` (matching the existing "progress holds at the last-passed location's ordinal" convention already documented for template screens).

- [ ] **Step 5: Implement the fix in RoutePage.svelte**

In `src/pages/RoutePage.svelte`, change the restore loop (currently around line 211-212):

```ts
entries.forEach((_entry, i) => {
  const locId = i + 1;
```

to:

```ts
entries.forEach((_entry, i) => {
  const locId = locationOrdinalAt(entries, i);
```

Change `currentLocationId` (currently line 258):

```ts
let currentLocationId = $derived(currentIndex + 1);
```

to:

```ts
let currentLocationId = $derived(locationOrdinalAt(entries, currentIndex));
```

In the snap-mode template block, change:

```svelte
index={currentIndex + 1}
```

to:

```svelte
index={currentLocationId}
```

and change:

```svelte
badgeStatus={computeBadgeStatus(currentIndex + 1, currentHasForm)}
```

to:

```svelte
badgeStatus={computeBadgeStatus(currentLocationId, currentHasForm)}
```

In the carousel-mode template block (the `{#each [0, 1, 2] as slotIdx}` loop), change:

```svelte
index={locIdx + 1}
```

to:

```svelte
index={locationOrdinalAt(entries, locIdx)}
```

and change:

```svelte
badgeStatus={computeBadgeStatus(locIdx + 1, isLocationEntry(slotEntry) && (slotEntry.challenge.form?.length ?? 0) > 0)}
```

to:

```svelte
badgeStatus={computeBadgeStatus(locationOrdinalAt(entries, locIdx), isLocationEntry(slotEntry) && (slotEntry.challenge.form?.length ?? 0) > 0)}
```

`handleSkip` (currently `const locId = currentLocationId;`) needs no change — it already reads the now-corrected `currentLocationId`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:run -- RoutePage.test.ts`
Expected: all tests in the file PASS, including the two new ones.

- [ ] **Step 7: Run the full suite to check for regressions elsewhere**

Run: `npm run test:run`
Expected: PASS. (No other file computes location IDs independently — `ChallengeCard.svelte` and `ChallengeForm.svelte` only ever display/forward whatever `index`/`locationId` they're given.)

- [ ] **Step 8: Commit**

```bash
git add src/pages/RoutePage.svelte src/test/RoutePage.test.ts
git commit -m "fix: key location form/badge state by location ordinal, not raw array position"
```

---

### Task 2: Requirement types and the requirement engine

**Files:**
- Modify: `src/types/data.ts`
- Create: `src/utils/routeRequirements.ts`
- Test: `src/test/routeRequirements.test.ts`

**Interfaces:**
- Consumes: `isLocationEntry` from `src/utils/routeEntries.ts`; `locationOrdinalAt` from the same file.
- Produces: `RouteRequirement`, `FormsRequirement`, `PeriodRequirement`, `CheckpointEntry`, `CheckpointEntryGate`, `CheckpointReEntryGate` types (in `data.ts`); `evaluateGate(requirements, ctx): { met: boolean; message?: string }` and `RequirementContext` (in `routeRequirements.ts`). Task 3 imports `CheckpointEntry`/`isCheckpointEntry` (the latter lives in Task 3's own file). Task 6 imports `evaluateGate` and `RequirementContext`.

- [ ] **Step 1: Add the new types to `src/types/data.ts`**

Add after the existing `OptionsEntry`/`OptionTarget` definitions, before the `RouteEntry` union:

```ts
export interface FormsRequirement {
  type: "forms";
  requires_all_forms_completed?: boolean;
  min_completed_forms?: number;
  include_skipped?: boolean;
  on_fail: { message: string; include_missing_forms?: boolean };
}

export interface PeriodBound {
  operator?: "<" | "<=" | "=" | ">" | ">=";
  date: string;
}

export interface PeriodRequirement {
  type: "period";
  start?: PeriodBound;
  end?: PeriodBound;
  on_fail: { message: string; include_period?: boolean };
}

export type RouteRequirement = FormsRequirement | PeriodRequirement;

export interface CheckpointEntryGate {
  requirements?: RouteRequirement[];
  skippable?: boolean;
  on_succeed?: { message: string; include_missing_forms?: boolean };
}

export interface CheckpointReEntryGate {
  blocked_after_exit?: boolean;
}

export interface CheckpointEntry {
  "template-type": "checkpoint";
  entry?: CheckpointEntryGate;
  "re-entry"?: boolean | CheckpointReEntryGate;
}
```

Change the `RouteEntry` union from:

```ts
export type RouteEntry = LocationEntry | TextEntry | SplashEntry | OptionsEntry;
```

to:

```ts
export type RouteEntry = LocationEntry | TextEntry | SplashEntry | OptionsEntry | CheckpointEntry;
```

- [ ] **Step 2: Write the failing tests for the `forms` requirement**

Create `src/test/routeRequirements.test.ts`:

```ts
import { evaluateGate } from "../utils/routeRequirements";
import type { RouteEntry, FormsRequirement } from "../types/data";

function locationWithForm(title: string): RouteEntry {
  return {
    title,
    name: { value: title },
    coordinates: { latitude: 0, longitude: 0 },
    storyline: "s",
    breadcrumb: "b",
    challenge: { name: "", description: "d", form: [{ id: "note", type: "string", label: "Note" }] },
  };
}

const entries: RouteEntry[] = [
  locationWithForm("Loc A"), // ordinal 1
  { "template-type": "text", title: "T", text: "..." },
  locationWithForm("Loc B"), // ordinal 2
  { "template-type": "checkpoint" }, // index 3 — the checkpoint being evaluated
];

test("forms requirement passes trivially when the requirements list is empty", () => {
  expect(evaluateGate(undefined, { entries, beforeIndex: 3, formStatusByIndex: {}, skippedIndices: new Set() })).toEqual({
    met: true,
  });
});

test("requires_all_forms_completed fails when any earlier form is incomplete, with missing titles listed", () => {
  const req: FormsRequirement = {
    type: "forms",
    requires_all_forms_completed: true,
    on_fail: { message: "Please finish up" },
  };
  const result = evaluateGate([req], {
    entries,
    beforeIndex: 3,
    formStatusByIndex: { 1: { submitted: true, missingLabels: [] } },
    skippedIndices: new Set(),
  });
  expect(result.met).toBe(false);
  expect(result.message).toContain("Please finish up");
  expect(result.message).toContain("Loc B");
});

test("requires_all_forms_completed passes once every earlier form is submitted", () => {
  const req: FormsRequirement = {
    type: "forms",
    requires_all_forms_completed: true,
    on_fail: { message: "Please finish up" },
  };
  const result = evaluateGate([req], {
    entries,
    beforeIndex: 3,
    formStatusByIndex: {
      1: { submitted: true, missingLabels: [] },
      2: { submitted: true, missingLabels: [] },
    },
    skippedIndices: new Set(),
  });
  expect(result).toEqual({ met: true });
});

test("include_skipped (default true) counts a skipped form as completed", () => {
  const req: FormsRequirement = {
    type: "forms",
    requires_all_forms_completed: true,
    on_fail: { message: "Please finish up" },
  };
  const result = evaluateGate([req], {
    entries,
    beforeIndex: 3,
    formStatusByIndex: { 1: { submitted: true, missingLabels: [] } },
    skippedIndices: new Set([2]),
  });
  expect(result).toEqual({ met: true });
});

test("include_skipped: false does not count a skipped form as completed", () => {
  const req: FormsRequirement = {
    type: "forms",
    requires_all_forms_completed: true,
    include_skipped: false,
    on_fail: { message: "Please finish up" },
  };
  const result = evaluateGate([req], {
    entries,
    beforeIndex: 3,
    formStatusByIndex: { 1: { submitted: true, missingLabels: [] } },
    skippedIndices: new Set([2]),
  });
  expect(result.met).toBe(false);
});

test("min_completed_forms passes once the threshold count is met, without requiring all", () => {
  const req: FormsRequirement = {
    type: "forms",
    min_completed_forms: 1,
    on_fail: { message: "Please finish up" },
  };
  const result = evaluateGate([req], {
    entries,
    beforeIndex: 3,
    formStatusByIndex: { 1: { submitted: true, missingLabels: [] } },
    skippedIndices: new Set(),
  });
  expect(result).toEqual({ met: true });
});

test("on_fail.include_missing_forms: false omits the missing-form titles from the message", () => {
  const req: FormsRequirement = {
    type: "forms",
    requires_all_forms_completed: true,
    on_fail: { message: "Please finish up", include_missing_forms: false },
  };
  const result = evaluateGate([req], {
    entries,
    beforeIndex: 3,
    formStatusByIndex: {},
    skippedIndices: new Set(),
  });
  expect(result.message).toBe("Please finish up");
});

test("only counts locations strictly before beforeIndex, ignoring anything at or after it", () => {
  const req: FormsRequirement = {
    type: "forms",
    requires_all_forms_completed: true,
    on_fail: { message: "Please finish up" },
  };
  // beforeIndex 1 -> only "Loc A" (index 0) counts; "Loc B" at index 2 is not yet in scope.
  const result = evaluateGate([req], {
    entries,
    beforeIndex: 1,
    formStatusByIndex: { 1: { submitted: true, missingLabels: [] } },
    skippedIndices: new Set(),
  });
  expect(result).toEqual({ met: true });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:run -- routeRequirements.test.ts`
Expected: FAIL with "Cannot find module '../utils/routeRequirements'".

- [ ] **Step 4: Implement the `forms` evaluator and `evaluateGate` dispatcher**

Create `src/utils/routeRequirements.ts`:

```ts
import type { RouteEntry, RouteRequirement, FormsRequirement, PeriodRequirement, LocationEntry } from "../types/data";
import { isLocationEntry, locationOrdinalAt } from "./routeEntries";

export interface RequirementContext {
  entries: RouteEntry[];
  /** Only entries with array index strictly less than this are in scope. */
  beforeIndex: number;
  formStatusByIndex: Record<number, { submitted: boolean }>;
  skippedIndices: Set<number>;
  now?: Date;
}

export interface RequirementCheckResult {
  met: boolean;
  message?: string;
}

function priorLocationsWithForms(ctx: RequirementContext): Array<{ entry: LocationEntry; index: number }> {
  return ctx.entries
    .map((entry, index) => ({ entry, index }))
    .filter(
      (item): item is { entry: LocationEntry; index: number } =>
        item.index < ctx.beforeIndex &&
        isLocationEntry(item.entry) &&
        (item.entry.challenge.form?.length ?? 0) > 0,
    );
}

function isFormComplete(
  ctx: RequirementContext,
  includeSkipped: boolean,
  index: number,
): boolean {
  const locationId = locationOrdinalAt(ctx.entries, index);
  const submitted = ctx.formStatusByIndex[locationId]?.submitted ?? false;
  const skipped = ctx.skippedIndices.has(locationId);
  return submitted || (includeSkipped && skipped);
}

function evaluateForms(req: FormsRequirement, ctx: RequirementContext): RequirementCheckResult {
  const candidates = priorLocationsWithForms(ctx);
  const includeSkipped = req.include_skipped ?? true;
  const complete = candidates.filter(({ index }) => isFormComplete(ctx, includeSkipped, index));

  const met = req.requires_all_forms_completed
    ? complete.length === candidates.length
    : complete.length >= (req.min_completed_forms ?? 0);

  if (met) {
    return { met: true };
  }

  const includeMissing = req.on_fail.include_missing_forms ?? true;
  if (!includeMissing) {
    return { met: false, message: req.on_fail.message };
  }
  const missingTitles = candidates
    .filter(({ index }) => !isFormComplete(ctx, includeSkipped, index))
    .map(({ entry }) => entry.title);
  const message =
    missingTitles.length > 0
      ? `${req.on_fail.message}\n\nMissing: ${missingTitles.join(", ")}`
      : req.on_fail.message;
  return { met: false, message };
}

function compareOp(a: number, operator: PeriodBoundOperator, b: number): boolean {
  switch (operator) {
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case "=":
      return a === b;
    case ">":
      return a > b;
    case ">=":
    default:
      return a >= b;
  }
}

type PeriodBoundOperator = NonNullable<PeriodRequirement["start"]>["operator"];

function periodMessage(req: PeriodRequirement): string {
  const includePeriod = req.on_fail.include_period ?? true;
  if (!includePeriod) {
    return req.on_fail.message;
  }
  const parts: string[] = [];
  if (req.start) {
    parts.push(`from ${req.start.date}`);
  }
  if (req.end) {
    parts.push(`until ${req.end.date}`);
  }
  return parts.length > 0 ? `${req.on_fail.message} (${parts.join(", ")})` : req.on_fail.message;
}

function evaluatePeriod(req: PeriodRequirement, now: Date): RequirementCheckResult {
  const nowMs = now.getTime();
  if (req.start && !compareOp(nowMs, req.start.operator ?? ">=", new Date(req.start.date).getTime())) {
    return { met: false, message: periodMessage(req) };
  }
  if (req.end && !compareOp(nowMs, req.end.operator ?? "<=", new Date(req.end.date).getTime())) {
    return { met: false, message: periodMessage(req) };
  }
  return { met: true };
}

export function evaluateGate(
  requirements: RouteRequirement[] | undefined,
  ctx: RequirementContext,
): RequirementCheckResult {
  for (const requirement of requirements ?? []) {
    const result =
      requirement.type === "forms" ? evaluateForms(requirement, ctx) : evaluatePeriod(requirement, ctx.now ?? new Date());
    if (!result.met) {
      return result;
    }
  }
  return { met: true };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:run -- routeRequirements.test.ts`
Expected: PASS (all 8 tests).

- [ ] **Step 6: Add and run the `period` requirement tests**

Append to `src/test/routeRequirements.test.ts`:

```ts
import type { PeriodRequirement } from "../types/data";

test("period requirement fails before the start date", () => {
  const req: PeriodRequirement = {
    type: "period",
    start: { date: "2026-08-01" },
    on_fail: { message: "Not open yet" },
  };
  const result = evaluateGate([req], {
    entries: [],
    beforeIndex: 0,
    formStatusByIndex: {},
    skippedIndices: new Set(),
    now: new Date("2026-07-01"),
  });
  expect(result.met).toBe(false);
  expect(result.message).toBe("Not open yet (from 2026-08-01)");
});

test("period requirement passes within the start/end window", () => {
  const req: PeriodRequirement = {
    type: "period",
    start: { date: "2026-07-01" },
    end: { date: "2026-08-01" },
    on_fail: { message: "Not open yet" },
  };
  const result = evaluateGate([req], {
    entries: [],
    beforeIndex: 0,
    formStatusByIndex: {},
    skippedIndices: new Set(),
    now: new Date("2026-07-15"),
  });
  expect(result).toEqual({ met: true });
});

test("period requirement fails after the end date", () => {
  const req: PeriodRequirement = {
    type: "period",
    end: { date: "2026-07-01" },
    on_fail: { message: "Route closed", include_period: false },
  };
  const result = evaluateGate([req], {
    entries: [],
    beforeIndex: 0,
    formStatusByIndex: {},
    skippedIndices: new Set(),
    now: new Date("2026-07-15"),
  });
  expect(result).toEqual({ met: false, message: "Route closed" });
});

test("evaluateGate short-circuits on the first failing requirement and ignores the rest", () => {
  const failing: PeriodRequirement = {
    type: "period",
    start: { date: "2099-01-01" },
    on_fail: { message: "First failure" },
  };
  const alsoFailing: PeriodRequirement = {
    type: "period",
    start: { date: "2099-01-01" },
    on_fail: { message: "Second failure" },
  };
  const result = evaluateGate([failing, alsoFailing], {
    entries: [],
    beforeIndex: 0,
    formStatusByIndex: {},
    skippedIndices: new Set(),
    now: new Date("2026-07-15"),
  });
  expect(result.message).toBe("First failure");
});
```

Run: `npm run test:run -- routeRequirements.test.ts`
Expected: PASS (12 tests total).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/types/data.ts src/utils/routeRequirements.ts src/test/routeRequirements.test.ts
git commit -m "feat: add checkpoint requirement types and the forms/period requirement engine"
```

---

### Task 3: Checkpoint navigation helpers

**Files:**
- Create: `src/utils/checkpointNav.ts`
- Test: `src/test/checkpointNav.test.ts`

**Interfaces:**
- Consumes: `CheckpointEntry`, `RouteEntry` from `src/types/data.ts` (Task 2).
- Produces: `isCheckpointEntry(entry): entry is CheckpointEntry`, `nextNavigableIndex(entries, current): number`, `prevNavigableIndex(entries, current): number`, `CheckpointCrossing { index: number; checkpoint: CheckpointEntry }`, `checkpointsBetween(entries, from, to): CheckpointCrossing[]`, `isBackwardCrossingBlocked(entries, from, to): boolean`, `earliestAllowedIndex(entries, current): number`. Task 6/7 import all of these.

- [ ] **Step 1: Write the failing tests**

Create `src/test/checkpointNav.test.ts`:

```ts
import {
  isCheckpointEntry,
  nextNavigableIndex,
  prevNavigableIndex,
  checkpointsBetween,
  isBackwardCrossingBlocked,
  earliestAllowedIndex,
} from "../utils/checkpointNav";
import type { RouteEntry } from "../types/data";

const loc: RouteEntry = {
  title: "L",
  name: { value: "L" },
  coordinates: { latitude: 0, longitude: 0 },
  storyline: "s",
  breadcrumb: "b",
  challenge: { name: "", description: "d", form: [] },
};

test("isCheckpointEntry is true only for template-type checkpoint", () => {
  expect(isCheckpointEntry({ "template-type": "checkpoint" })).toBe(true);
  expect(isCheckpointEntry(loc)).toBe(false);
});

test("nextNavigableIndex steps to the next entry when there is no checkpoint", () => {
  const entries = [loc, loc, loc];
  expect(nextNavigableIndex(entries, 0)).toBe(1);
});

test("nextNavigableIndex skips over a single checkpoint", () => {
  const entries = [loc, { "template-type": "checkpoint" } as RouteEntry, loc];
  expect(nextNavigableIndex(entries, 0)).toBe(2);
});

test("nextNavigableIndex skips over consecutive checkpoints", () => {
  const entries = [
    loc,
    { "template-type": "checkpoint" } as RouteEntry,
    { "template-type": "checkpoint" } as RouteEntry,
    loc,
  ];
  expect(nextNavigableIndex(entries, 0)).toBe(3);
});

test("nextNavigableIndex no-ops when a checkpoint is the last entry (trailing checkpoint)", () => {
  const entries = [loc, { "template-type": "checkpoint" } as RouteEntry];
  expect(nextNavigableIndex(entries, 0)).toBe(0);
});

test("nextNavigableIndex no-ops at the true end of a route with no checkpoints", () => {
  const entries = [loc, loc];
  expect(nextNavigableIndex(entries, 1)).toBe(1);
});

test("prevNavigableIndex steps back to the previous entry when there is no checkpoint", () => {
  const entries = [loc, loc, loc];
  expect(prevNavigableIndex(entries, 2)).toBe(1);
});

test("prevNavigableIndex skips backward over a checkpoint", () => {
  const entries = [loc, { "template-type": "checkpoint" } as RouteEntry, loc];
  expect(prevNavigableIndex(entries, 2)).toBe(0);
});

test("checkpointsBetween returns checkpoints strictly between two indices, with their own array index", () => {
  const checkpoint = { "template-type": "checkpoint" } as RouteEntry;
  const entries = [loc, checkpoint, loc];
  expect(checkpointsBetween(entries, 0, 2)).toEqual([{ index: 1, checkpoint }]);
});

test("checkpointsBetween returns an empty array when nothing lies between", () => {
  const entries = [loc, loc];
  expect(checkpointsBetween(entries, 0, 1)).toEqual([]);
});

test("isBackwardCrossingBlocked is true for the 're-entry: false' shorthand", () => {
  const entries = [{ "template-type": "checkpoint", "re-entry": false } as RouteEntry, loc];
  expect(isBackwardCrossingBlocked(entries, 0, 1)).toBe(true);
});

test("isBackwardCrossingBlocked defaults blocked_after_exit to true when re-entry is an object", () => {
  const entries = [{ "template-type": "checkpoint", "re-entry": {} } as RouteEntry, loc];
  expect(isBackwardCrossingBlocked(entries, 0, 1)).toBe(true);
});

test("isBackwardCrossingBlocked is false when blocked_after_exit is explicitly false", () => {
  const entries = [
    { "template-type": "checkpoint", "re-entry": { blocked_after_exit: false } } as RouteEntry,
    loc,
  ];
  expect(isBackwardCrossingBlocked(entries, 0, 1)).toBe(false);
});

test("isBackwardCrossingBlocked is false when there is no checkpoint between the two indices", () => {
  const entries = [loc, loc];
  expect(isBackwardCrossingBlocked(entries, 0, 1)).toBe(false);
});

test("earliestAllowedIndex is 0 for a route with no blocking checkpoints", () => {
  const entries = [loc, loc, loc];
  expect(earliestAllowedIndex(entries, 2)).toBe(0);
});

test("earliestAllowedIndex stops at the position right after a blocked checkpoint", () => {
  // loc(0), checkpoint(1, re-entry:false), loc(2), loc(3) -- currently at 3
  const entries = [
    loc,
    { "template-type": "checkpoint", "re-entry": false } as RouteEntry,
    loc,
    loc,
  ];
  expect(earliestAllowedIndex(entries, 3)).toBe(2);
});

test("earliestAllowedIndex returns the current position when nothing lies further back at all", () => {
  // A checkpoint at the very start of a route: once mount-normalization lands
  // on index 1, there is nothing real before it to retreat to (regardless of
  // whether the checkpoint itself blocks re-entry).
  const entries = [{ "template-type": "checkpoint" } as RouteEntry, loc];
  expect(earliestAllowedIndex(entries, 1)).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- checkpointNav.test.ts`
Expected: FAIL with "Cannot find module '../utils/checkpointNav'".

- [ ] **Step 3: Implement `checkpointNav.ts`**

Create `src/utils/checkpointNav.ts`:

```ts
import type { RouteEntry, CheckpointEntry } from "../types/data";

export function isCheckpointEntry(entry: RouteEntry): entry is CheckpointEntry {
  return entry["template-type"] === "checkpoint";
}

export function nextNavigableIndex(entries: RouteEntry[], current: number): number {
  let i = current + 1;
  while (i < entries.length && isCheckpointEntry(entries[i])) {
    i += 1;
  }
  return i < entries.length ? i : current;
}

export function prevNavigableIndex(entries: RouteEntry[], current: number): number {
  let i = current - 1;
  while (i >= 0 && isCheckpointEntry(entries[i])) {
    i -= 1;
  }
  return i >= 0 ? i : current;
}

export interface CheckpointCrossing {
  index: number;
  checkpoint: CheckpointEntry;
}

export function checkpointsBetween(entries: RouteEntry[], from: number, to: number): CheckpointCrossing[] {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const result: CheckpointCrossing[] = [];
  for (let i = lo + 1; i < hi; i += 1) {
    const entry = entries[i];
    if (isCheckpointEntry(entry)) {
      result.push({ index: i, checkpoint: entry });
    }
  }
  return result;
}

export function isBackwardCrossingBlocked(entries: RouteEntry[], from: number, to: number): boolean {
  return checkpointsBetween(entries, from, to).some(({ checkpoint }) => {
    const reEntry = checkpoint["re-entry"];
    if (reEntry === undefined || reEntry === true) {
      return false;
    }
    if (reEntry === false) {
      return true; // shorthand for { blocked_after_exit: true }
    }
    return reEntry.blocked_after_exit ?? true;
  });
}

export function earliestAllowedIndex(entries: RouteEntry[], current: number): number {
  let position = current;
  while (position > 0) {
    const prev = prevNavigableIndex(entries, position);
    if (prev === position) {
      break; // nothing further back to go to — position is the floor
    }
    if (isBackwardCrossingBlocked(entries, prev, position)) {
      return position;
    }
    position = prev;
  }
  return position;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- checkpointNav.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/checkpointNav.ts src/test/checkpointNav.test.ts
git commit -m "feat: add checkpoint navigation helpers (skip-over index math, backward-block detection)"
```

---

### Task 4: `RouteScreen` defensive checkpoint branch

**Files:**
- Modify: `src/components/RouteScreen.svelte`
- Test: `src/test/RouteScreen.test.ts`

**Interfaces:**
- Consumes: nothing new — pure template branch on `entry["template-type"]`.
- Produces: a checkpoint entry passed to `RouteScreen` renders nothing, instead of falling through to `ChallengeCard` (which would crash reading `location.coordinates`/`location.challenge` off a checkpoint file).

- [ ] **Step 1: Write the failing test**

Add to `src/test/RouteScreen.test.ts`:

```ts
test("renders nothing for a checkpoint entry instead of falling through to ChallengeCard", () => {
  const { container } = render(RouteScreen, {
    props: { entry: { "template-type": "checkpoint", "re-entry": false } as RouteEntry, index: 1 },
  });
  expect(container.querySelector(".cc-root")).not.toBeInTheDocument();
  expect(screen.queryByTestId("location-badge")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- RouteScreen.test.ts`
Expected: FAIL — `.cc-root` is present (checkpoint fell through to `ChallengeCard`), likely alongside console errors from `location.coordinates` being undefined.

- [ ] **Step 3: Add the defensive branch**

In `src/components/RouteScreen.svelte`, change:

```svelte
{#if entry["template-type"] === "text"}
```

to:

```svelte
{#if entry["template-type"] === "checkpoint"}
  <!--
    Checkpoints are navigation gates evaluated by RoutePage — they must never
    become the "current" rendered entry. This branch is defense in depth: if
    that invariant is ever violated, render nothing rather than falling
    through to ChallengeCard and crashing on Location-shaped field access
    against a file that has none of those fields.
  -->
{:else if entry["template-type"] === "text"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- RouteScreen.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/RouteScreen.svelte src/test/RouteScreen.test.ts
git commit -m "fix: RouteScreen renders nothing for checkpoint entries instead of crashing"
```

---

### Task 5: `CheckpointGateModal` component

**Files:**
- Create: `src/components/CheckpointGateModal.svelte`
- Create: `src/components/CheckpointGateModal.css`
- Test: `src/test/CheckpointGateModal.test.ts`

**Interfaces:**
- Consumes: `MarkdownText` (`src/components/MarkdownText.svelte`), the local `portal` action pattern already used in `AppForm.svelte` (appends to `document.body` so the modal escapes the carousel's `transform`-based ancestor stacking context).
- Produces: `CheckpointGateModal` with props `{ message: string; mode: "fail" | "succeed"; skippable?: boolean; onStay: () => void; onProceed?: () => void }`. Task 6 imports and wires this component.

- [ ] **Step 1: Write the failing tests**

Create `src/test/CheckpointGateModal.test.ts`:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import CheckpointGateModal from "../components/CheckpointGateModal.svelte";

test("renders the message", () => {
  render(CheckpointGateModal, { props: { message: "Please finish up", mode: "fail", onStay: vi.fn() } });
  expect(screen.getByText("Please finish up")).toBeInTheDocument();
});

test("fail mode with skippable shows Go Back and Skip, and wires each action", async () => {
  const onStay = vi.fn();
  const onProceed = vi.fn();
  render(CheckpointGateModal, {
    props: { message: "msg", mode: "fail", skippable: true, onStay, onProceed },
  });
  await fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  expect(onProceed).toHaveBeenCalledOnce();
  await fireEvent.click(screen.getByRole("button", { name: "Go Back" }));
  expect(onStay).toHaveBeenCalledOnce();
});

test("fail mode without skippable shows only Go Back", () => {
  render(CheckpointGateModal, { props: { message: "msg", mode: "fail", skippable: false, onStay: vi.fn() } });
  expect(screen.getByRole("button", { name: "Go Back" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
});

test("succeed mode shows Cancel and Continue, and wires each action", async () => {
  const onStay = vi.fn();
  const onProceed = vi.fn();
  render(CheckpointGateModal, { props: { message: "msg", mode: "succeed", onStay, onProceed } });
  await fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(onProceed).toHaveBeenCalledOnce();
  await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onStay).toHaveBeenCalledOnce();
});

test("never auto-dismisses", () => {
  vi.useFakeTimers();
  const onStay = vi.fn();
  render(CheckpointGateModal, { props: { message: "msg", mode: "fail", onStay } });
  vi.advanceTimersByTime(10_000);
  expect(onStay).not.toHaveBeenCalled();
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- CheckpointGateModal.test.ts`
Expected: FAIL with "Cannot find module '../components/CheckpointGateModal.svelte'".

- [ ] **Step 3: Implement the component**

Create `src/components/CheckpointGateModal.svelte`:

```svelte
<script lang="ts">
  import MarkdownText from "./MarkdownText.svelte";
  import "./CheckpointGateModal.css";

  let {
    message,
    mode,
    skippable = true,
    onStay,
    onProceed = undefined,
  }: {
    message: string;
    mode: "fail" | "succeed";
    skippable?: boolean;
    onStay: () => void;
    onProceed?: () => void;
  } = $props();

  // Escapes the carousel's transform-based ancestor stacking context, matching
  // the existing local `portal` helper already used by AppForm's confirm dialog.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  let showProceed = $derived(mode === "succeed" || (mode === "fail" && skippable));
</script>

<div class="checkpoint-gate-modal__overlay" use:portal>
  <div class="checkpoint-gate-modal__dialog" role="alertdialog" aria-modal="true">
    <div class="checkpoint-gate-modal__message">
      <MarkdownText text={message} />
    </div>
    <div class="checkpoint-gate-modal__actions">
      <button class="checkpoint-gate-modal__stay" onclick={onStay}>
        {mode === "fail" ? "Go Back" : "Cancel"}
      </button>
      {#if showProceed}
        <button class="checkpoint-gate-modal__proceed" onclick={onProceed}>
          {mode === "fail" ? "Skip" : "Continue"}
        </button>
      {/if}
    </div>
  </div>
</div>
```

Create `src/components/CheckpointGateModal.css`:

```css
/* src/components/CheckpointGateModal.css */

.checkpoint-gate-modal__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.checkpoint-gate-modal__dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 24px 20px 18px;
  width: min(340px, 90vw);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.checkpoint-gate-modal__message {
  font-size: var(--font-size-base);
  color: var(--color-text);
  text-align: center;
}

.checkpoint-gate-modal__actions {
  display: flex;
  gap: 10px;
}

.checkpoint-gate-modal__stay {
  flex: 1;
  padding: 10px 0;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
}

.checkpoint-gate-modal__proceed {
  flex: 1;
  padding: 10px 0;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- CheckpointGateModal.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/CheckpointGateModal.svelte src/components/CheckpointGateModal.css src/test/CheckpointGateModal.test.ts
git commit -m "feat: add CheckpointGateModal (fail/succeed dialog, no auto-dismiss)"
```

---

### Task 6: RoutePage — forward-crossing checkpoint gating

**Files:**
- Modify: `src/pages/RoutePage.svelte`
- Test: `src/test/RoutePage.test.ts`

**Interfaces:**
- Consumes: `nextNavigableIndex`, `checkpointsBetween`, `isCheckpointEntry` (`src/utils/checkpointNav.ts`); `evaluateGate` (`src/utils/routeRequirements.ts`); `CheckpointGateModal` (Task 5).
- Produces: `attemptAdvance(from?: number)` — the single function every forward-advance path (Next button, swipe-left in both modes, options-screen "continue", the existing per-location Skip action, and mount-time normalization) now funnels through.

This is the core of the feature: every existing "move forward" call site currently computes `clampedNext(currentIndex, entries.length)` directly. They all change to ask `attemptAdvance()` to decide, which may (a) commit immediately, (b) show a fail dialog with optional Skip, or (c) show a succeed/confirm dialog.

- [ ] **Step 1: Write the failing tests**

Add to the hoisted fixtures block in `src/test/RoutePage.test.ts`:

```ts
mockCheckpointGateEntries: [
  {
    title: "Loc 1",
    name: { value: "Location 1" },
    coordinates: { latitude: 52.0, longitude: 4.0 },
    storyline: "Story 1",
    breadcrumb: "Step 1",
    challenge: {
      name: "Challenge 1",
      description: "Desc 1",
      form: [{ id: "note", type: "string" as const, label: "Your note" }],
    },
  },
  {
    "template-type": "checkpoint",
    entry: {
      requirements: [
        {
          type: "forms",
          requires_all_forms_completed: true,
          on_fail: { message: "Forms still open" },
        },
      ],
      skippable: true,
    },
  },
  {
    title: "Loc 2",
    name: { value: "Location 2" },
    coordinates: { latitude: 52.1, longitude: 4.1 },
    storyline: "Story 2",
    breadcrumb: "Step 2",
    challenge: { name: "Challenge 2", description: "Desc 2", form: [] },
  },
],
mockLeadingCheckpointEntries: [
  { "template-type": "checkpoint" },
  {
    title: "Loc 1",
    name: { value: "Location 1" },
    coordinates: { latitude: 52.0, longitude: 4.0 },
    storyline: "Story 1",
    breadcrumb: "Step 1",
    challenge: { name: "Challenge 1", description: "Desc 1", form: [] },
  },
],
mockCheckpointSucceedEntries: [
  {
    title: "Loc 1",
    name: { value: "Location 1" },
    coordinates: { latitude: 52.0, longitude: 4.0 },
    storyline: "Story 1",
    breadcrumb: "Step 1",
    challenge: { name: "Challenge 1", description: "Desc 1", form: [] },
  },
  {
    "template-type": "checkpoint",
    entry: { on_succeed: { message: "Ready to finish?" } },
  },
  {
    title: "Loc 2",
    name: { value: "Location 2" },
    coordinates: { latitude: 52.1, longitude: 4.1 },
    storyline: "Story 2",
    breadcrumb: "Step 2",
    challenge: { name: "Challenge 2", description: "Desc 2", form: [] },
  },
],
```

Add the tests:

```ts
test("checkpoint entry gate blocks Next and shows the fail message when its forms requirement is unmet", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockCheckpointGateEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  expect(await screen.findByText("Forms still open")).toBeInTheDocument();
  expect(screen.getByText("Location 1")).toBeInTheDocument(); // did not advance
});

test("Skip on a failed checkpoint gate advances past it", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockCheckpointGateEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await screen.findByText("Forms still open");
  await fireEvent.click(await screen.findByRole("button", { name: "Skip" }));
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
});

test("Go Back on a failed checkpoint gate leaves the participant in place", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockCheckpointGateEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await screen.findByText("Forms still open");
  await fireEvent.click(await screen.findByRole("button", { name: "Go Back" }));
  expect(screen.queryByText("Forms still open")).not.toBeInTheDocument();
  expect(screen.getByText("Location 1")).toBeInTheDocument();
});

test("checkpoint gate passes silently when its forms requirement is already met", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockCheckpointGateEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.input(screen.getByLabelText("Your note"), { target: { value: "answer" } });
  await fireEvent.click(await screen.findByRole("button", { name: /submit/i }));
  await fireEvent.click(await screen.findByRole("button", { name: /confirm/i }));
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
  expect(screen.queryByText("Forms still open")).not.toBeInTheDocument();
});

test("on_succeed shows a confirm dialog; Continue advances, Cancel leaves the participant in place", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockCheckpointSucceedEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  expect(await screen.findByText("Ready to finish?")).toBeInTheDocument();
  await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByText("Ready to finish?")).not.toBeInTheDocument();
  expect(screen.getByText("Location 1")).toBeInTheDocument();

  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
});

test("a checkpoint at the very start of a route is silently skipped on mount", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockLeadingCheckpointEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  // The Prev button's visibility is Task 7's concern (it depends on
  // earliestAllowed, not wired in until then) — this test only covers that
  // mount-time normalization itself lands on the first real entry.
  expect(await screen.findByText("Location 1")).toBeInTheDocument();
});

test("a route with no checkpoints is completely unaffected (regression)", async () => {
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await fireEvent.click(nextBtn);
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- RoutePage.test.ts`
Expected: FAIL — the new tests time out or fail to find "Forms still open" / "Ready to finish?" since nothing evaluates checkpoints yet.

- [ ] **Step 3: Implement — imports and state**

In `src/pages/RoutePage.svelte`, add to the imports:

```ts
import {
  nextNavigableIndex,
  prevNavigableIndex,
  checkpointsBetween,
  isCheckpointEntry,
} from "../utils/checkpointNav";
import { evaluateGate } from "../utils/routeRequirements";
import CheckpointGateModal from "../components/CheckpointGateModal.svelte";
```

Add new state near the existing `showToast`/`toastMissingLabels` declarations:

```ts
let gateModal = $state<{ mode: "fail" | "succeed"; message: string; skippable: boolean; target: number } | null>(null);
let pendingTarget = $state<number | null>(null);
```

- [ ] **Step 4: Implement — `attemptAdvance` and `commitAdvance`**

Add these functions near `handleSkip`:

```ts
function commitAdvance(target: number) {
  if (swipeMode === "snap") {
    direction = "next";
    currentIndex = target;
    dragOffset = 0;
  } else {
    pendingCommit = "next";
    pendingTarget = target;
    isAnimating = true;
    dragOffset = -cardWidth;
  }
}

function springBackIfDragging() {
  if (swipeMode !== "snap" && dragOffset !== 0) {
    isAnimating = true;
    dragOffset = 0;
  }
}

function attemptAdvance(from: number = currentIndex) {
  const target = nextNavigableIndex(entries, from);
  if (target === from) {
    return; // nothing further to advance to
  }
  const crossed = checkpointsBetween(entries, from, target);
  if (crossed.length === 0) {
    commitAdvance(target);
    return;
  }

  for (const { index, checkpoint } of crossed) {
    const result = evaluateGate(checkpoint.entry?.requirements, {
      entries,
      beforeIndex: index,
      formStatusByIndex,
      skippedIndices,
    });
    if (!result.met) {
      gateModal = {
        mode: "fail",
        message: result.message ?? "",
        skippable: checkpoint.entry?.skippable ?? true,
        target,
      };
      springBackIfDragging();
      return;
    }
  }

  const onSucceed = crossed.map(({ checkpoint }) => checkpoint.entry?.on_succeed).find((s) => s !== undefined);
  if (onSucceed) {
    gateModal = { mode: "succeed", message: onSucceed.message, skippable: false, target };
    springBackIfDragging();
    return;
  }

  commitAdvance(target);
}

function resolveGateStay() {
  gateModal = null;
}

function resolveGateProceed() {
  const target = gateModal?.target;
  gateModal = null;
  if (target !== undefined) {
    commitAdvance(target);
  }
}
```

- [ ] **Step 5: Implement — wire existing call sites through `attemptAdvance`**

Replace the snap-mode `handleDragEnd` "next" branch:

```ts
if (delta < -60) {
  if (canAdvance) {
    direction = "next";
    currentIndex = clampedNext(currentIndex, entries.length);
  } else {
    triggerBlockedToast();
  }
} else if (delta > 60) {
  direction = "prev";
  currentIndex = clampedPrev(currentIndex);
}
```

with:

```ts
if (delta < -60) {
  if (canAdvance) {
    attemptAdvance();
  } else {
    triggerBlockedToast();
  }
} else if (delta > 60) {
  direction = "prev";
  currentIndex = prevNavigableIndex(entries, currentIndex);
}
```

Replace the carousel-mode `handleDragEnd` "next" branch:

```ts
if (goingNext && !atEnd && shouldCommitSwipe(delta, cardWidth)) {
  if (canAdvance) {
    pendingCommit = "next";
    isAnimating = true;
    dragOffset = -cardWidth;
  } else {
    triggerBlockedToast();
    if (dragOffset !== 0) {
      isAnimating = true;
      dragOffset = 0;
    }
  }
}
```

with:

```ts
if (goingNext && !atEnd && shouldCommitSwipe(delta, cardWidth)) {
  if (canAdvance) {
    attemptAdvance();
  } else {
    triggerBlockedToast();
    if (dragOffset !== 0) {
      isAnimating = true;
      dragOffset = 0;
    }
  }
}
```

In `handleTransitionEnd`, replace:

```ts
if (pendingCommit === "next") {
  direction = "next";
  currentIndex = clampedNext(currentIndex, entries.length);
  currentSlotIndex = (currentSlotIndex + 1) % 3;
} else if (pendingCommit === "prev") {
  direction = "prev";
  currentIndex = clampedPrev(currentIndex);
  currentSlotIndex = (currentSlotIndex + 2) % 3;
}
pendingCommit = null;
```

with:

```ts
if (pendingCommit === "next" && pendingTarget !== null) {
  direction = "next";
  currentIndex = pendingTarget;
  currentSlotIndex = (currentSlotIndex + 1) % 3;
} else if (pendingCommit === "prev") {
  direction = "prev";
  currentIndex = prevNavigableIndex(entries, currentIndex);
  currentSlotIndex = (currentSlotIndex + 2) % 3;
}
pendingCommit = null;
pendingTarget = null;
```

In `handleSkip`, replace:

```ts
if (swipeMode === "snap") {
  direction = "next";
  currentIndex = clampedNext(currentIndex, entries.length);
} else {
  pendingCommit = "next";
  isAnimating = true;
  dragOffset = -cardWidth;
}
```

with:

```ts
attemptAdvance();
```

(This existing Skip button is for the unrelated per-location `form_required` gate — it should still advance one step, and now correctly runs any checkpoint gate on that same step too, since the two gates are independent per the design spec.)

- [ ] **Step 6: Implement — mount-time normalization**

Add new state and a new `$effect`, near the other entry-loading effects:

```ts
let mountNormalizeAttempted = $state(false);

$effect(() => {
  if (!mountNormalizeAttempted && entries.length > 0) {
    mountNormalizeAttempted = true;
    if (isCheckpointEntry(entries[currentIndex])) {
      attemptAdvance(currentIndex - 1);
    }
  }
});
```

(`currentIndex - 1` as the "from" position makes `attemptAdvance` scan starting at `currentIndex` itself, correctly including a checkpoint sitting at the very start of the route.)

This must run exactly once, guarded by `mountNormalizeAttempted` rather than re-reading `gateModal` reactively. A checkpoint at position 0 whose `entry` gate fails at mount has no earlier real entry to fall back to (`currentIndex` stays on the checkpoint itself, which `RouteScreen`'s Task 4 branch renders as blank rather than crashing). If this effect instead re-ran whenever `gateModal` changed, clicking "Go Back" would clear `gateModal`, which would immediately re-trigger the same failing check and reopen the identical dialog in a loop. The one-shot guard means: dialog shows once; "Go Back" closes it and leaves the participant on a blank screen with no further controls. That's a known, narrow limitation of gating the very start of a route this way — neither of this plan's two concrete checkpoints does that (see the spec's "Edge cases made explicit" section) — not something this task needs to fully solve.

- [ ] **Step 7: Implement — render the modal**

Near the existing `{#if showToast}` block at the end of the template, add:

```svelte
{#if gateModal}
  <CheckpointGateModal
    mode={gateModal.mode}
    message={gateModal.message}
    skippable={gateModal.skippable}
    onStay={resolveGateStay}
    onProceed={resolveGateProceed}
  />
{/if}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run test:run -- RoutePage.test.ts`
Expected: PASS, all tests including the 7 new ones.

- [ ] **Step 9: Run the full suite**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 10: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors. (`clampedNext` may now be unused inside `RoutePage.svelte`'s own logic — it's fine to leave the `export { clampedNext, clampedPrev } from "../utils/routeNav";` re-export line and the module-level destructured import as-is; `clampedPrev`/`clampedNext` remain independently unit-tested in `routeNav.ts` and re-exported for any other consumer.)

- [ ] **Step 11: Commit**

```bash
git add src/pages/RoutePage.svelte src/test/RoutePage.test.ts
git commit -m "feat: gate forward navigation on checkpoint entry requirements"
```

---

### Task 7: RoutePage — backward-crossing checkpoint blocking

**Files:**
- Modify: `src/pages/RoutePage.svelte`
- Test: `src/test/RoutePage.test.ts`

**Interfaces:**
- Consumes: `earliestAllowedIndex`, `nextNavigableIndex` (`src/utils/checkpointNav.ts`, Task 3).
- Produces: the Prev button/swipe-right silently refuses to cross a `re-entry`-blocked checkpoint; the elastic drag-resistance boundary and the Next button's visibility both correctly account for checkpoints too.

- [ ] **Step 1: Write the failing tests**

Add to the hoisted fixtures block:

```ts
mockReEntryLockedEntries: [
  {
    "template-type": "options",
    "nav-bar": { visible: false },
    title: "Before You Begin",
    options: [{ text: "I understand", target: { type: "page", value: "continue" } }],
  },
  { "template-type": "checkpoint", "re-entry": false },
  {
    title: "Loc 1",
    name: { value: "Location 1" },
    coordinates: { latitude: 52.0, longitude: 4.0 },
    storyline: "Story 1",
    breadcrumb: "Step 1",
    challenge: { name: "Challenge 1", description: "Desc 1", form: [] },
  },
  {
    title: "Loc 2",
    name: { value: "Location 2" },
    coordinates: { latitude: 52.1, longitude: 4.1 },
    storyline: "Story 2",
    breadcrumb: "Step 2",
    challenge: { name: "Challenge 2", description: "Desc 2", form: [] },
  },
],
```

Add the tests:

```ts
test("Prev is hidden once a re-entry-blocked checkpoint has been crossed", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockReEntryLockedEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Before You Begin");
  await fireEvent.click(screen.getByText("I understand")); // crosses the checkpoint
  expect(await screen.findByText("Location 1")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /previous stop/i })).not.toBeInTheDocument();
});

test("Prev still works normally between two entries after a re-entry-blocked checkpoint", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockReEntryLockedEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Before You Begin");
  await fireEvent.click(screen.getByText("I understand"));
  await screen.findByText("Location 1");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await screen.findByText("Location 2");
  await fireEvent.click(await screen.findByRole("button", { name: /previous stop/i }));
  expect(await screen.findByText("Location 1")).toBeInTheDocument();
});

test("Prev is hidden at the very start of a route even when a leading checkpoint shifted currentIndex off 0", async () => {
  // Uses Task 6's mockLeadingCheckpointEntries — a non-blocking checkpoint at
  // index 0 means mount-normalization lands currentIndex on 1, not 0. Prev
  // must still be hidden: there is nothing real before it to go back to,
  // independent of any re-entry block.
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockLeadingCheckpointEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  expect(screen.queryByRole("button", { name: /previous stop/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- RoutePage.test.ts`
Expected: FAIL — the Prev button is still shown (guard is still the unconditional `currentIndex > 0`).

- [ ] **Step 3: Implement**

Add a derived value near `navBarVisible`:

```ts
let earliestAllowed = $derived(earliestAllowedIndex(entries, currentIndex));
let canGoForward = $derived(nextNavigableIndex(entries, currentIndex) !== currentIndex);
```

Add the import (alongside Task 6's `checkpointNav` import):

```ts
import { earliestAllowedIndex } from "../utils/checkpointNav";
```

(Combine into the single existing `import { ... } from "../utils/checkpointNav";` line from Task 6 rather than a second import statement.)

In the template, change the Prev button guard:

```svelte
{#if currentIndex > 0}
```

to:

```svelte
{#if currentIndex > earliestAllowed}
```

Change the Next button guard:

```svelte
{#if currentIndex < entries.length - 1}
```

to:

```svelte
{#if canGoForward}
```

In `handleDragMove`, change:

```ts
const atStart = currentIndex === 0;
const atEnd = currentIndex === entries.length - 1;
```

to:

```ts
const atStart = currentIndex === earliestAllowed;
const atEnd = !canGoForward;
```

In the carousel-mode branch of `handleDragEnd`, change:

```ts
const atStart = currentIndex === 0;
const atEnd = currentIndex === entries.length - 1;
```

to:

```ts
const atStart = currentIndex === earliestAllowed;
const atEnd = !canGoForward;
```

Also close the same gap for the **snap-mode swipe gesture**, not just the Prev button's visibility. Task 6 left the snap-mode `handleDragEnd` prev branch as an unconditional retreat:

```ts
} else if (delta > 60) {
  direction = "prev";
  currentIndex = prevNavigableIndex(entries, currentIndex);
}
```

A hidden Prev button doesn't stop a swipe-right gesture from calling `handleDragEnd` directly — without this guard, swiping (as opposed to clicking) would still cross a `re-entry`-blocked checkpoint. Change it to:

```ts
} else if (delta > 60) {
  if (currentIndex > earliestAllowed) {
    direction = "prev";
    currentIndex = prevNavigableIndex(entries, currentIndex);
  }
}
```

Also update the two `isLast` props passed to `RouteScreen` (snap mode: `isLast={currentIndex === entries.length - 1}`; carousel mode: `isLast={locIdx === entries.length - 1}`) to account for a trailing checkpoint meaning nothing real follows:

```svelte
isLast={!canGoForward}
```

```svelte
isLast={nextNavigableIndex(entries, locIdx) === locIdx}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- RoutePage.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 6: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/RoutePage.svelte src/test/RoutePage.test.ts
git commit -m "feat: block backward navigation across a re-entry-locked checkpoint"
```

---

### Task 8: Checkpoint YAML validation

**Files:**
- Create: `src/data/schemas/checkpoint.schema.json`
- Modify: `scripts/validate-yaml.js`
- Modify: `.vscode/settings.json`

**Interfaces:**
- Consumes: nothing (standalone JSON Schema + a small addition to the existing validation script).
- Produces: `*_checkpoint_*.yaml` files get IDE squiggles (via `.vscode/settings.json`) and CI validation (via `validate-yaml.js`), matching the existing three-layer setup for `text`/`splash`/`options`.

- [ ] **Step 1: Create the schema**

Create `src/data/schemas/checkpoint.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Checkpoint",
  "type": "object",
  "additionalProperties": false,
  "required": ["template-type"],
  "anyOf": [{ "required": ["entry"] }, { "required": ["re-entry"] }],
  "properties": {
    "template-type": { "const": "checkpoint" },
    "entry": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "requirements": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["type", "on_fail"],
            "properties": {
              "type": { "enum": ["forms", "period"] },
              "requires_all_forms_completed": { "type": "boolean" },
              "min_completed_forms": { "type": "number" },
              "include_skipped": { "type": "boolean" },
              "start": {
                "type": "object",
                "additionalProperties": false,
                "required": ["date"],
                "properties": {
                  "operator": { "enum": ["<", "<=", "=", ">", ">="] },
                  "date": { "type": "string" }
                }
              },
              "end": {
                "type": "object",
                "additionalProperties": false,
                "required": ["date"],
                "properties": {
                  "operator": { "enum": ["<", "<=", "=", ">", ">="] },
                  "date": { "type": "string" }
                }
              },
              "on_fail": {
                "type": "object",
                "additionalProperties": false,
                "required": ["message"],
                "properties": {
                  "message": { "type": "string" },
                  "include_missing_forms": { "type": "boolean" },
                  "include_period": { "type": "boolean" }
                }
              }
            }
          }
        },
        "skippable": { "type": "boolean" },
        "on_succeed": {
          "type": "object",
          "additionalProperties": false,
          "required": ["message"],
          "properties": {
            "message": { "type": "string" },
            "include_missing_forms": { "type": "boolean" }
          }
        }
      }
    },
    "re-entry": {
      "oneOf": [
        { "type": "boolean" },
        {
          "type": "object",
          "additionalProperties": false,
          "properties": { "blocked_after_exit": { "type": "boolean" } }
        }
      ]
    }
  }
}
```

- [ ] **Step 2: Wire it into `validate-yaml.js`**

In `scripts/validate-yaml.js`, add alongside the other `validate*` compiles:

```js
const validateCheckpoint = ajv.compile(loadSchema("checkpoint.schema.json"));
```

Add alongside the other `*_PATTERN` constants:

```js
const CHECKPOINT_PATTERN = /^\d+_checkpoint_.*\.yaml$/;
```

Add to the `violations` array, alongside the other `findFiles(...)` spreads:

```js
...findFiles(DATA_DIR, CHECKPOINT_PATTERN).flatMap((filePath) =>
  checkFile(filePath, validateCheckpoint).map((msg) => ({ filePath, msg })),
),
```

- [ ] **Step 3: Wire it into `.vscode/settings.json`**

Add to the `yaml.schemas` map:

```json
"./src/data/schemas/checkpoint.schema.json": "*_checkpoint_*.yaml"
```

- [ ] **Step 4: Verify the wiring catches an invalid checkpoint**

Create a throwaway file `src/data/text/en/projects/democrats_abroad/den_haag/999_checkpoint_scratch.yaml`:

```yaml
template-type: checkpoint
```

Run: `npm run validate:yaml`
Expected: exits non-zero, printing an error for `999_checkpoint_scratch.yaml` about failing the `anyOf` (neither `entry` nor `re-entry` present).

- [ ] **Step 5: Verify the wiring passes a valid checkpoint**

Edit the same throwaway file to:

```yaml
template-type: checkpoint
re-entry: false
```

Run: `npm run validate:yaml`
Expected: exits 0 (clean — this is the current baseline, since no other checkpoint files exist yet).

- [ ] **Step 6: Delete the throwaway file**

Delete `src/data/text/en/projects/democrats_abroad/den_haag/999_checkpoint_scratch.yaml` — it was only for verifying the wiring; the real files are authored in Task 9.

- [ ] **Step 7: Commit**

```bash
git add src/data/schemas/checkpoint.schema.json scripts/validate-yaml.js .vscode/settings.json
git commit -m "feat: add checkpoint.schema.json and wire it into IDE + CI YAML validation"
```

---

### Task 9: Author the two Den Haag checkpoints

**Files:**
- Create: `src/data/text/en/projects/democrats_abroad/den_haag/006_checkpoint_eula_lock.yaml`
- Create: `src/data/text/en/projects/democrats_abroad/den_haag/011_checkpoint_pre_completion.yaml`
- Modify: `src/data/text/en/projects/democrats_abroad/den_haag/routes.yaml`

**Interfaces:**
- Consumes: everything built in Tasks 1-8, plus the existing `000_options_eula.yaml`, `010_loc_mauritshuis.yaml`, `007_splash_completion.yaml`.
- Produces: the two concrete use cases from the spec, live in the actual Den Haag `short_loop` route.

- [ ] **Step 1: Create the EULA-lock checkpoint**

Create `src/data/text/en/projects/democrats_abroad/den_haag/006_checkpoint_eula_lock.yaml`:

```yaml
template-type: checkpoint
re-entry: false
```

- [ ] **Step 2: Create the pre-completion nudge checkpoint**

Create `src/data/text/en/projects/democrats_abroad/den_haag/011_checkpoint_pre_completion.yaml`:

```yaml
template-type: checkpoint
entry:
  requirements:
    - type: forms
      requires_all_forms_completed: true
      on_fail:
        message: "There are still forms waiting for answers, but you're welcome to call it a day"
  skippable: true
```

- [ ] **Step 3: Update `routes.yaml`**

In `src/data/text/en/projects/democrats_abroad/den_haag/routes.yaml`, change the `short_loop.locations` list from:

```yaml
  locations:
    - 000_options_eula
    - 001_loc_right_to_read
    - 002_loc_vredespaleis
    - 003_loc_plein
    - 004_loc_american_bookstore
    - 005_loc_binnenhof
    - 009_loc_noordeinde
    - 010_loc_mauritshuis
    - 007_splash_completion
    - 008_options_end_of_hunt
```

to:

```yaml
  locations:
    - 000_options_eula
    - 006_checkpoint_eula_lock
    - 001_loc_right_to_read
    - 002_loc_vredespaleis
    - 003_loc_plein
    - 004_loc_american_bookstore
    - 005_loc_binnenhof
    - 009_loc_noordeinde
    - 010_loc_mauritshuis
    - 011_checkpoint_pre_completion
    - 007_splash_completion
    - 008_options_end_of_hunt
```

- [ ] **Step 4: Validate the new content**

Run: `npm run validate:yaml`
Expected: exits 0.

- [ ] **Step 5: Manual QA in the browser**

Run: `npm run dev` and open the Den Haag `short_loop` route in a browser.

Verify the golden path and both checkpoints:
- Click through `000_options_eula`'s "I understand" — lands on `001_loc_right_to_read`.
- Confirm there is no Prev button on `001_loc_right_to_read` (or any later screen) that goes back to the EULA — swiping right does nothing once past it.
- Navigate forward without submitting any location's form, until reaching `010_loc_mauritshuis` and clicking Next.
- Confirm the "There are still forms waiting for answers..." dialog appears, with a Skip button.
- Click Skip — confirm it lands on `007_splash_completion`.
- Reload the page from `009_loc_noordeinde`, submit its form, return to Mauritshuis and click Next again — with all forms now submitted, confirm the dialog no longer appears and Next goes straight to the completion splash.

Stop the dev server once verified.

- [ ] **Step 6: Run the full test suite once more**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/data/text/en/projects/democrats_abroad/den_haag/006_checkpoint_eula_lock.yaml src/data/text/en/projects/democrats_abroad/den_haag/011_checkpoint_pre_completion.yaml src/data/text/en/projects/democrats_abroad/den_haag/routes.yaml
git commit -m "feat: lock the EULA and add a pre-completion forms nudge to the Den Haag short_loop route"
```

---

### Task 10: Documentation

**Files:**
- Modify: `doc/architecture.md`

**Interfaces:**
- Consumes: nothing — documentation only.
- Produces: a new `template-type: checkpoint` row/section, matching the existing "Route entry templates" documentation style for `text`/`splash`/`options`.

- [ ] **Step 1: Add checkpoint to the route entry templates table**

In `doc/architecture.md`, in the "Route entry templates (`template-type`)" section, add a row to the existing table:

```markdown
| `checkpoint` | `NNN_checkpoint_<slug>.yaml` | Never rendered — a navigation gate evaluated when the participant tries to cross it (forward or backward) |
```

- [ ] **Step 2: Add a checkpoint subsection**

Immediately after the existing table/paragraph in that section, add:

```markdown
**Checkpoints** are gates, not screens — `currentIndex` never points at one. Crossing forward evaluates the checkpoint's `entry.requirements` (an open-ended, ordered list — `forms` and `period` today) against current form/skip state and the clock; a failure shows a dialog with the requirement's `on_fail.message` and an optional Skip button (`skippable`, default true), while all-pass with an `on_succeed` defined shows a Cancel/Continue confirm dialog. Crossing backward is blocked outright (no dialog) if the checkpoint's `re-entry` gate has an active `blocked_after_exit` (default true whenever `re-entry` is present — `re-entry: false` is shorthand for installing the guard with its defaults). Because checkpoints are never current, they're invisible to `locationTotal`/`locationOrdinalAt`'s progress count, same as `text`/`splash`/`options`, and closing the app mid-crossing always resumes on the real entry last passed, not the checkpoint. See `doc/superpowers/specs/2026-07-27-route-checkpoints-design.md` for the full design, including why location IDs are keyed by `locationOrdinalAt` rather than raw array position.
```

- [ ] **Step 3: Commit**

```bash
git add doc/architecture.md
git commit -m "docs: document checkpoint route entries in architecture.md"
```
