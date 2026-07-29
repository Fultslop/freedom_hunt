# Location Identity Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the computed ordinal `locationId: number` with the location's stable `routes.yaml` id string (e.g. `"004_loc_lange_voorhout"`) as the canonical identity everywhere a location is identified — local draft storage, the submission API, the results database, and results-matching — while keeping the numeric ordinal exactly as-is for display purposes ("Location 3 of 7", badge numbers).

**Architecture:** Two independent clusters of change. (1) Results/reporting (`resultsData.ts`, `resultsRouteIndex.ts`) — self-contained, only touches how submissions get matched back to a route position for the organizer-facing results pages. (2) The live hunt flow — a single dependency chain from `formStorage.ts` up through `ChallengeForm.svelte` → `ChallengeCard.svelte`/`OptionsScreen.svelte`/`RouteScreen.svelte` → `RoutePage.svelte`, where an id string threads down alongside (not replacing) the existing display ordinal. A versioned envelope wraps persisted form state so a future shape change can't be silently misread.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + `@testing-library/svelte`.

## Global Constraints

- **No git commands.** This repo's `.claude/CLAUDE.md` reserves git control for the user — do not run `git add`/`git commit`/etc. Each task ends with "ready for review," not a commit step.
- **TypeScript only** — `.svelte` files use `<script lang="ts">`; no `.js`/`.jsx`/`.tsx` in `src/`.
- **Svelte 5 runes only** (`$state`, `$derived`, `$effect`, `$props`) — no Svelte 4 `$:` syntax.
- **No Playwright/browser automation** for verification — the user does manual verification themselves.
- **No DB schema change, no data migration path.** `location_id` stays a `TEXT` column in D1; there are no hunts in progress, so no existing localStorage or D1 rows need to be preserved or migrated.
- **Route stays in the storage key.** A location shared across multiple routes (this happens today in Oslo) keeps independent per-route answers — unchanged from current behavior.
- **Typecheck gate timing.** This migration changes one signature (`buildFormStorageKey`'s `locationId` param, `number` → `string`) that ripples through a fixed, single-threaded call chain: `formStorage.ts` → `ChallengeForm.svelte` → `ChallengeCard.svelte`/`OptionsScreen.svelte` → `RouteScreen.svelte` → `RoutePage.svelte`. The chain is only fully closed once Task 4 (`RoutePage.svelte`) lands. **Tasks 2 and 3 gate on their own scoped `npm run test:run -- <pattern>` only** — a full `npm run typecheck` between Task 2 and Task 4 will show real, expected errors in not-yet-updated files further up the chain. Task 1 (results/reporting) is a fully independent cluster and typechecks clean on its own at any point. Task 4 and Task 5 are the first points a full `npm run typecheck` should be clean.
- Spec: `doc/superpowers/specs/2026-07-29-location-identity-migration-design.md`

---

### Task 1: Results/reporting — match submissions by location id, not ordinal

**Files:**
- Modify: `src/utils/resultsData.ts` (`RouteLocationEntry`, `submissionsForCell`, `buildRouteGrid`, `completionCount`, `buildLocationReport`)
- Modify: `src/utils/resultsRouteIndex.ts` (`toRouteLocationEntries`, `buildRouteIndex`)
- Test: `src/test/resultsData.test.ts`, `src/test/resultsRouteIndex.test.ts`, `src/test/ResultsTable.test.ts`, `src/test/ResultsDownloadPage.test.ts`, `src/test/ResultsLocationReports.test.ts`, `src/test/resultsMarkdown.test.ts`

**Interfaces:**
- Produces: `RouteLocationEntry.locationId: string` — a new required field alongside the existing `ordinal: number` (which stays, unchanged, for display). `submissionsForCell(submissions, routeId, locationId: string, teamName)` — third parameter changes from `ordinal: number` to `locationId: string`.
- Independent of every other task in this plan — `ResultsSubmission.locationId` was already typed and used as `string` everywhere (`src/types/results.ts`); only the internal matching logic here was incorrectly parsing it back to a number.

- [ ] **Step 1: Write the failing tests**

In `src/test/resultsData.test.ts`, update the `ENTRY` fixture (around line 24) to add `locationId`:

```ts
const ENTRY: RouteLocationEntry = {
  ordinal: 1,
  locationId: "1",
  name: "Eiffel Tower",
  fields: [
    { id: "found", type: "boolean", label: "Did you find it?" },
    { id: "notes", type: "string", label: "Any notes?" },
  ],
};
```

Update the `submissionsForCell` describe block (around line 45-56) — rename the test and change the third argument from a number to a string:

```ts
describe("submissionsForCell", () => {
  it("matches on routeId, locationId, and teamName together", () => {
    const submissions = [
      makeSubmission({ id: "s1", routeId: "riverside_route", locationId: "1", teamName: "Team A" }),
      makeSubmission({ id: "s2", routeId: "left_bank_route", locationId: "1", teamName: "Team A" }),
      makeSubmission({ id: "s3", routeId: "riverside_route", locationId: "2", teamName: "Team A" }),
      makeSubmission({ id: "s4", routeId: "riverside_route", locationId: "1", teamName: "Team B" }),
    ];
    const result = submissionsForCell(submissions, "riverside_route", "1", "Team A");
    expect(result.map((sub) => sub.id)).toEqual(["s1"]);
  });
});
```

In `src/test/resultsRouteIndex.test.ts`, add a new test after the existing `"passes the correct loadLocations paths for a route"` test (end of file, before the closing `});`):

```ts

  it("attaches the route's declared location id to each entry", async () => {
    (loadText as ReturnType<typeof vi.fn>).mockResolvedValue(ROUTES_DATA);
    (loadLocations as ReturnType<typeof vi.fn>).mockResolvedValue(RIVERSIDE_ENTRIES);
    const result = await buildRouteIndex("en", "demo", "paris");
    expect(result.riverside_route[0].locationId).toBe("001_loc_eiffel");
  });
```

In `src/test/ResultsTable.test.ts`, update the `ENTRIES` fixture (around line 6-8):

```ts
const ENTRIES: RouteLocationEntry[] = [
  { ordinal: 1, locationId: "1", name: "Eiffel Tower", fields: [{ id: "found", type: "boolean", label: "Found?" }] },
];
```

In `src/test/ResultsDownloadPage.test.ts`, update the `riverside_route` fixture (around line 14-16):

```ts
  riverside_route: [
    { ordinal: 1, locationId: "1", name: "Eiffel Tower", fields: [{ id: "found", type: "boolean", label: "Found?" }] },
  ],
```

In `src/test/ResultsLocationReports.test.ts`, update the `ENTRIES` fixture (around line 6-8):

```ts
const ENTRIES: RouteLocationEntry[] = [
  { ordinal: 1, locationId: "1", name: "Eiffel Tower", fields: [{ id: "found", type: "boolean", label: "Found it?" }] },
];
```

In `src/test/resultsMarkdown.test.ts`, update the `ROUTE_INDEX` fixture (around line 6-14):

```ts
const ROUTE_INDEX: RouteIndex = {
  riverside_route: [
    {
      ordinal: 1,
      locationId: "1",
      name: "Eiffel Tower",
      fields: [{ id: "found", type: "boolean", label: "Found it?" }],
    },
  ],
};
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- resultsData resultsRouteIndex ResultsTable ResultsDownloadPage ResultsLocationReports resultsMarkdown`
Expected: FAIL — `RouteLocationEntry`/entry literals are missing `locationId` (TS error surfaces as a test-file load failure), and `submissionsForCell`'s third parameter doesn't accept a string yet.

- [ ] **Step 3: Update `RouteLocationEntry` and `submissionsForCell`**

Edit `src/utils/resultsData.ts`. Update the interface (around line 4-8):

```ts
export interface RouteLocationEntry {
  ordinal: number;
  locationId: string;
  name: string;
  fields: FormField[];
}
```

Replace `submissionsForCell` (around line 33-45):

```ts
export function submissionsForCell(
  submissions: ResultsSubmission[],
  routeId: string,
  locationId: string,
  teamName: string,
): ResultsSubmission[] {
  return submissions.filter(
    (sub) =>
      sub.routeId === routeId &&
      sub.locationId === locationId &&
      sub.teamName === teamName,
  );
}
```

- [ ] **Step 4: Update the three callers to pass `entry.locationId`**

In `src/utils/resultsData.ts`, in `buildRouteGrid` (around line 74): change `submissionsForCell(submissions, routeId, entry.ordinal, teamName)` to `submissionsForCell(submissions, routeId, entry.locationId, teamName)`. The pushed row still uses `ordinal: entry.ordinal` unchanged (display only).

In `completionCount` (around line 94): change `submissionsForCell(submissions, routeId, entry.ordinal, teamName)` to `submissionsForCell(submissions, routeId, entry.locationId, teamName)`.

In `buildLocationReport` (around lines 107, 114-115): change all three `entry.ordinal` occurrences passed into `submissionsForCell` to `entry.locationId`.

- [ ] **Step 5: Thread the location id through `resultsRouteIndex.ts`**

Replace the full contents of `src/utils/resultsRouteIndex.ts`:

```ts
import { loadText } from "./loadText";
import { loadLocations } from "./loadLocations";
import { isLocationEntry } from "./routeEntries";
import type { RoutesData, LocationEntry } from "../types/data";
import type { RouteLocationEntry, RouteIndex } from "./resultsData";

function toRouteLocationEntries(
  entries: LocationEntry[],
  locationIds: string[],
): RouteLocationEntry[] {
  const withForm: RouteLocationEntry[] = [];
  entries.forEach((entry, index) => {
    const fields = entry.challenge.form ?? [];
    if (fields.length > 0) {
      withForm.push({
        ordinal: index + 1,
        locationId: locationIds[index],
        name: entry.name.value,
        fields,
      });
    }
  });
  return withForm;
}

export async function buildRouteIndex(
  lang: string,
  project: string,
  city: string,
): Promise<RouteIndex> {
  const routesData = await loadText<RoutesData>(lang, `projects/${project}/${city}/routes`);
  if (!routesData) {
    return {};
  }
  const index: RouteIndex = {};
  for (const [routeId, route] of Object.entries(routesData)) {
    const paths = route.locations.map(
      (locationFile) => `projects/${project}/${city}/${locationFile}`,
    );
    const resolvedEntries = await loadLocations(lang, paths);
    const locationEntries: LocationEntry[] = [];
    const locationIds: string[] = [];
    resolvedEntries.forEach((entry, i) => {
      if (isLocationEntry(entry)) {
        locationEntries.push(entry);
        locationIds.push(route.locations[i]);
      }
    });
    index[routeId] = toRouteLocationEntries(locationEntries, locationIds);
  }
  return index;
}
```

(`route.locations[i]` and `resolvedEntries[i]` are index-parallel — both are built from the same `paths` map, in the same order, in `loadLocations`'s `Promise.all(paths.map(...))`.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test:run -- resultsData resultsRouteIndex ResultsTable ResultsDownloadPage ResultsLocationReports resultsMarkdown`
Expected: all PASS, including the new/updated tests.

- [ ] **Step 7: Lint and typecheck this cluster**

Run: `npm run lint` and `npm run typecheck`.
Expected: no errors — this cluster is fully independent of the rest of the plan.

- [ ] **Step 8: Ready for review**

Do not commit. Summarize the diff (`src/utils/resultsData.ts`, `src/utils/resultsRouteIndex.ts`, and the 6 test files) for the user to review and commit themselves.

---

### Task 2: Storage layer, submission API, and `ChallengeForm.svelte`

**Files:**
- Modify: `src/utils/formStorage.ts` (version envelope, `buildFormStorageKey` signature)
- Modify: `src/utils/api.ts` (`FormSubmitPayload`, `PhotoUploadPayload`, `VideoUploadPayload`)
- Modify: `src/worker/routes/formSubmitRoute.ts` (request body type)
- Modify: `src/components/ChallengeForm.svelte:22` (`locationId` prop type)
- Test: `src/test/formStorage.test.ts`, `src/test/api.test.ts`, `src/test/ChallengeForm.test.ts`

**Interfaces:**
- Produces: `buildFormStorageKey(project, city, route, locationId: string): string`. `FormSubmitPayload.locationId: string`, `PhotoUploadPayload.locationId: string`, `VideoUploadPayload.locationId: string`. `ChallengeForm`'s `locationId` prop is `string`.
- Consumes: nothing from other tasks in this plan.
- This closes every direct consumer of `buildFormStorageKey`/`postFormSubmit`/`postPhotoUpload`/`postVideoUpload` **except** `RoutePage.svelte` (Task 4) and `ChallengeCard.svelte` (Task 3), which still pass numbers until their own tasks land — expected, per the Global Constraints typecheck note.

- [ ] **Step 1: Write the failing tests**

Edit `src/test/formStorage.test.ts` — change the two `buildFormStorageKey` calls with numeric locationIds to strings, and add version-envelope tests. Replace the file's contents:

```ts
import { buildFormStorageKey, loadFormState, saveFormState } from "../utils/formStorage";

beforeEach(() => {
  localStorage.clear();
});

test("buildFormStorageKey composes project/city/route/locationId", () => {
  expect(buildFormStorageKey("demo", "den_haag", "short_loop", "3")).toBe(
    "demo/den_haag/short_loop/3/form",
  );
});

test("buildFormStorageKey handles an undefined route", () => {
  expect(buildFormStorageKey("demo", "den_haag", undefined, "3")).toBe(
    "demo/den_haag//3/form",
  );
});

test("loadFormState returns empty defaults when nothing is stored", () => {
  expect(loadFormState("missing-key")).toEqual({
    values: {},
    uploads: {},
    submitted: false,
    skipped: false,
  });
});

test("saveFormState then loadFormState round-trips the exact state", () => {
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1");
  const state = {
    values: { note: "hello" },
    uploads: { pic: { status: "success" as const, httpCode: 200 } },
    submitted: true,
    skipped: false,
  };
  saveFormState(key, state);
  expect(loadFormState(key)).toEqual(state);
});

test("loadFormState falls back to defaults on malformed JSON", () => {
  const key = "corrupt-key";
  localStorage.setItem(key, "{not json");
  expect(loadFormState(key)).toEqual({
    values: {},
    uploads: {},
    submitted: false,
    skipped: false,
  });
});

test("saveFormState writes a version envelope that loadFormState reads back transparently", () => {
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1");
  saveFormState(key, { values: { note: "hi" }, uploads: {}, submitted: false, skipped: false });
  const raw = JSON.parse(localStorage.getItem(key)!);
  expect(raw.version).toBe("1.0");
  expect(loadFormState(key)).toEqual({
    values: { note: "hi" },
    uploads: {},
    submitted: false,
    skipped: false,
  });
});

test("loadFormState treats a pre-versioning payload (no version field) as empty", () => {
  const key = "legacy-key";
  localStorage.setItem(
    key,
    JSON.stringify({ values: { note: "old" }, uploads: {}, submitted: true, skipped: false }),
  );
  expect(loadFormState(key)).toEqual({
    values: {},
    uploads: {},
    submitted: false,
    skipped: false,
  });
});

test("loadFormState treats a major-version mismatch as empty", () => {
  const key = "future-key";
  localStorage.setItem(
    key,
    JSON.stringify({
      version: "2.0",
      values: { note: "future" },
      uploads: {},
      submitted: true,
      skipped: false,
    }),
  );
  expect(loadFormState(key)).toEqual({
    values: {},
    uploads: {},
    submitted: false,
    skipped: false,
  });
});
```

Edit `src/test/api.test.ts` — change the three numeric `locationId` payloads (in `"postFormSubmit POSTs..."`, `"postFormSubmit returns ok: false..."`, and `"postPhotoUpload POSTs..."`, around lines 36, 55, 68) from `locationId: 1` to `locationId: "1"`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- formStorage api`
Expected: FAIL — `buildFormStorageKey`'s fourth parameter doesn't accept a string yet; the version-envelope tests fail because no version field is written yet; `api.test.ts`'s payloads don't yet typecheck against a `number`-typed field (Vitest's esbuild transform doesn't enforce this at test-run time, but the new version-envelope assertions will fail regardless).

- [ ] **Step 3: Add the version envelope and string `locationId` to `formStorage.ts`**

Replace the full contents of `src/utils/formStorage.ts`:

```ts
import type { FormState } from "../types/data";

export function buildFormStorageKey(
  project: string,
  city: string,
  route: string | undefined,
  locationId: string,
): string {
  return `${project}/${city}/${route ?? ""}/${locationId}/form`;
}

const STORAGE_VERSION = "1.0"; // "major.minor" — bump major to invalidate old data, minor stays readable

function majorVersion(version: string): string {
  return version.split(".")[0];
}

const EMPTY_STATE: FormState = {
  values: {},
  uploads: {},
  submitted: false,
  skipped: false,
};

export function loadFormState(key: string): FormState {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return { ...EMPTY_STATE, values: {}, uploads: {} };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<FormState> & { version?: string };
    if (majorVersion(parsed.version ?? "0.0") !== majorVersion(STORAGE_VERSION)) {
      return { ...EMPTY_STATE, values: {}, uploads: {} };
    }
    return {
      values: parsed.values ?? {},
      uploads: parsed.uploads ?? {},
      submitted: parsed.submitted ?? false,
      skipped: parsed.skipped ?? false,
    };
  } catch {
    return { ...EMPTY_STATE, values: {}, uploads: {} };
  }
}

export function saveFormState(key: string, state: FormState): void {
  localStorage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, ...state }));
}
```

- [ ] **Step 4: Change `locationId` to `string` in `api.ts`**

Edit `src/utils/api.ts`. Change `FormSubmitPayload` (around line 9-16):

```ts
export interface FormSubmitPayload {
  locationId: string;
  routeId?: string;
  cityId: string;
  teamName: string;
  contact: string;
  answers: Record<string, unknown>;
}
```

Change `PhotoUploadPayload` (around line 29-35):

```ts
export interface PhotoUploadPayload {
  locationId: string;
  cityId: string;
  routeId?: string;
  taskTitle: string;
  file: File;
}
```

Change `VideoUploadPayload` (around line 53-60):

```ts
export interface VideoUploadPayload {
  locationId: string;
  cityId: string;
  routeId?: string;
  taskTitle: string;
  video: File;
  poster: File;
}
```

In `postPhotoUpload` (around line 42), simplify the now-redundant coercion: change `body.append("locationId", String(payload.locationId));` to `body.append("locationId", payload.locationId);`. Do the same in `postVideoUpload` (around line 68).

- [ ] **Step 5: Update `formSubmitRoute.ts`'s body type**

Edit `src/worker/routes/formSubmitRoute.ts`. Change the body type (around line 25-30):

```ts
  let body: {
    locationId?: string;
    routeId?: string;
    cityId?: string;
    answers?: Record<string, unknown>;
  };
