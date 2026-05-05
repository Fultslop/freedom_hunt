# Task 6: RoutePage — drag state + commit/spring-back

Status: Completed

**Previous:** [Task 5 — Static strip render](task-05-strip-render.md)  
**Next:** [Task 7 — Nav buttons + snap mode](task-07-nav-snap.md)

**Files:**
- Modify: `src/pages/RoutePage.svelte`

---

Wire `dragOffset` state into the strip template so slots move with the finger, then implement `onDragMove`/`onDragEnd` with commit, spring-back, and elastic resistance.

- [ ] **Step 1: Add drag state variables to the `<script>` block**

After the existing `let direction = $state<"next" | "prev">("next");` line, add:

```typescript
let dragOffset = $state(0);
let isAnimating = $state(false);
let pendingCommit = $state<"next" | "prev" | null>(null);
```

- [ ] **Step 2: Add `handleDragMove` and `handleDragEnd` functions**

Add these two functions to the `<script>` block, after the existing touch handlers (which will be removed in Task 7 — leave them for now):

```typescript
function handleDragMove(delta: number) {
  if (isAnimating) return;

  if (swipeMode === "snap") return; // snap mode ignores drag

  const atStart = currentIndex === 0;
  const atEnd = currentIndex === locations.length - 1;

  if (delta > 0 && atStart) {
    dragOffset = elasticOffset(delta); // elastic resistance — no prev card
  } else if (delta < 0 && atEnd) {
    dragOffset = elasticOffset(delta); // elastic resistance — no next card
  } else {
    dragOffset = delta;
  }
}

function handleDragEnd(delta: number) {
  if (isAnimating) return;

  if (swipeMode === "snap") {
    // snap mode: instant index change, no drag animation
    if (delta < -60) {
      direction = "next";
      currentIndex = clampedNext(currentIndex, locations.length);
    } else if (delta > 60) {
      direction = "prev";
      currentIndex = clampedPrev(currentIndex);
    }
    dragOffset = 0;
    return;
  }

  const atStart = currentIndex === 0;
  const atEnd = currentIndex === locations.length - 1;
  const goingNext = delta < 0;
  const goingPrev = delta > 0;

  if (goingNext && !atEnd && shouldCommitSwipe(delta, cardWidth)) {
    pendingCommit = "next";
    isAnimating = true;
    dragOffset = -cardWidth;
  } else if (goingPrev && !atStart && shouldCommitSwipe(delta, cardWidth)) {
    pendingCommit = "prev";
    isAnimating = true;
    dragOffset = cardWidth;
  } else {
    // spring back
    isAnimating = true;
    dragOffset = 0;
  }
}

function handleTransitionEnd(e: TransitionEvent) {
  if (e.propertyName !== "transform") return;
  isAnimating = false;
  if (pendingCommit === "next") {
    direction = "next";
    currentIndex = clampedNext(currentIndex, locations.length);
  } else if (pendingCommit === "prev") {
    direction = "prev";
    currentIndex = clampedPrev(currentIndex);
  }
  pendingCommit = null;
  dragOffset = 0;
}
```

- [ ] **Step 3: Wire `use:swipe` and `ontransitionend` into the template**

Attach `use:swipe` to the **outer `.route-page` div** (not the strip) so it is active in both snap and strip modes:

```svelte
<div
  class="route-page"
  role="region"
  aria-label="Hunt route"
  use:swipe={{ onDragMove: handleDragMove, onDragEnd: handleDragEnd }}
>
```

Update each slot's inline style to apply `dragOffset` as a `translateX` transform, and add the `--animating` class and `ontransitionend` where needed.

**Prev slot (carousel mode translates, peek mode stays fixed):**

```svelte
<div
  class="route-page__slot"
  class:route-page__slot--animating={isAnimating && swipeMode === "carousel"}
  style="left: {prevLeft}px; width: {cardWidth}px; transform: translateX({swipeMode === 'carousel' ? dragOffset : 0}px)"
>
```

**Current slot (always translates in both modes):**

```svelte
<div
  class="route-page__slot"
  class:route-page__slot--animating={isAnimating}
  style="left: {currentLeft}px; width: {cardWidth}px; transform: translateX({dragOffset}px)"
  ontransitionend={handleTransitionEnd}
>
```

**Next slot (carousel mode translates, peek mode stays fixed):**

```svelte
<div
  class="route-page__slot"
  class:route-page__slot--animating={isAnimating && swipeMode === "carousel"}
  style="left: {nextLeft}px; width: {cardWidth}px; transform: translateX({swipeMode === 'carousel' ? dragOffset : 0}px)"
>
```

Apply the same changes to the empty placeholder divs (they need matching dimensions but no `ontransitionend`):

```svelte
<div
  class="route-page__slot route-page__slot--empty"
  style="left: {prevLeft}px; width: {cardWidth}px"
></div>
```

(Empty slots don't translate — they're just geometry holders at first/last card.)

- [ ] **Step 4: Verify typecheck and lint**

Run: `npm run lint`

Expected: 0 errors.

- [ ] **Step 5: Smoke-test drag in browser**

Run: `npm run dev`. Open DevTools, toggle device mode to a mobile viewport.

With `app` theme (carousel mode):
1. Touch and drag horizontally — all three visible card portions move together with the finger.
2. Release past ~30% of card width — card commits with animation, next card centres.
3. Release short of 30% — card springs back to centre.
4. Drag vertically on a card — card does NOT move, page scrolls normally.
5. Drag right on the first card — slight elastic resistance, springs back.
6. Drag left on the last card — slight elastic resistance, springs back.

With `GWC` theme (peek mode):
1. Touch and drag horizontally — only the current card moves; the next/prev slivers stay fixed at the edges.
2. As current card moves left, next card's sliver grows — current card "peels away" to reveal it.
3. Commit and spring-back work identically to carousel.

- [ ] **Step 6: Commit**

```
git add src/pages/RoutePage.svelte
git commit -m "feat: wire drag state and commit/spring-back into strip"
```
