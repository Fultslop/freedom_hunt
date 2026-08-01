# Team-Scoped Local Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix switching teams on the same device leaking the previous team's local storage (form answers, swipe position, consent cache) by scoping those keys to the current team's identity, per `doc/superpowers/specs/2026-08-01-team-scoped-local-storage-design.md`.

**Architecture:** Route progress and form answers gain a `teamName` segment (shared across teammates); the consent-version cache gains `teamName` + `contact` (personal, matching the server's `consent_records` grain). Every component that builds one of these keys reads `$authStore.activeAuth` directly — no prop-threading. `RoutePage`'s swipe-index seed/persist logic is gated on auth having resolved, to close a data-loss race the team-scoping change would otherwise introduce.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + @testing-library/svelte.

## Global Constraints

- TypeScript only (`.ts` / `.svelte` with `<script lang="ts">`) — no new `.js`/`.jsx`/`.tsx` files.
- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) — no `$:` reactive statements.
- No migration for pre-existing local storage data — clean cutover, confirmed in the spec.
- No new shared "team scope" helper module — `teamName`/`contact` are passed as plain strings at each call site, matching the codebase's existing convention (`ChallengeForm.svelte`, `OptionsScreen.svelte` already do this for `postFormSubmit`).
- **Do not run `git` commands.** This project's `.claude/CLAUDE.md` reserves all git operations for the user. Each task's final step says "stop here" instead of committing — leave the change ready for the user to review and commit themselves.
- Run `npx vitest run <file>` (scoped to the task's own test file(s), not the full suite) after each task's implementation step, per the step instructions below.
- **Expect `tsc`/lint errors between tasks — this is by design, not a regression.** Tasks 2–6 change function signatures (adding required `teamName`/`contact` parameters) before every call site across the codebase is updated; later tasks (7–10) update the remaining call sites one file at a time. Between those tasks, `npx tsc --noEmit` and a repo-wide `npm run lint` will show arity errors in not-yet-updated files — expected mid-plan, not something to fix out of order. Vitest itself is unaffected (Vite transpiles via esbuild, which strips types without enforcing call arity, so `npx vitest run <file>` still executes correctly against not-yet-updated callers elsewhere in the tree). Only run the full `npx tsc --noEmit` / `npm run lint` once, in **Final verification** below, after all 10 tasks are done.

---

## Task 1: `authStore` — resolve `authLoading` on direct login

Foundation for every later task: `RoutePage`'s auth-race gate (Task 7) checks `$authStore.authLoading`, and every test file that calls `authStore.loginParticipant(...)` directly (without going through `authStore.init()`) needs `authLoading` to become `false` afterward, or the gate never opens and every dependent test hangs/fails.

**Files:**
- Modify: `src/stores/authStore.ts:59-77` (`loginEditor`, `loginParticipant`)
- Test: `src/test/stores.test.ts`

**Interfaces:**
- Produces: `authStore.loginEditor(...)` and `authStore.loginParticipant(...)` now also set `authLoading: false` as a side effect (previously left whatever `authLoading` already was).

- [ ] **Step 1: Write the failing tests**

In `src/test/stores.test.ts`, inside `describe("loginEditor", ...)` (currently lines 168-177), add:

```ts
    it("resolves authLoading to false", () => {
      authStore.loginEditor("u3", "c@d.com", "carol", ["organizer"]);
      const state = get(authStore);
      expect(state.authLoading).toBe(false);
    });
```

Inside `describe("loginParticipant", ...)` (currently lines 180-199), add:

```ts
    it("resolves authLoading to false", () => {
      authStore.loginParticipant("proj_x", "Team B", "b@c.com", false);
      const state = get(authStore);
      expect(state.authLoading).toBe(false);
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/stores.test.ts -t "resolves authLoading to false"`
Expected: both FAIL — `state.authLoading` is `true` (the `beforeEach` at line 91 resets it via `setForTest` and neither `loginEditor` nor `loginParticipant` currently touches it).

- [ ] **Step 3: Implement**

In `src/stores/authStore.ts`, change:

```ts
  function loginEditor(
    userId: string,
    email: string,
    username: string,
    capabilities: string[],
  ) {
    const editorAuth: EditorAuthState = { kind: "editor", userId, email, username, capabilities };
    upd((state) => ({ ...state, activeAuth: editorAuth }));
  }

  function loginParticipant(
    projectId: string,
    teamName: string,
    contact: string,
    isAdmin = false,
  ) {
    const participantAuth: ParticipantAuthState = { kind: "participant", projectId, teamName, contact, isAdmin };
    upd((state) => ({ ...state, activeAuth: participantAuth }));
  }
```

to:

```ts
  function loginEditor(
    userId: string,
    email: string,
    username: string,
    capabilities: string[],
  ) {
    const editorAuth: EditorAuthState = { kind: "editor", userId, email, username, capabilities };
    upd((state) => ({ ...state, activeAuth: editorAuth, authLoading: false }));
  }

  function loginParticipant(
    projectId: string,
    teamName: string,
    contact: string,
    isAdmin = false,
  ) {
    const participantAuth: ParticipantAuthState = { kind: "participant", projectId, teamName, contact, isAdmin };
    upd((state) => ({ ...state, activeAuth: participantAuth, authLoading: false }));
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/stores.test.ts`
Expected: PASS (all tests in the file, not just the two new ones).

- [ ] **Step 5: Stop — do not commit**

Leave the change staged/unstaged for the user to review and commit.

---

## Task 2: `formStorage.ts` — `teamName`-scoped keys

**Files:**
- Modify: `src/utils/formStorage.ts:3-10`
- Test: `src/test/formStorage.test.ts`

**Interfaces:**
- Produces: `buildFormStorageKey(project: string, city: string, route: string | undefined, locationId: string, teamName: string): string`

- [ ] **Step 1: Write the failing tests**

In `src/test/formStorage.test.ts`, replace lines 7-17:

```ts
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
```

with:

```ts
test("buildFormStorageKey composes project/team/city/route/locationId", () => {
  expect(buildFormStorageKey("demo", "den_haag", "short_loop", "3", "Team A")).toBe(
    "demo/Team A/den_haag/short_loop/3/form",
  );
});

test("buildFormStorageKey handles an undefined route", () => {
  expect(buildFormStorageKey("demo", "den_haag", undefined, "3", "Team A")).toBe(
    "demo/Team A/den_haag//3/form",
  );
});

test("different team names at the same project/city/route/location get independent form state", () => {
  const keyA = buildFormStorageKey("demo", "den_haag", "short_loop", "1", "Team A");
  const keyB = buildFormStorageKey("demo", "den_haag", "short_loop", "1", "Team B");
  saveFormState(keyA, {
    values: { note: "A's answer" },
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  expect(loadFormState(keyB).values).toEqual({});
  expect(loadFormState(keyA).values).toEqual({ note: "A's answer" });
});

test("the same team name shares form state regardless of contact (team members see each other's answers)", () => {
  // No contact dimension in this key at all — this test exists to document
  // that omission is deliberate, not an oversight. See spec §1.
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1", "Team A");
  saveFormState(key, {
    values: { note: "shared answer" },
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  expect(loadFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "1", "Team A")).values).toEqual({
    note: "shared answer",
  });
});
```

Then update every other `buildFormStorageKey(...)` call in the same file (lines 30, 55, and 111 in the current file — each is `const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1");`, inside the "round-trips the exact state," "writes a version envelope," and "round-trips submittedAt" tests respectively) to add `"Team A"` as the 5th argument:

```ts
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1", "Team A");
```

(Line 120's `saveFormState(key, state);` reuses the `key` variable from line 111 — no separate change needed there.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/formStorage.test.ts`
Expected: FAIL on the two updated composition tests (`buildFormStorageKey` doesn't accept/use a 5th argument yet, so the key string won't include `"Team A"`) and TypeScript will also flag the extra argument once `tsc` runs.

- [ ] **Step 3: Implement**

In `src/utils/formStorage.ts`, change:

```ts
export function buildFormStorageKey(
  project: string,
  city: string,
  route: string | undefined,
  locationId: string,
): string {
  return `${project}/${city}/${route ?? ""}/${locationId}/form`;
}
```

to:

```ts
export function buildFormStorageKey(
  project: string,
  city: string,
  route: string | undefined,
  locationId: string,
  teamName: string,
): string {
  return `${project}/${teamName}/${city}/${route ?? ""}/${locationId}/form`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/formStorage.test.ts`
Expected: PASS.

- [ ] **Step 5: Stop — do not commit**

---

## Task 3: `consentCache.ts` — `teamName` + `contact`-scoped keys

**Files:**
- Modify: `src/utils/consentCache.ts`
- Test: `src/test/consentCache.test.ts`

**Interfaces:**
- Produces: `writeConsentCache(project: string, city: string, route: string, cache: ConsentCache, teamName: string, contact: string): void`, `readConsentCache(project: string, city: string, route: string, teamName: string, contact: string): ConsentCache | null`

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/test/consentCache.test.ts` with:

```ts
import { beforeEach } from "vitest";
import { readConsentCache, writeConsentCache } from "../utils/consentCache";

beforeEach(() => localStorage.clear());

test("writeConsentCache then readConsentCache round-trips the version", () => {
  writeConsentCache("democrats_abroad", "den_haag", "short_loop", { consentVersion: 3 }, "Team A", "a@b.com");
  expect(readConsentCache("democrats_abroad", "den_haag", "short_loop", "Team A", "a@b.com")).toEqual({
    consentVersion: 3,
  });
});

test("readConsentCache returns null when nothing was cached", () => {
  expect(readConsentCache("democrats_abroad", "den_haag", "short_loop", "Team A", "a@b.com")).toBeNull();
});

test("two different routes' cached versions do not collide", () => {
  writeConsentCache("democrats_abroad", "den_haag", "short_loop", { consentVersion: 3 }, "Team A", "a@b.com");
  writeConsentCache("democrats_abroad", "oslo", "inner_circuit", { consentVersion: 7 }, "Team A", "a@b.com");
  expect(readConsentCache("democrats_abroad", "den_haag", "short_loop", "Team A", "a@b.com")).toEqual({
    consentVersion: 3,
  });
  expect(readConsentCache("democrats_abroad", "oslo", "inner_circuit", "Team A", "a@b.com")).toEqual({
    consentVersion: 7,
  });
});

test("two members of the same team (same teamName, different contact) get independent consent caches", () => {
  writeConsentCache("demo", "new_york", "brooklyn_route", { consentVersion: 1 }, "Team A", "alice@test.com");
  expect(readConsentCache("demo", "new_york", "brooklyn_route", "Team A", "bob@test.com")).toBeNull();
  expect(readConsentCache("demo", "new_york", "brooklyn_route", "Team A", "alice@test.com")).toEqual({
    consentVersion: 1,
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/consentCache.test.ts`
Expected: FAIL — current `writeConsentCache`/`readConsentCache` only take 3-4 args, so the extra `teamName`/`contact` arguments are ignored/type-error, and the new independence test finds the record instead of `null`.

- [ ] **Step 3: Implement**

In `src/utils/consentCache.ts`, change:

```ts
function cacheKey(project: string, city: string, route: string): string {
  return `${project}/${city}/${route}/consent`;
}

export function writeConsentCache(project: string, city: string, route: string, cache: ConsentCache): void {
  localStorage.setItem(cacheKey(project, city, route), JSON.stringify(cache));
}

export function readConsentCache(project: string, city: string, route: string): ConsentCache | null {
  const raw = localStorage.getItem(cacheKey(project, city, route));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ConsentCache;
  } catch {
    return null;
  }
}
```

to:

```ts
function cacheKey(project: string, city: string, route: string, teamName: string, contact: string): string {
  return `${project}/${teamName}/${contact}/${city}/${route}/consent`;
}

export function writeConsentCache(
  project: string,
  city: string,
  route: string,
  cache: ConsentCache,
  teamName: string,
  contact: string,
): void {
  localStorage.setItem(cacheKey(project, city, route, teamName, contact), JSON.stringify(cache));
}

export function readConsentCache(
  project: string,
  city: string,
  route: string,
  teamName: string,
  contact: string,
): ConsentCache | null {
  const raw = localStorage.getItem(cacheKey(project, city, route, teamName, contact));
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ConsentCache;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/consentCache.test.ts`
Expected: PASS.

- [ ] **Step 5: Stop — do not commit**

---

## Task 4: `locationFormLookup.ts` — `teamName` param

**Files:**
- Modify: `src/utils/locationFormLookup.ts:20-28`
- Test: `src/test/locationFormLookup.test.ts`

**Interfaces:**
- Consumes: `buildFormStorageKey` from Task 2 (now requires `teamName`)
- Produces: `getLocationFormValue(project: string, city: string, route: string | undefined, locationId: string, fieldId: string, teamName: string): unknown`

- [ ] **Step 1: Write the failing tests**

In `src/test/locationFormLookup.test.ts`, every `getLocationFormValue(...)` and `buildFormStorageKey(...)` call in the `describe("getLocationFormValue", ...)` block (current lines 38-94) needs a trailing `"Team A"` argument. Replace that whole `describe` block with:

```ts
describe("getLocationFormValue", () => {
  it("returns the stored string value for the given location and field", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "Team A");
    saveFormState(key, {
      values: { manifesto: "We pledge to keep fighting." },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    });
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "manifesto", "Team A"),
    ).toBe("We pledge to keep fighting.");
  });

  it("returns undefined when the location was never visited", () => {
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "999_loc_never_visited", "manifesto", "Team A"),
    ).toBeUndefined();
  });

  it("returns undefined when the field was never answered", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "Team A");
    saveFormState(key, { values: {}, uploads: {}, submitted: false, skipped: false, touchedFields: [] });
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "manifesto", "Team A"),
    ).toBeUndefined();
  });

  it("returns the raw stored value even when it isn't a string", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "Team A");
    saveFormState(key, {
      values: { manifesto: 42 },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    });
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "manifesto", "Team A"),
    ).toBe(42);
  });

  it("returns a boolean value unchanged", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "Team A");
    saveFormState(key, {
      values: { agreed: true },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    });
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "agreed", "Team A"),
    ).toBe(true);
  });

  it("does not see another team's answer at the same location", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "Team A");
    saveFormState(key, {
      values: { manifesto: "Team A's words." },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    });
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "manifesto", "Team B"),
    ).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/locationFormLookup.test.ts`
Expected: FAIL — `getLocationFormValue`/`buildFormStorageKey` don't accept a `teamName` argument yet.

- [ ] **Step 3: Implement**

In `src/utils/locationFormLookup.ts`, change:

```ts
export function getLocationFormValue(
  project: string,
  city: string,
  route: string | undefined,
  locationId: string,
  fieldId: string,
): unknown {
  const key = buildFormStorageKey(project, city, route, locationId);
  return loadFormState(key).values[fieldId];
}
```

to:

```ts
export function getLocationFormValue(
  project: string,
  city: string,
  route: string | undefined,
  locationId: string,
  fieldId: string,
  teamName: string,
): unknown {
  const key = buildFormStorageKey(project, city, route, locationId, teamName);
  return loadFormState(key).values[fieldId];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/locationFormLookup.test.ts`
Expected: PASS.

- [ ] **Step 5: Stop — do not commit**

---

## Task 5: `visibility.ts` + `AppForm.svelte` — `formContext` gains `teamName`

**Files:**
- Modify: `src/utils/visibility.ts:11-18,40-61`
- Modify: `src/components/AppForm.svelte:95,221`
- Test: `src/test/visibility.test.ts`
- Test: `src/test/AppForm.test.ts:1638-1669`

**Interfaces:**
- Consumes: `getLocationFormValue` from Task 4 (now requires `teamName`)
- Produces: `VisibilityContext.formContext` shape becomes `{ project: string; city: string; route?: string; teamName: string }`; `AppForm`'s `formContext` prop gains the same shape.

- [ ] **Step 1: Write the failing tests**

In `src/test/visibility.test.ts`, update the `formContext` object at line 68:

```ts
  const formContext = { project: "demo", city: "den_haag", route: "short_loop" };
```

to:

```ts
  const formContext = { project: "demo", city: "den_haag", route: "short_loop", teamName: "Team A" };
```

and the `buildFormStorageKey` call at line 71:

```ts
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
```

to:

```ts
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "Team A");
```

and the inline `formContext` at line 119:

```ts
      formContext: { project: "demo", city: "den_haag", route: "short_loop" },
