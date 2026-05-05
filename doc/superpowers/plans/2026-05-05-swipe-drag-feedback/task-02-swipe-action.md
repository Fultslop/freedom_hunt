# Task 2: Swipe action rewrite (TDD)

Status: Completed

**Previous:** [Task 1 — Types](task-01-types.md)  
**Next:** [Task 3 — Commit/elastic helpers](task-03-helpers.md)

**Files:**
- Create: `src/test/swipe.test.ts`
- Modify: `src/actions/swipe.ts`

---

The current `swipe.ts` only fires on `touchend`. This task rewrites it to emit continuous drag deltas (`onDragMove`) with direction-locking so vertical scrolling is never suppressed.

- [ ] **Step 1: Create `src/test/swipe.test.ts` with all failing tests**

```typescript
import { describe, test, expect, vi } from "vitest";
import { swipe } from "../actions/swipe";

function touchStart(el: HTMLElement, x: number, y: number) {
  el.dispatchEvent(
    new TouchEvent("touchstart", {
      touches: [{ clientX: x, clientY: y } as Touch],
      changedTouches: [{ clientX: x, clientY: y } as Touch],
      bubbles: true,
      cancelable: true,
    })
  );
}

function touchMove(el: HTMLElement, x: number, y: number): TouchEvent {
  const evt = new TouchEvent("touchmove", {
    touches: [{ clientX: x, clientY: y } as Touch],
    changedTouches: [{ clientX: x, clientY: y } as Touch],
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(evt);
  return evt;
}

function touchEnd(el: HTMLElement, x: number, y: number) {
  el.dispatchEvent(
    new TouchEvent("touchend", {
      touches: [],
      changedTouches: [{ clientX: x, clientY: y } as Touch],
      bubbles: true,
      cancelable: true,
    })
  );
}

describe("swipe action — direction lock", () => {
  test("predominantly vertical touchmove does not call onDragMove", () => {
    const el = document.createElement("div");
    const onDragMove = vi.fn();
    swipe(el, { onDragMove, onDragEnd: vi.fn() });

    touchStart(el, 100, 100);
    touchMove(el, 102, 130); // dy=30 > dx=2 → vertical

    expect(onDragMove).not.toHaveBeenCalled();
  });

  test("predominantly horizontal touchmove calls onDragMove with delta", () => {
    const el = document.createElement("div");
    const onDragMove = vi.fn();
    swipe(el, { onDragMove, onDragEnd: vi.fn() });

    touchStart(el, 100, 100);
    touchMove(el, 130, 102); // dx=30 > dy=2 → horizontal, delta=30

    expect(onDragMove).toHaveBeenCalledWith(30);
  });

  test("direction lock persists for the touch even when motion turns vertical", () => {
    const el = document.createElement("div");
    const onDragMove = vi.fn();
    swipe(el, { onDragMove, onDragEnd: vi.fn() });

    touchStart(el, 100, 100);
    touchMove(el, 130, 102); // locks horizontal
    touchMove(el, 131, 180); // very vertical, but still horizontal-locked

    expect(onDragMove).toHaveBeenCalledTimes(2);
    expect(onDragMove).toHaveBeenLastCalledWith(31);
  });

  test("touchend calls onDragEnd with final delta after horizontal lock", () => {
    const el = document.createElement("div");
    const onDragEnd = vi.fn();
    swipe(el, { onDragMove: vi.fn(), onDragEnd });

    touchStart(el, 100, 100);
    touchMove(el, 130, 102);
    touchEnd(el, 160, 105);

    expect(onDragEnd).toHaveBeenCalledWith(60); // 160 - 100
  });

  test("touchend does not call onDragEnd after vertical lock", () => {
    const el = document.createElement("div");
    const onDragEnd = vi.fn();
    swipe(el, { onDragMove: vi.fn(), onDragEnd });

    touchStart(el, 100, 100);
    touchMove(el, 102, 130); // vertical lock
    touchEnd(el, 104, 160);

    expect(onDragEnd).not.toHaveBeenCalled();
  });

  test("direction resets between touches", () => {
    const el = document.createElement("div");
    const onDragMove = vi.fn();
    swipe(el, { onDragMove, onDragEnd: vi.fn() });

    // First touch — vertical
    touchStart(el, 100, 100);
    touchMove(el, 102, 130);
    touchEnd(el, 102, 160);

    // Second touch — horizontal
    touchStart(el, 100, 100);
    touchMove(el, 130, 102);

    expect(onDragMove).toHaveBeenCalledTimes(1);
    expect(onDragMove).toHaveBeenCalledWith(30);
  });

  test("destroy removes event listeners", () => {
    const el = document.createElement("div");
    const onDragMove = vi.fn();
    const action = swipe(el, { onDragMove, onDragEnd: vi.fn() });
    action.destroy();

    touchStart(el, 100, 100);
    touchMove(el, 150, 100);

    expect(onDragMove).not.toHaveBeenCalled();
  });

  test("update replaces params", () => {
    const el = document.createElement("div");
    const first = vi.fn();
    const second = vi.fn();
    const action = swipe(el, { onDragMove: first, onDragEnd: vi.fn() });
    action.update({ onDragMove: second, onDragEnd: vi.fn() });

    touchStart(el, 100, 100);
    touchMove(el, 130, 102);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(30);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/test/swipe.test.ts`

Expected: all tests fail (the current `swipe.ts` has `onSwipeLeft`/`onSwipeRight`, not `onDragMove`/`onDragEnd`).

- [ ] **Step 3: Rewrite `src/actions/swipe.ts`**

Replace the entire file:

```typescript
export interface SwipeParams {
  onDragMove: (delta: number) => void;
  onDragEnd: (delta: number) => void;
  threshold?: number;
}

export function swipe(node: HTMLElement, params: SwipeParams) {
  let startX = 0;
  let startY = 0;
  let direction: "horizontal" | "vertical" | null = null;
  let threshold = params.threshold ?? 10;

  function onTouchStart(evt: TouchEvent) {
    startX = evt.touches[0].clientX;
    startY = evt.touches[0].clientY;
    direction = null;
  }

  function onTouchMove(evt: TouchEvent) {
    const x = evt.changedTouches[0].clientX;
    const y = evt.changedTouches[0].clientY;
    const dx = x - startX;
    const dy = y - startY;

    if (direction === null) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
      direction = Math.abs(dx) >= Math.abs(dy) ? "horizontal" : "vertical";
    }

    if (direction === "horizontal") {
      evt.preventDefault();
      params.onDragMove(dx);
    }
  }

  function onTouchEnd(evt: TouchEvent) {
    if (direction === "horizontal") {
      const dx = evt.changedTouches[0].clientX - startX;
      params.onDragEnd(dx);
    }
    direction = null;
  }

  node.addEventListener("touchstart", onTouchStart, { passive: true });
  node.addEventListener("touchmove", onTouchMove, { passive: false });
  node.addEventListener("touchend", onTouchEnd);

  return {
    update(newParams: SwipeParams) {
      params = newParams;
      threshold = newParams.threshold ?? 10;
    },
    destroy() {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
    },
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run src/test/swipe.test.ts`

Expected: all 8 tests pass.

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `npx vitest run`

Expected: all tests pass. The `RoutePage.swipe.test.ts` tests only test `clampedNext`/`clampedPrev` (not the action), so no regressions there. If any other test file imports `swipe.ts` for its old interface, update that import now.

- [ ] **Step 6: Commit**

```
git add src/test/swipe.test.ts src/actions/swipe.ts
git commit -m "feat: rewrite swipe action with direction-locking drag events"
```