```

Simplify the now-redundant coercion (around line 43): change `location_id: String(body.locationId ?? "unknown"),` to `location_id: body.locationId ?? "unknown",`.

- [ ] **Step 6: Change `ChallengeForm.svelte`'s `locationId` prop to `string`**

Edit `src/components/ChallengeForm.svelte`, in the props type block (line 22): change `locationId: number;` to `locationId: string;`. No other line in this file changes — `storageKey`, `postFormSubmit`, `postPhotoUpload`, and `postVideoUpload` all just thread the prop through as-is.

- [ ] **Step 7: Update `ChallengeForm.test.ts` fixtures**

Edit `src/test/ChallengeForm.test.ts`. Every `locationId: 1` becomes `locationId: "1"` (occurs in the `props:` object of every `render(ChallengeForm, ...)` call in this file — 13 occurrences). Also update the one direct `buildFormStorageKey` call (around line 188): change `buildFormStorageKey("demo", "den_haag", "short_loop", 1)` to `buildFormStorageKey("demo", "den_haag", "short_loop", "1")`. The `localStorage.getItem("demo/den_haag/short_loop/1/form")` assertion (around line 219) is unaffected — it's already a literal string key.

Also update the one assertion on the submitted payload (around line 63-71, `"calls postFormSubmit with correct payload on confirm"`): change `locationId: 1,` to `locationId: "1",` inside the `expect.objectContaining({...})` block.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run test:run -- formStorage api ChallengeForm`
Expected: all PASS.