```

to:

```ts
      formContext: { project: "demo", city: "den_haag", route: "short_loop", teamName: "Team A" },
```

In `src/test/AppForm.test.ts`, update the test at lines 1638-1669: the literal key on line 1640

```ts
    "demo/den_haag/short_loop/004_loc_lange_voorhout/form",
```

becomes

```ts
    "demo/Team A/den_haag/short_loop/004_loc_lange_voorhout/form",
```

and the `formContext` prop on line 1665

```ts
      formContext: { project: "demo", city: "den_haag", route: "short_loop" },
```

becomes

```ts
      formContext: { project: "demo", city: "den_haag", route: "short_loop", teamName: "Team A" },
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/visibility.test.ts src/test/AppForm.test.ts`
Expected: FAIL — `resolveStringOperand` still calls `getLocationFormValue` without a `teamName` argument (TypeScript error) and the stored value under the old (teamless) key isn't found under the new key, so the cross-form lookups return `undefined` instead of the expected value.

- [ ] **Step 3: Implement**

In `src/utils/visibility.ts`, change:

```ts
export interface VisibilityContext {
  /** This form's own live (in-progress) values, keyed by field id. */
  values: Record<string, unknown>;
  /** Every field id declared in this form, for bare-id existence checks. */
  fieldIds: Set<string>;
  /** Needed to resolve dotted cross-form references; omit where none are used. */
  formContext?: { project: string; city: string; route?: string };
}
```

to:

```ts
export interface VisibilityContext {
  /** This form's own live (in-progress) values, keyed by field id. */
  values: Record<string, unknown>;
  /** Every field id declared in this form, for bare-id existence checks. */
  fieldIds: Set<string>;
  /** Needed to resolve dotted cross-form references; omit where none are used. */
  formContext?: { project: string; city: string; route?: string; teamName: string };
}
```

and change:

```ts
  const ref = parseSourceRef(str);
  if (ref) {
    if (!ctx.formContext) {
      return { error: `cross-form reference '${str}' used without a formContext` };
    }
    const { project, city, route } = ctx.formContext;
    const value = getLocationFormValue(project, city, route, ref.locationId, ref.fieldId);
    return value === undefined ? { value: undefined, unresolvedReference: true } : { value };
  }
