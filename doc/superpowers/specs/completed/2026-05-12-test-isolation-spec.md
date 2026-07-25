# Test Isolation: Stale Mock Reference Bug

**Date:** 2026-05-12
**Status:** Partially fixed. Monitor for recurrence.

---

## Root Cause

Vitest is configured with `isolate: false` (`vite.config.ts`). This means all test files run in the same module registry — modules are loaded once and cached. Combined with `vi.mock`, this creates a stale reference hazard:

1. `TestA.test.ts` (runs first alphabetically) registers `vi.mock("../foo")` → **Mock-A**
2. `TestA` imports `ComponentX` which also imports `../foo` → `ComponentX` is compiled and cached with a reference to **Mock-A**
3. `TestB.test.ts` runs later, registers a new `vi.mock("../foo")` → **Mock-B**
4. `TestB`'s `import { foo }` resolves to **Mock-B**
5. But the cached `ComponentX` still holds a reference to **Mock-A**
6. `vi.mocked(foo).mock.calls` in `TestB` sees 0 calls — `ComponentX` is calling Mock-A silently

The bug **only surfaces** when a test both renders the component directly **and** inspects `mock.calls` / `toHaveBeenCalledWith` on the result.

---

## Symptoms

- Test passes locally, fails on CI (Linux file ordering may differ from Windows)
- OR: flaky test that depends on which other test file runs first
- `mock.calls.length === 0` even though the component clearly renders and the action/function should have been called
- `vi.waitFor` timeout after the full 1000ms (action never fires from the perspective of the test's mock instance)

---

## Fixed Cases

### `../actions/leafletMap` — fixed 2026-05-12

`AppForm.test.ts` (A) mocks `leafletMap` and loads `CoordinatePicker.svelte` transitively via `AppForm.svelte`. `CoordinatePicker.test.ts` (C) registered its own mock but the cached component was calling AppForm's mock instance.

**Fix:** Dependency injection. `CoordinatePicker.svelte` now accepts an optional `mapAction` prop (defaults to the real `leafletMap`). `CoordinatePicker.test.ts` passes a local `vi.fn` directly — no module mocking needed.

```ts
// CoordinatePicker.svelte
let { value, onchange, mapAction = defaultMapAction } = $props();
```

```ts
// CoordinatePicker.test.ts — no vi.mock, no module import needed
const mockMapAction = vi.fn((_node: HTMLElement, _params: LeafletMapParams) => ({
  update: vi.fn(), destroy: vi.fn(),
}));
render(CoordinatePicker, { props: { ..., mapAction: mockMapAction } });
```

---

## At-Risk Cases (not yet failing)

### `../utils/api` — HIGH risk

**Why:** `ChallengeForm.test.ts` mocks `../utils/api` **and** asserts `toHaveBeenCalledWith`. Three other files (`EditorLocationForm`, `EditorLocationList`, `EditorLoginPage`) also mock the same module. If any of those runs before `ChallengeForm.test.ts` and loads `ChallengeForm.svelte` transitively, the stale-reference bug will trigger.

**If it breaks:** Apply the same DI pattern — add `onSubmit`/`onUpload` as optional props to `ChallengeForm.svelte` with the real API functions as defaults. Pass mocks directly in `ChallengeForm.test.ts`.

### `svelte-spa-router` — LOW risk (no assertions on `push.mock.calls`)

Multiple test files mock `svelte-spa-router`. Components like `TitleBar`, `RouteSelector`, and `CitySelector` import `push` directly. However, no component test file asserts on `push.mock.calls`, so the stale reference will silently call the wrong mock without breaking test assertions.

**If it breaks:** Same DI pattern, or just verify that the failing test is actually asserting on `push`.

---

## General Fix Pattern

When a component:
- has its own dedicated `ComponentName.test.ts`, **and**
- uses a module that is also mocked in another test file that loads this component transitively

→ inject the dependency as an optional prop rather than relying on `vi.mock`.

```ts
// Before: module import used directly in template
import { someAction } from "../actions/someAction";
// use:someAction={{ ... }}

// After: injected as prop with real function as default
import { someAction as defaultAction } from "../actions/someAction";
let { mapAction = defaultAction } = $props();
// use:mapAction={{ ... }}
```

---

## Permanent Fix

Enable `isolate: true` in `vite.config.ts`. This eliminates the root cause entirely — each test file gets a fresh module registry. Likely requires reviewing tests that depend on shared state between files (e.g. `stores.test.ts` `beforeEach` resets).