- [ ] **Step 9: Run this cluster's lint check**

Run: `npm run lint`.
Expected: no errors in the files touched this task. **Do not run `npm run typecheck` yet** — `ChallengeCard.svelte` (Task 3) and `RoutePage.svelte` (Task 4) still pass a `number` into `ChallengeForm`'s now-`string` prop and will show errors until their own tasks land; this is expected per the Global Constraints note.

- [ ] **Step 10: Ready for review**

Do not commit. Summarize the diff (`src/utils/formStorage.ts`, `src/utils/api.ts`, `src/worker/routes/formSubmitRoute.ts`, `src/components/ChallengeForm.svelte`, and the 3 test files) for the user to review and commit themselves. Note for the user: `npm run typecheck` will show errors elsewhere in the repo until Task 4 lands — expected.

---

### Task 3: Client component wiring — `routeEntries.ts`, `OptionsScreen.svelte`, `ChallengeCard.svelte`, `RouteScreen.svelte`

**Files:**
- Modify: `src/utils/routeEntries.ts` (new `locationIdAt` helper)
- Modify: `src/components/OptionsScreen.svelte` (`index: number` → `locationId: string`)
- Modify: `src/components/ChallengeCard.svelte` (new `locationKey` prop)
- Modify: `src/components/RouteScreen.svelte` (new `locationKey` prop, threaded to both children)
- Test: `src/test/routeEntries.test.ts`, `src/test/OptionsScreen.test.ts`, `src/test/ChallengeCard.test.ts`