```

to:

```ts
  const ref = parseSourceRef(str);
  if (ref) {
    if (!ctx.formContext) {
      return { error: `cross-form reference '${str}' used without a formContext` };
    }
    const { project, city, route, teamName } = ctx.formContext;
    const value = getLocationFormValue(project, city, route, ref.locationId, ref.fieldId, teamName);
    return value === undefined ? { value: undefined, unresolvedReference: true } : { value };
  }
```

In `src/components/AppForm.svelte`, change line 95:

```ts
    formContext?: { project: string; city: string; route?: string };
```

to:

```ts
    formContext?: { project: string; city: string; route?: string; teamName: string };
```

(Line 221's `const ctx: VisibilityContext = { values: ..., fieldIds, formContext };` needs no change — it already forwards the whole `formContext` object through, which now carries `teamName` automatically once callers supply it.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/visibility.test.ts src/test/AppForm.test.ts`
Expected: PASS.

- [ ] **Step 5: Stop — do not commit**

---

## Task 6: `completionStats.ts` — `teamName` param

**Files:**
- Modify: `src/utils/completionStats.ts:1-32`
- Test: `src/test/completionStats.test.ts`

**Interfaces:**
- Consumes: `buildFormStorageKey` from Task 2
- Produces: `computePhotosTaken(project: string, city: string, route: string | undefined, locationIds: string[], teamName: string): number`, `computeElapsedSinceFirstSubmission(project: string, city: string, route: string | undefined, locationIds: string[], now: number, teamName: string): number | undefined`

