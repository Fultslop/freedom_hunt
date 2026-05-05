# Task 3: Commit/elastic helpers (TDD)

**Previous:** [Task 2 — Swipe action rewrite](task-02-swipe-action.md)  
**Next:** [Task 4 — RoutePage CSS](task-04-css.md)

**Files:**
- Modify: `src/utils/routeNav.ts`
- Modify: `src/test/RoutePage.swipe.test.ts`

---

Two pure functions needed by RoutePage's drag logic: a commit-threshold check and an elastic damping function. Following the same pattern as `clampedNext`/`clampedPrev`, they live in `routeNav.ts` so they can be tested without mounting the component.

- [ ] **Step 1: Add failing tests to `src/test/RoutePage.swipe.test.ts`**

Append to the existing file (keep the existing four `clampedNext`/`clampedPrev` tests):

```typescript
import { clampedNext, clampedPrev, shouldCommitSwipe, elasticOffset } from "../utils/routeNav";

// ... existing tests ...

describe("shouldCommitSwipe", () => {
  test("returns true when |delta| >= 30% of cardWidth", () => {
    expect(shouldCommitSwipe(90, 300)).toBe(true);   // exactly 30%
    expect(shouldCommitSwipe(-90, 300)).toBe(true);  // negative direction
    expect(shouldCommitSwipe(120, 300)).toBe(true);  // more than 30%
  });

  test("returns false when |delta| < 30% of cardWidth", () => {
    expect(shouldCommitSwipe(89, 300)).toBe(false);
    expect(shouldCommitSwipe(-89, 300)).toBe(false);
    expect(shouldCommitSwipe(0, 300)).toBe(false);
  });
});

describe("elasticOffset", () => {
  test("dampens to 20% of input", () => {
    expect(elasticOffset(100)).toBe(20);
    expect(elasticOffset(-50)).toBe(-10);
    expect(elasticOffset(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/test/RoutePage.swipe.test.ts`

Expected: the two new `describe` blocks fail with "is not a function".

- [ ] **Step 3: Add the two helpers to `src/utils/routeNav.ts`**

Append to the existing file (keep `clampedNext`/`clampedPrev` unchanged):

```typescript
export function shouldCommitSwipe(delta: number, cardWidth: number): boolean {
  return Math.abs(delta) >= cardWidth * 0.3;
}

export function elasticOffset(delta: number): number {
  return delta * 0.2;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run src/test/RoutePage.swipe.test.ts`

Expected: all 8 tests pass (4 existing + 4 new).

- [ ] **Step 5: Commit**

```
git add src/utils/routeNav.ts src/test/RoutePage.swipe.test.ts
git commit -m "feat: add shouldCommitSwipe and elasticOffset helpers"
```