**Interfaces:**
- Consumes: `ChallengeForm`'s `locationId: string` prop (Task 2 — already landed, so `ChallengeCard` can pass a string into it here).
- Produces: `ChallengeCard`'s new `locationKey?: string` prop (falls back to `String(index ?? -1)` when omitted — this is display-badge `index`'s existing sentinel, reused). `RouteScreen`'s new `locationKey?: string` prop (falls back to `String(index)` when omitted, and resolves before passing down). `OptionsScreen`'s `index: number` prop is replaced outright by `locationId: string` (no fallback — `OptionsScreen` never displays it, only `RouteScreen` needs to resolve a value before passing it in).
- `RouteScreen.test.ts` needs **no changes** — its tests never pass `locationKey`, and the fallback (`String(index)`) reproduces today's behavior exactly for every test in that file.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/routeEntries.test.ts`, after the last `isNavBarVisible` test (end of file):

```ts

test("locationIdAt returns the location id string at the given index", () => {
  expect(locationIdAt(["001_loc_a", "002_loc_b"], 1)).toBe("002_loc_b");
});

test("locationIdAt falls back to an empty string when the index is out of range", () => {
  expect(locationIdAt(["001_loc_a"], 5)).toBe("");
});
```

Update the import at the top of the file:

```ts
import { isLocationEntry, locationTotal, locationOrdinalAt, locationIdAt, isNavBarVisible } from "../utils/routeEntries";
```