- [ ] **Step 1: Write the failing tests**

Replace lines 12-63 of `src/test/completionStats.test.ts` with:

```ts
test("computePhotosTaken sums successful uploads across every location", () => {
  saveFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "001", "Team A"), {
    values: {},
    uploads: {
      pic: { status: "success", httpCode: 200 },
      pic2: { status: "error", httpCode: 500 },
    },
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  saveFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "002", "Team A"), {
    values: {},
    uploads: { pic: { status: "success", httpCode: 200 } },
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  expect(computePhotosTaken("demo", "den_haag", "short_loop", ["001", "002"], "Team A")).toBe(2);
});

test("computePhotosTaken returns 0 when no location has ever been visited", () => {
  expect(computePhotosTaken("demo", "den_haag", "short_loop", ["001", "002"], "Team A")).toBe(0);
});

test("computePhotosTaken does not count another team's uploads at the same locations", () => {
  saveFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "001", "Team A"), {
    values: {},
    uploads: { pic: { status: "success", httpCode: 200 } },
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  expect(computePhotosTaken("demo", "den_haag", "short_loop", ["001"], "Team B")).toBe(0);
});

test("computeElapsedSinceFirstSubmission returns now minus the earliest submittedAt across all locations", () => {
  saveFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "001", "Team A"), {
    values: {},
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
    submittedAt: 1_000,
  });
  saveFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "002", "Team A"), {
    values: {},
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
    submittedAt: 5_000,
  });
  expect(
    computeElapsedSinceFirstSubmission("demo", "den_haag", "short_loop", ["001", "002"], 10_000, "Team A"),
  ).toBe(9_000);
});

test("computeElapsedSinceFirstSubmission returns undefined when nothing was ever submitted", () => {
  expect(
    computeElapsedSinceFirstSubmission("demo", "den_haag", "short_loop", ["001", "002"], 10_000, "Team A"),
  ).toBeUndefined();
});
```