Edit `src/test/OptionsScreen.test.ts` — change `baseProps` (line 17) from `index: 4` to `locationId: "4"`:

```ts
const baseProps = { project: "demo", city: "new_york", route: "brooklyn_route", locationId: "4" };
```

Change the one assertion on the tracked submission (around line 131-138): change `locationId: 4,` to `locationId: "4",`.

Add to `src/test/ChallengeCard.test.ts`, after the existing `"forwards form status changes tagged with the location's index"` test (around line 102):

```ts

test("forwards form status changes tagged with the explicit locationKey when provided, not the display index", async () => {
  const onFormStatusChange = vi.fn();
  render(ChallengeCard, {
    props: { location, index: 3, locationKey: "004_loc_lange_voorhout", onFormStatusChange },
  });
  await waitFor(() => {
    expect(onFormStatusChange).toHaveBeenCalledWith(
      "004_loc_lange_voorhout",
      expect.objectContaining({ submitted: false }),
    );
  });
});
```

Update the existing `"forwards form status changes tagged with the location's index"` test (around line 91-102) — the callback's first argument becomes a string since no `locationKey` is passed, falling back to `String(index)`:

```ts
test("forwards form status changes tagged with the location's index", async () => {
  const onFormStatusChange = vi.fn();
  render(ChallengeCard, {
    props: { location, index: 3, onFormStatusChange },
  });
  await waitFor(() => {
    expect(onFormStatusChange).toHaveBeenCalledWith(
      "3",
      expect.objectContaining({ submitted: false }),
    );
  });
});
```