(Leave the three `formatElapsed` tests at the bottom of the file unchanged — that function doesn't touch storage.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/completionStats.test.ts`
Expected: FAIL — `computePhotosTaken`/`computeElapsedSinceFirstSubmission`/`buildFormStorageKey` don't accept a `teamName` argument yet.

- [ ] **Step 3: Implement**

In `src/utils/completionStats.ts`, change:

```ts
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
```

to:

```ts
export function computePhotosTaken(
  project: string,
  city: string,
  route: string | undefined,
  locationIds: string[],
  teamName: string,
): number {
  return locationIds.reduce((total, locId) => {
    const state = loadFormState(buildFormStorageKey(project, city, route, locId, teamName));
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
  teamName: string,
): number | undefined {
  const timestamps = locationIds
    .map((locId) => loadFormState(buildFormStorageKey(project, city, route, locId, teamName)).submittedAt)
    .filter((timestamp): timestamp is number => timestamp !== undefined);
  if (timestamps.length === 0) {
    return undefined;
  }
  return now - Math.min(...timestamps);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/completionStats.test.ts`
Expected: PASS.

- [ ] **Step 5: Stop — do not commit**

---

## Task 7: `RoutePage.svelte` — team-scoped index key + auth-race gating fix

The highest-risk task. Bundled as one task (not split further) because the two halves are inseparable: scoping the index key to `teamName` without also gating the seed/persist sequencing on auth resolution reintroduces exactly the data-loss race documented in spec §4 — there is no safe intermediate state where only one half is done.

**Files:**
- Modify: `src/pages/RoutePage.svelte:1-53,125-161,326-347,408-425,433-442`
- Test: `src/test/RoutePage.test.ts`

**Interfaces:**
- Consumes: `buildFormStorageKey` (Task 2), `readConsentCache` (Task 3), `computePhotosTaken`/`computeElapsedSinceFirstSubmission` (Task 6) — all now require `teamName` (and `readConsentCache` also `contact`).
- Produces: `storageKey` (swipe-index key) becomes `${project}/${teamName}/${city}/${route}`, reactive on `$authStore`.

- [ ] **Step 1: Write the failing tests**

In `src/test/RoutePage.test.ts`, add the import and wire up `authStore` in the shared `beforeEach`. Change:

```ts
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { titleBarStore } from "../stores/titleBarStore";
import { themeStore } from "../stores/themeStore";
import RoutePage from "../pages/RoutePage.svelte";
import type { RouteEntry } from "../types/data";
import { buildFormStorageKey, saveFormState } from "../utils/formStorage";
```

to:

```ts
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { titleBarStore } from "../stores/titleBarStore";
import { themeStore } from "../stores/themeStore";
import { authStore } from "../stores/authStore";
import RoutePage from "../pages/RoutePage.svelte";
import type { RouteEntry } from "../types/data";
import { buildFormStorageKey, saveFormState } from "../utils/formStorage";
```

and change the `beforeEach` (currently lines 342-346):

```ts
beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  localStorage.clear();
  themeStore.setThemeName("wireframe");
});
```

to:

```ts
beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  localStorage.clear();
  themeStore.setThemeName("wireframe");
  authStore.loginParticipant("democrats_abroad", "Team A", "");
});
```

Then update every literal storage-key string in the file to insert `Team A` after the project segment (index/form keys) or `Team A/` before an empty contact segment (consent keys — contact is `""` since `beforeEach` logs in with `""`). There are 8 occurrences:

| Line | Old | New |
|---|---|---|
| 605 | `"democrats_abroad/den_haag/short_loop/002/form"` | `"democrats_abroad/Team A/den_haag/short_loop/002/form"` |
| 850 | `"democrats_abroad/den_haag/short_loop"` | `"democrats_abroad/Team A/den_haag/short_loop"` |
| 895 | `"democrats_abroad/den_haag/short_loop"` | `"democrats_abroad/Team A/den_haag/short_loop"` |
| 896 | `"democrats_abroad/den_haag/short_loop/consent"` | `"democrats_abroad/Team A//den_haag/short_loop/consent"` |
| 908 | `"democrats_abroad/den_haag/short_loop"` | `"democrats_abroad/Team A/den_haag/short_loop"` |
| 909 | `"democrats_abroad/den_haag/short_loop/consent"` | `"democrats_abroad/Team A//den_haag/short_loop/consent"` |
| 922 | `"democrats_abroad/den_haag/short_loop"` | `"democrats_abroad/Team A/den_haag/short_loop"` |
| 923 | `"democrats_abroad/den_haag/short_loop/consent"` | `"democrats_abroad/Team A//den_haag/short_loop/consent"` |

Also update the `buildFormStorageKey("democrats_abroad", "den_haag", "short_loop", "001")` call at line 851 to add `"Team A"` as the 5th argument:

```ts
  saveFormState(buildFormStorageKey("democrats_abroad", "den_haag", "short_loop", "001", "Team A"), {
```

Finally, add two new tests proving the auth-race fix (spec §4). Add them at the very end of the file, after the last test (`"does not fetch a version at all when there is no cached consent record (first-time participant)"`, which currently closes the file at line 941):

```ts
test("does not overwrite a team's saved index when auth resolves after mount (cold-reload race)", async () => {
  authStore.setForTest({ activeAuth: null, authLoading: true, isLoggingOut: false });
  localStorage.setItem("democrats_abroad/Team A/den_haag/short_loop", "5");
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockFinishLineEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await waitFor(() => {
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });
  // Team A's real saved index must survive the window where auth hasn't
  // resolved yet — the pre-seed placeholder (0) must never be written back.
  expect(localStorage.getItem("democrats_abroad/Team A/den_haag/short_loop")).toBe("5");

  authStore.loginParticipant("democrats_abroad", "Team A", "");
  await waitFor(() => {
    expect(localStorage.getItem("democrats_abroad/Team A/den_haag/short_loop")).toBe("5");
  });
});

test("seeds the real saved index once auth resolves after a cold-reload race", async () => {
  authStore.setForTest({ activeAuth: null, authLoading: true, isLoggingOut: false });
  localStorage.setItem("democrats_abroad/Team A/den_haag/short_loop", "1");
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockMixedEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  authStore.loginParticipant("democrats_abroad", "Team A", "");
  // mockMixedEntries[1] is the "Between Stops" text entry — reaching it
  // proves currentIndex was seeded from the real saved value (1), not left
  // at the pre-auth placeholder (0, which would show "Location 1").
  expect(await screen.findByText("Between Stops")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/RoutePage.test.ts`
Expected: most existing tests FAIL (storage keys don't include `teamName` yet, so the literal keys the tests now write to are never read by the component, and `readConsentCache`/`computePhotosTaken`/etc. calls don't compile with the new required arguments from Tasks 3/6 until Step 3 below lands). The two new race tests also FAIL — there is no auth gating yet, so the placeholder `0` gets written over the real saved index.

- [ ] **Step 3: Implement**

In `src/pages/RoutePage.svelte`, add the import (after line 13's `fetchConsentVersion` import):

```ts
  import { authStore } from "../stores/authStore";
```

Change lines 34-54 from:

```ts
  let { params }: { params: { project: string; city: string; route: string } } =
    $props();

  let storageKey = $derived(`${params.project}/${params.city}/${params.route}`);
  let routesText = $state<RoutesData | null>(null);
  let routeData = $derived(routesText?.[params.route] ?? null);
  let locationPaths = $derived(
    routeData
      ? routeData.locations.map(
          (id: string) => `projects/${params.project}/${params.city}/${id}`,
        )
      : [],
  );
  let entries = $state<RouteEntry[]>([]);

  // use localStorage to remember the last visited location index for this route
  // we use untrack to avoid svelte warnings
  const _savedIndex = localStorage.getItem(untrack(() => storageKey));
  const _parsedIndex = _savedIndex ? parseInt(_savedIndex, 10) : 0;
  let currentIndex = $state<number>(isNaN(_parsedIndex) ? 0 : _parsedIndex);
  let direction = $state<"next" | "prev">("next");
```

to:

```ts
  let { params }: { params: { project: string; city: string; route: string } } =
    $props();

  let teamName = $derived(
    $authStore.activeAuth?.kind === "participant" ? $authStore.activeAuth.teamName : "",
  );
  let contact = $derived(
    $authStore.activeAuth?.kind === "participant" ? ($authStore.activeAuth.contact ?? "") : "",
  );
  let storageKey = $derived(`${params.project}/${teamName}/${params.city}/${params.route}`);
  let routesText = $state<RoutesData | null>(null);
  let routeData = $derived(routesText?.[params.route] ?? null);
  let locationPaths = $derived(
    routeData
      ? routeData.locations.map(
          (id: string) => `projects/${params.project}/${params.city}/${id}`,
        )
      : [],
  );
  let entries = $state<RouteEntry[]>([]);

  // Team identity comes from authStore and isn't known synchronously at mount
  // (authStore.init()'s /auth/me check is async) — seeding or persisting the
  // team-scoped index before it resolves would read/write the wrong team's
  // key. hasSeededIndex gates the one-time read (below) and the persistence
  // effect until identity is known, so a hard reload into a mid-route URL
  // can never overwrite a team's real saved position with the placeholder 0.
  let currentIndex = $state<number>(0);
  let hasSeededIndex = $state(false);
  let direction = $state<"next" | "prev">("next");
```

Change lines 125-127 from:

```ts
  $effect(() => {
    localStorage.setItem(storageKey, String(currentIndex));
  });
```

to:

```ts
  $effect(() => {
    if (!$authStore.authLoading && !hasSeededIndex) {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved ? parseInt(saved, 10) : 0;
      currentIndex = isNaN(parsed) ? 0 : parsed;
      hasSeededIndex = true;
    }
  });

  $effect(() => {
    if (hasSeededIndex) {
      localStorage.setItem(storageKey, String(currentIndex));
    }
  });
```

Change the mount-normalize effect at lines 131-138 from:

```ts
  $effect(() => {
    if (!mountNormalizeAttempted && entries.length > 0) {
      mountNormalizeAttempted = true;
      if (isCheckpointEntry(entries[currentIndex])) {
        attemptAdvance(currentIndex - 1);
      }
    }
  });
```

to:

```ts
  $effect(() => {
    // Gated on hasSeededIndex too: entries can finish loading (bundled YAML,
    // effectively instant) before auth resolves (a real network round trip),
    // so without this guard the checkpoint-skip-on-mount check could run
    // against the placeholder index 0 instead of the team's real position.
    if (hasSeededIndex && !mountNormalizeAttempted && entries.length > 0) {
      mountNormalizeAttempted = true;
      if (isCheckpointEntry(entries[currentIndex])) {
        attemptAdvance(currentIndex - 1);
      }
    }
  });
```

Change the consent-staleness effect's `readConsentCache` call at line 148 from:

```ts
      const cached = readConsentCache(params.project, params.city, params.route);
```

to:

```ts
      const cached = readConsentCache(params.project, params.city, params.route, teamName, contact);
```

Change the restore-form-status effect's `buildFormStorageKey` call at lines 332-334 from:

```ts
        const state = loadFormState(
          buildFormStorageKey(params.project, params.city, params.route, locId),
        );
```

to:

```ts
        const state = loadFormState(
          buildFormStorageKey(params.project, params.city, params.route, locId, teamName),
        );
```

Change `photosCount` at line 410 from:

```ts
      ? computePhotosTaken(params.project, params.city, params.route, routeData?.locations ?? [])
```

to:

```ts
      ? computePhotosTaken(params.project, params.city, params.route, routeData?.locations ?? [], teamName)
```

Change `timeOnFoot`'s `computeElapsedSinceFirstSubmission` call at lines 417-423 from:

```ts
    const elapsed = computeElapsedSinceFirstSubmission(
      params.project,
      params.city,
      params.route,
      routeData?.locations ?? [],
      Date.now(),
    );
```

to:

```ts
    const elapsed = computeElapsedSinceFirstSubmission(
      params.project,
      params.city,
      params.route,
      routeData?.locations ?? [],
      Date.now(),
      teamName,
    );
```

Change `handleSkip`'s `buildFormStorageKey` call at line 437 from:

```ts
      const key = buildFormStorageKey(params.project, params.city, params.route, locId);
```

to:

```ts
      const key = buildFormStorageKey(params.project, params.city, params.route, locId, teamName);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/RoutePage.test.ts`
Expected: PASS (all tests, including the two new auth-race tests).

- [ ] **Step 5: Stop — do not commit**

---

## Task 8: `ChallengeForm.svelte` — team-scoped `storageKey` + `formContext.teamName` + gating

**Files:**
- Modify: `src/components/ChallengeForm.svelte:1-63,173-174`
- Test: `src/test/ChallengeForm.test.ts`

**Interfaces:**
- Consumes: `buildFormStorageKey` (Task 2), `getLocationFormValue` (Task 4), `VisibilityContext.formContext` shape (Task 5)

- [ ] **Step 1: Write the failing tests**

In `src/test/ChallengeForm.test.ts`, update the two literal storage-key strings. Line 189:

```ts
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1");
```

becomes:

```ts
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1", "Team A");
```

Line 221:

```ts
  expect(localStorage.getItem("demo/den_haag/short_loop/1/form")).toBeNull();
```

becomes:

```ts
  expect(localStorage.getItem("demo/Team A/den_haag/short_loop/1/form")).toBeNull();
```

Four more `buildFormStorageKey` calls each get `"Team A"` appended as the 5th argument:

| Line | Old | New |
|---|---|---|
| 258 | `const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1");` | `const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1", "Team A");` |
| 275 | `const sourceKey = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");` | `const sourceKey = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "Team A");` |
| 327 | `const sourceKey = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");` | `const sourceKey = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "Team A");` |
| 328 | `const targetKey = buildFormStorageKey("demo", "den_haag", "short_loop", "007_loc_binnenhof");` | `const targetKey = buildFormStorageKey("demo", "den_haag", "short_loop", "007_loc_binnenhof", "Team A");` |

Line 388-389's literal key:

```ts
  localStorage.setItem(
    "demo/den_haag/short_loop/004_loc_lange_voorhout/form",
```

becomes:

```ts
  localStorage.setItem(
    "demo/Team A/den_haag/short_loop/004_loc_lange_voorhout/form",
```

Then add a new test proving the component doesn't touch team-scoped storage while auth is still loading — add it in the "Local storage persistence and resubmit behavior" section, after the existing `restores previously-entered values...` test:

```ts
test("does not read local storage under the wrong (empty-identity) key while auth is still loading", () => {
  authStore.setForTest({ activeAuth: null, authLoading: true, isLoggingOut: false });
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1", "Team A");
  saveFormState(key, {
    values: { note: "Team A's real answer" },
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  render(ChallengeForm, {
    props: { form: [{ id: "note", type: "string" as const, label: "Your note" }], locationId: "1", routeId: "short_loop", cityId: "den_haag", project: "demo" },
  });
  // Auth hasn't resolved, so the field must not show as pre-filled from the
  // real team's key — it should read empty, not silently fall back to a
  // wrong-identity key that happens to be blank.
  expect((screen.getByLabelText("Your note") as HTMLInputElement).value).toBe("");
  authStore.loginParticipant("test_project", "Team A", "team@test.com");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/ChallengeForm.test.ts`
Expected: FAIL — `buildFormStorageKey` calls don't compile with the extra argument yet, and the new gating test finds the pre-filled value (component currently reads storage synchronously regardless of auth state).

- [ ] **Step 3: Implement**

In `src/components/ChallengeForm.svelte`, change lines 33-38 from:

```ts
  const storageKey = untrack(() => buildFormStorageKey(project, cityId, routeId, locationId));
  const stored = untrack(() =>
    storeInLocalStorage
      ? loadFormState(storageKey)
      : { values: {}, uploads: {}, submitted: false, skipped: false, touchedFields: [] },
  );
```

to:

```ts
  // Mirrors RoutePage's gating (spec §4): teamName isn't known synchronously
  // at mount (authStore.init()'s /auth/me check is async), so this component
  // must not read/write under an empty-identity key while auth is loading.
  // Lower stakes than RoutePage's index (nothing writes back on a key
  // change here), but reading under the wrong key would still show a blank
  // form where a resubmitted one should appear.
  const authLoadingAtMount = untrack(() => $authStore.authLoading);
  const teamNameAtMount = untrack(() =>
    $authStore.activeAuth?.kind === "participant" ? $authStore.activeAuth.teamName : "",
  );
  const storageKey = untrack(() =>
    authLoadingAtMount ? "" : buildFormStorageKey(project, cityId, routeId, locationId, teamNameAtMount),
  );
  const stored = untrack(() =>
    storeInLocalStorage && storageKey
      ? loadFormState(storageKey)
      : { values: {}, uploads: {}, submitted: false, skipped: false, touchedFields: [] },
  );
```

Change `persist` (lines 65-83) to guard on `storageKey` being non-empty:

```ts
  function persist(
    vals: Record<string, unknown>,
    ups: Record<string, PhotoUploadStatus>,
    submitted: boolean,
    skp: boolean,
    touched: string[],
    stampedAt: number | undefined,
  ) {
    if (storeInLocalStorage && storageKey) {
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

Change the `sourceValues` block (lines 49-63) to pass `teamNameAtMount`:

```ts
  const sourceValues = untrack(() => {
    const result: Record<string, string> = {};
    for (const field of form) {
      if (field.type === "textarea" && field.source && field.id) {
        const ref = parseSourceRef(field.source);
        if (ref) {
          const value = getLocationFormValue(project, cityId, routeId, ref.locationId, ref.fieldId, teamNameAtMount);
          if (typeof value === "string") {
            result[field.id] = value;
          }
        }
      }
    }
    return result;
  });
```

Change the `formContext` prop passed to `AppForm` (line 174) from:

```svelte
        formContext={{ project, city: cityId, route: routeId }}
```

to:

```svelte
        formContext={{ project, city: cityId, route: routeId, teamName: teamNameAtMount }}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/ChallengeForm.test.ts`
Expected: PASS.

- [ ] **Step 5: Stop — do not commit**

---

## Task 9: `OptionsScreen.svelte` — team-scoped `start_route` reset key

Must match `RoutePage`'s index key format exactly (`${project}/${teamName}/${city}/${route}`, Task 7) or "restart route" silently clears the wrong key.

**Files:**
- Modify: `src/components/OptionsScreen.svelte:52-61`
- Test: `src/test/OptionsScreen.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/test/OptionsScreen.test.ts`, update the `start_route` test (lines 80-88):

```ts
test("clears the saved route position and restarts for target value 'start_route'", async () => {
  localStorage.setItem("demo/new_york/brooklyn_route", "6");
  render(OptionsScreen, {
    props: { ...baseProps, title: "T", options: [{ text: "Go", target: { type: "page", value: "start_route" } }] },
  });
  await fireEvent.click(screen.getByText("Go"));
  expect(localStorage.getItem("demo/new_york/brooklyn_route")).toBeNull();
  expect(pushMock).toHaveBeenCalledWith("/demo/new_york/brooklyn_route");
});
```

to:

```ts
test("clears the saved route position and restarts for target value 'start_route'", async () => {
  localStorage.setItem("demo/Team A/new_york/brooklyn_route", "6");
  render(OptionsScreen, {
    props: { ...baseProps, title: "T", options: [{ text: "Go", target: { type: "page", value: "start_route" } }] },
  });
  await fireEvent.click(screen.getByText("Go"));
  expect(localStorage.getItem("demo/Team A/new_york/brooklyn_route")).toBeNull();
  expect(pushMock).toHaveBeenCalledWith("/demo/new_york/brooklyn_route");
});
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `npx vitest run src/test/OptionsScreen.test.ts`
Expected: FAIL — `handlePageSelect` still removes the un-scoped key, so `localStorage.getItem("demo/Team A/new_york/brooklyn_route")` is still `"6"`, not `null`.

- [ ] **Step 3: Implement**

In `src/components/OptionsScreen.svelte`, change:

```ts
  function handlePageSelect(value: "title" | "project" | "start_route" | "gallery" | "continue") {
    if (value === "continue") {
      onContinue?.();
    } else {
      if (value === "start_route") {
        localStorage.removeItem(`${project}/${city}/${route}`);
      }
      push(resolvePageUrl(value, { project, city, route }));
    }
  }
```

to:

```ts
  function handlePageSelect(value: "title" | "project" | "start_route" | "gallery" | "continue") {
    if (value === "continue") {
      onContinue?.();
    } else {
      if (value === "start_route") {
        const auth = $authStore.activeAuth;
        const teamName = auth?.kind === "participant" ? auth.teamName : "";
        localStorage.removeItem(`${project}/${teamName}/${city}/${route}`);
      }
      push(resolvePageUrl(value, { project, city, route }));
    }
  }
```

(`authStore` is already imported in this file for `trackSelection` — no new import needed.)

- [ ] **Step 4: Run tests to verify it passes**

Run: `npx vitest run src/test/OptionsScreen.test.ts`
Expected: PASS.

- [ ] **Step 5: Stop — do not commit**

---

## Task 10: `ConsentScreen.svelte` — `teamName` + `contact` wired to `writeConsentCache`

**Files:**
- Modify: `src/components/ConsentScreen.svelte:1-66`
- Test: `src/test/ConsentScreen.test.ts`

**Interfaces:**
- Consumes: `writeConsentCache` (Task 3)

- [ ] **Step 1: Write the failing test**

In `src/test/ConsentScreen.test.ts`, add the imports:

```ts
import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import { vi, beforeEach } from "vitest";
import ConsentScreen from "../components/ConsentScreen.svelte";
import * as api from "../utils/api";
import { authStore } from "../stores/authStore";
import { readConsentCache } from "../utils/consentCache";
```

Change the top-level `beforeEach` from:

```ts
beforeEach(() => vi.clearAllMocks());
```

to:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  authStore.loginParticipant("den_haag", "Team A", "alice@test.com");
});
```

Add a new test after `"submitting posts consent and calls onContinue"` (currently ending at line 151):

```ts
test("writes the consent cache scoped to the current team and contact", async () => {
  vi.spyOn(api, "postConsentUpdate").mockResolvedValue({
    ok: true,
    record: { all_sixteen_plus: 1, promo_consent: 0, promo_approved: 0, consent_version: 4 },
  });
  render(ConsentScreen, { entry, project: "den_haag", city: "den_haag", route: "short_loop", onContinue: () => {} });
  await fireEvent.click(screen.getByRole("button", { name: "Yes" }));
  await fireEvent.click(screen.getByRole("button", { name: entry.primaryButtonText }));
  expect(readConsentCache("den_haag", "den_haag", "short_loop", "Team A", "alice@test.com")).toEqual({
    consentVersion: 4,
  });
  // A different team member (same team, different contact) must not see
  // this cache — consent is personal, per spec §1.
  expect(readConsentCache("den_haag", "den_haag", "short_loop", "Team A", "bob@test.com")).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/ConsentScreen.test.ts -t "writes the consent cache scoped"`
Expected: FAIL — `ConsentScreen` doesn't call `writeConsentCache` with `teamName`/`contact` yet (TypeScript error once Task 3 lands), and `readConsentCache("den_haag", "den_haag", "short_loop", "Team A", "alice@test.com")` finds nothing.

- [ ] **Step 3: Implement**

In `src/components/ConsentScreen.svelte`, add the import (after the existing `writeConsentCache` import at line 11):

```ts
  import { authStore } from "../stores/authStore";
```

Change `handleSubmit` (lines 54-66) from:

```ts
  async function handleSubmit(values: Record<string, unknown>) {
    const allSixteenPlus = values["all_sixteen_plus"] === "Yes";
    const promoConsent = values["promo_consent"] === true;
    try {
      const res = await postConsentUpdate(city, route, { allSixteenPlus, promoConsent, acknowledge: true });
      if (res.record) {
        writeConsentCache(project, city, route, { consentVersion: res.record.consent_version });
      }
    } catch {
      // Never blocks navigation — see spec §13.
    }
    onContinue?.();
  }
```

to:

```ts
  async function handleSubmit(values: Record<string, unknown>) {
    const allSixteenPlus = values["all_sixteen_plus"] === "Yes";
    const promoConsent = values["promo_consent"] === true;
    try {
      const res = await postConsentUpdate(city, route, { allSixteenPlus, promoConsent, acknowledge: true });
      if (res.record) {
        const auth = $authStore.activeAuth;
        const teamName = auth?.kind === "participant" ? auth.teamName : "";
        const contact = auth?.kind === "participant" ? (auth.contact ?? "") : "";
        writeConsentCache(project, city, route, { consentVersion: res.record.consent_version }, teamName, contact);
      }
    } catch {
      // Never blocks navigation — see spec §13.
    }
    onContinue?.();
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/ConsentScreen.test.ts`
Expected: PASS (all tests in the file — the pre-existing ones now run with an authenticated participant in `beforeEach`, which doesn't change their assertions since none of them inspected the consent cache before).

- [ ] **Step 5: Stop — do not commit**

---

## Final verification (after all 10 tasks)

- [ ] Run the full test suite: `npx vitest run`. Expected: all tests pass (no regressions in files not touched by this plan).
- [ ] Run `npm run lint`. Expected: 0 errors.
- [ ] Run `npx tsc --noEmit` (or `npm run build` if that's the project's typecheck entry point). Expected: 0 errors.
- [ ] Manually re-read spec `doc/superpowers/specs/2026-08-01-team-scoped-local-storage-design.md`'s acceptance criteria checklist and confirm each item is satisfied by the tasks above.
- [ ] Update `doc/devlog/devlog.md` per this project's CLAUDE.md ("Session End" — add a dated entry at the top; note the file is `devlog.md`, distinct from the historical `_devlog.md` this plan's research read from).
- [ ] Stop — do not commit, push, or open a PR. Leave everything for the user to review.