Add `import { waitFor } from "@testing-library/svelte/svelte5";` if not already imported (it already is, per the existing test at the same line range — no import change needed).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- routeEntries OptionsScreen ChallengeCard`
Expected: FAIL — `locationIdAt` doesn't exist yet; `OptionsScreen`'s `locationId` prop doesn't exist yet (still `index`); `ChallengeCard`'s new `locationKey` prop doesn't exist yet, and the updated assertion (`"3"` instead of `3`) fails against current behavior.

- [ ] **Step 3: Add `locationIdAt` to `routeEntries.ts`**

Edit `src/utils/routeEntries.ts`. Add this function after `locationOrdinalAt` (around line 13):

```ts
export function locationIdAt(locations: string[], index: number): string {
  return locations[index] ?? "";
}
```

- [ ] **Step 4: Rename `OptionsScreen.svelte`'s `index` prop to `locationId`**

Edit `src/components/OptionsScreen.svelte`. In the props block (lines 10-30), replace `index` with `locationId`:

```ts
  let {
    image,
    title,
    text,
    options,
    locationId,
    project,
    city,
    route,
    onContinue = undefined,
  }: {
    image?: string;
    title: string;
    text?: string;
    options: Array<{ text: string; target: OptionTarget; track?: boolean }>;
    locationId: string;
    project: string;
    city: string;
    route: string;
    onContinue?: () => void;
  } = $props();
```

In `trackSelection` (around line 39), change `locationId: index,` to `locationId,` (shorthand — the prop is now named `locationId` directly, matching `FormSubmitPayload.locationId: string`).

- [ ] **Step 5: Add `locationKey` to `ChallengeCard.svelte`**

Edit `src/components/ChallengeCard.svelte`. In the props block (lines 12-45), add `locationKey`:

```ts
  let {
    location,
    isLast = false,
    isFirst = false,
    index = undefined,
    locationKey = undefined,
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
  }: {
    location: Location;
    isLast?: boolean;
    isFirst?: boolean;
    index?: number;
    locationKey?: string;
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
  } = $props();
```

Add this derived value after the existing `pos` derived (around line 53):

```ts
  let effectiveLocationKey = $derived(locationKey ?? String(index ?? -1));
```

In the template (around lines 165-179), change `locationId={index ?? -1}` to `locationId={effectiveLocationKey}`, and change `onFormStatusChange?.(index ?? -1, status)` to `onFormStatusChange?.(effectiveLocationKey, status)`:

```svelte
    {#if location.challenge.form && location.challenge.form.length > 0}
      {#key `${project}/${cityId}/${routeId}/${index}`}
        <ChallengeForm
          form={location.challenge.form}
          locationId={effectiveLocationKey}
          {routeId}
          {cityId}
          {project}
          storeInLocalStorage={storeFormsInLocalStorage}
          {allowResubmit}
          taskTitle={location.challenge.name}
          onFormStatusChange={(status) => onFormStatusChange?.(effectiveLocationKey, status)}
        />
      {/key}
    {/if}
```

- [ ] **Step 6: Add `locationKey` to `RouteScreen.svelte`**

Edit `src/components/RouteScreen.svelte`. In the props block (lines 8-41), add `locationKey`:

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
  } = $props();

  let resolvedLocationKey = $derived(locationKey ?? String(index));
```

In the template, change the `OptionsScreen` invocation (around lines 63-74) from `{index}` to `locationId={resolvedLocationKey}`:

```svelte
{:else if entry["template-type"] === "options"}
  <OptionsScreen
    image={entry.image}
    title={entry.title}
    text={entry.text}
    options={entry.options}
    locationId={resolvedLocationKey}
    project={project}
    city={cityId ?? ""}
    route={routeId ?? ""}
    {onContinue}
  />
```

Change the `ChallengeCard` invocation (around lines 76-91) to add `locationKey`:

```svelte
{:else}
  <ChallengeCard
    location={entry as LocationEntry}
    {isLast}
    {isFirst}
    {index}
    locationKey={resolvedLocationKey}
    {routeId}
    {cityId}
    {project}
    {storeFormsInLocalStorage}
    {allowResubmit}
    {onFormStatusChange}
    {badgeStatus}
    {onContinue}
    {onPrev}
    {isCurrent}
  />
{/if}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run test:run -- routeEntries OptionsScreen ChallengeCard RouteScreen`
Expected: all PASS, including `RouteScreen.test.ts` unchanged (its fallback-driven behavior matches every existing assertion).

- [ ] **Step 8: Run this cluster's lint check**

Run: `npm run lint`.
Expected: no errors in the files touched this task. **Do not run `npm run typecheck` yet** — `RoutePage.svelte` (Task 4) still passes a number into `ChallengeCard`'s/`RouteScreen`'s `locationKey` prop and doesn't yet supply `OptionsScreen`'s renamed `locationId` at all; expected until Task 4 lands.

- [ ] **Step 9: Ready for review**

Do not commit. Summarize the diff (`src/utils/routeEntries.ts`, `src/components/OptionsScreen.svelte`, `src/components/ChallengeCard.svelte`, `src/components/RouteScreen.svelte`, and the 3 test files) for the user to review and commit themselves.

---

### Task 4: `RoutePage.svelte` — close the chain

**Files:**
- Modify: `src/pages/RoutePage.svelte`
- Test: `src/test/RoutePage.test.ts`

**Interfaces:**
- Consumes: `locationIdAt` from Task 3's `routeEntries.ts`; `ChallengeCard`'s/`RouteScreen`'s `locationKey` prop and `OptionsScreen`'s `locationId` prop from Task 3; `buildFormStorageKey`'s `string` signature from Task 2.
- This is the last task in the chain — after this task, a full `npm run typecheck` should be clean.

- [ ] **Step 1: Write the failing tests**

Edit `src/test/RoutePage.test.ts`. Update the test at (currently) line 532-549 — rename it and change the asserted storage key, since the location in `mockPrecededByTextEntries` sits at raw route position 1 (`routeData.locations[1] === "002"`, per the `short_loop: { locations: ["001", "002"] }` fixture at the top of this file), not ordinal `1`:

```ts
test("form answers persist under a key keyed by the route's location id, unaffected by a preceding non-location entry", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockPrecededByTextEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Heads up");
  await fireEvent.click(await screen.findByRole("button", { name: "Next" }));
  await screen.findByText("Location 1");
  await fireEvent.input(screen.getByLabelText("Your note"), { target: { value: "some text" } });
  await fireEvent.click(await screen.findByRole("button", { name: /submit/i }));
  await fireEvent.click(await screen.findByRole("button", { name: /confirm/i }));
  await waitFor(() => {
    const stored = localStorage.getItem("democrats_abroad/den_haag/short_loop/002/form");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).submitted).toBe(true);
  });
});
```

Update the test at (currently) line 688-702 — the EULA options entry sits at raw route position 0 (`routeData.locations[0] === "001"`):

```ts
test("clicking a tracked 'continue' option advances and submits a form even with the nav bar hidden", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  const { postFormSubmit } = await import("../utils/api");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockEulaEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Before You Begin");
  await fireEvent.click(screen.getByText("I understand"));
  expect(await screen.findByText("Location 1")).toBeInTheDocument();
  expect(postFormSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ locationId: "001", answers: { selected: "I understand" } }),
  );
  expect(screen.getByText("End of route")).toBeInTheDocument();
});
```

No other test in this file needs to change — every badge-number assertion (`"1"`, `"2"`, etc.) checks the display ordinal, which is untouched by this migration.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- RoutePage`
Expected: FAIL on the two updated tests (current code still writes to the ordinal-based key `.../1/form` and still sends `locationId: 0`). Most other tests in the file continue to PASS since they only assert on display ordinals.

- [ ] **Step 3: Add `locationIdAt` import and per-position location key derivation**

Edit `src/pages/RoutePage.svelte`. Update the import from `routeEntries` (line 13):

```ts
  import { isLocationEntry, locationTotal, locationOrdinalAt, locationIdAt, isNavBarVisible } from "../utils/routeEntries";
```

- [ ] **Step 4: Re-key the restore-on-mount effect by location id**

Replace the restore effect (around lines 276-297):

```ts
  $effect(() => {
    if (entries.length > 0 && huntSettings.storeFormsInLocalStorage) {
      const restoredStatus: Record<string, { submitted: boolean; missingLabels: string[] }> = {};
      const restoredSkipped = new Set<string>();
      entries.forEach((_entry, i) => {
        const locId = locationIdAt(routeData?.locations ?? [], i);
        const state = loadFormState(
          buildFormStorageKey(params.project, params.city, params.route, locId),
        );
        if (state.submitted) {
          restoredStatus[locId] = { submitted: true, missingLabels: [] };
        }
        if (state.skipped) {
          restoredSkipped.add(locId);
        }
      });
      untrack(() => {
        formStatusByIndex = { ...restoredStatus, ...formStatusByIndex };
        skippedIndices = new Set([...restoredSkipped, ...skippedIndices]);
      });
    }
  });
```

- [ ] **Step 5: Re-type `formStatusByIndex`/`skippedIndices` and the functions keyed by them**

Change the state declarations (around lines 269-270):

```ts
  let formStatusByIndex = $state<Record<string, { submitted: boolean; missingLabels: string[] }>>({});
  let skippedIndices = $state<Set<string>>(new Set());
```

Change `handleFormStatusChange` (around lines 299-312):

```ts
  function handleFormStatusChange(
    locationId: string,
    status: { submitted: boolean; missingLabels: string[] },
  ) {
    const current = untrack(() => formStatusByIndex);
    formStatusByIndex = { ...current, [locationId]: status };
  }
```

Change `computeBadgeStatus` (around lines 314-325) — parameter renamed for clarity, same logic:

```ts
  function computeBadgeStatus(locationKey: string, hasForm: boolean): "submitted" | "skipped" | undefined {
    if (!hasForm) {
      return undefined;
    }
    if (formStatusByIndex[locationKey]?.submitted) {
      return "submitted";
    }
    if (skippedIndices.has(locationKey)) {
      return "skipped";
    }
    return undefined;
  }
```

- [ ] **Step 6: Split `currentLocationId` into a display ordinal and an identity key**

Replace (around line 327):

```ts
  let currentLocationId = $derived(locationOrdinalAt(entries, currentIndex));
```

with:

```ts
  let currentDisplayIndex = $derived(locationOrdinalAt(entries, currentIndex));
  let currentLocationKey = $derived(locationIdAt(routeData?.locations ?? [], currentIndex));
```

Update every other use of `currentLocationId` in the file to use whichever of the two now applies:

- `currentFormStatus` (around line 333-335): `formStatusByIndex[currentLocationId]` → `formStatusByIndex[currentLocationKey]`.
- `currentSkipped` (around line 336): `skippedIndices.has(currentLocationId)` → `skippedIndices.has(currentLocationKey)`.
- `handleSkip` (around lines 349-358): `const locId = currentLocationId;` → `const locId = currentLocationKey;`.
- The snap-mode `RouteScreen` invocation (around lines 477-492): `index={currentLocationId}` → `index={currentDisplayIndex}`, and add `locationKey={currentLocationKey}`:

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

- [ ] **Step 7: Update the swipe-strip `RouteScreen` invocation**

Replace the strip-mode `RouteScreen` invocation (around lines 509-524):

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

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run test:run -- RoutePage`
Expected: all PASS.

- [ ] **Step 9: Run the full test suite, lint, and typecheck**

Run, in order:
1. `npm run test:run` — expected: all tests PASS across the whole repo (both clusters are now complete).
2. `npm run lint` — expected: no errors.
3. `npm run typecheck` — expected: no errors. This is the first point in the plan where a full, repo-wide typecheck should be clean.

- [ ] **Step 10: Ready for review**

Do not commit. Summarize the diff (`src/pages/RoutePage.svelte`, `src/test/RoutePage.test.ts`) for the user to review and commit themselves. Note for the user: manual verification in the running app (walking a route, submitting a form, going back to an earlier location, confirming the badge numbers and submitted/skipped state still look right) is manual/UI verification the user does themselves — not run via Playwright.

---

### Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test:run`
Expected: all tests PASS.

- [ ] **Step 2: Lint and typecheck**

Run: `npm run lint` and `npm run typecheck`.
Expected: no errors in either.

- [ ] **Step 3: Validate content**

Run: `npm run validate:yaml`
Expected: no errors — this migration doesn't change the `FormField` schema or any YAML content, so this is a sanity check that nothing was inadvertently broken.

- [ ] **Step 4: Ready for review**

Do not commit. Report to the user that the full migration (Tasks 1-4) is complete and passing, and that Spec 2 (the sourced-textarea feature) can now be planned on top of it.

---

## Self-Review Notes

- **Spec coverage:** Spec's Section 1 (versioning envelope) → Task 2 Step 3. Section 2 (identity model & storage key) → Task 2 Step 3 (`buildFormStorageKey`). Section 3 (client wiring table) → Task 2 Step 6 (`ChallengeForm`), Task 3 (`OptionsScreen`/`ChallengeCard`/`RouteScreen`), Task 4 (`RoutePage`). Section 4 (submission API & backend) → Task 2 Steps 4-5. Section 5 (results matching) → Task 1. Section 6 (testing) → covered per-task. Non-goals (no DB migration, route-scoping preserved, no checkpoint identity change) → not implemented anywhere in this plan, as intended.
- **Placeholder scan:** no TBD/TODO; every step has complete, exact code with file paths and approximate line numbers (approximate because they shift slightly task-to-task within the same file; each snippet is unambiguous to locate via its surrounding, unchanged context).
- **Type consistency:** `buildFormStorageKey(..., locationId: string)` (Task 2) matches every call site updated in Tasks 2 and 4. `ChallengeCard`'s `locationKey?: string` / `effectiveLocationKey` (Task 3) matches `RouteScreen`'s `locationKey?: string` / `resolvedLocationKey` (Task 3) matches `RoutePage`'s `locationKey={currentLocationKey}` (Task 4). `onFormStatusChange`'s signature (`locationId: string`) is identical across `ChallengeCard.svelte`, `RouteScreen.svelte`, and `RoutePage.svelte`'s `handleFormStatusChange`. `OptionsScreen`'s `locationId: string` prop (Task 3) matches `RouteScreen`'s `locationId={resolvedLocationKey}` invocation (Task 3) and `FormSubmitPayload.locationId: string` (Task 2).
- **Dependency ordering:** verified each task only consumes what an earlier task already produced (Task 1 is fully independent; Task 2 is a closed leaf; Task 3 consumes Task 2's `ChallengeForm` prop type; Task 4 consumes both Task 2's `buildFormStorageKey` and Task 3's component props). The Global Constraints section explicitly calls out that `npm run typecheck` is not a valid gate until Task 4, to avoid the executing engineer mistaking expected, ordering-related type errors for a mistake in the current task.
- **Scope check:** five tasks, each independently testable via its own scoped Vitest run; the two clusters (results/reporting vs. live hunt flow) are reviewable independently of each other.
