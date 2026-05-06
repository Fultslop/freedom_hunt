# Task 7: Nav buttons + snap mode cleanup

Status: Completed

**Previous:** [Task 6 — Drag state + commit/spring-back](task-06-drag-wiring.md)  
**Next:** —

**Files:**
- Modify: `src/pages/RoutePage.svelte`

---

Update the Prev/Next nav buttons to call `handleDragEnd` so both input methods (swipe and tap) use the same animation path. Then remove the old inline `handleTouchStart`/`handleTouchEnd` functions and `ontouchstart`/`ontouchend` attributes, which are now fully replaced by `use:swipe`.

- [ ] **Step 1: Update the Prev button `onclick` handler**

Find the Prev button in the nav:

```svelte
<button
  aria-label="Previous stop"
  onclick={() => {
    direction = "prev";
    currentIndex = clampedPrev(currentIndex);
  }}
  class="route-page__prev-btn"
>
```

Replace the `onclick` with:

```svelte
<button
  aria-label="Previous stop"
  onclick={() => handleDragEnd(cardWidth)}
  class="route-page__prev-btn"
>
```

`handleDragEnd(cardWidth)` passes a positive delta equal to the full card width — that always clears `shouldCommitSwipe` (100% ≥ 30%), so it commits to the previous card. In snap mode, `cardWidth > 60` so the snap threshold is also met.

- [ ] **Step 2: Update the Next button `onclick` handler**

Find the Next button:

```svelte
<button
  aria-label="Next stop"
  onclick={() => {
    direction = "next";
    currentIndex = clampedNext(currentIndex, locations.length);
  }}
  class="route-page__next-btn"
>
```

Replace with:

```svelte
<button
  aria-label="Next stop"
  onclick={() => handleDragEnd(-cardWidth)}
  class="route-page__next-btn"
>
```

Negative delta = going forward (next card).

- [ ] **Step 3: Remove the old touch handlers**

In the `<script>` block, delete:

```typescript
function handleTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX;
}

function handleTouchEnd(e: TouchEvent) {
  if (touchStartX !== null) {
    const delta = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (delta < -60) {
      direction = "next";
      currentIndex = clampedNext(currentIndex, locations.length);
    } else if (delta > 60) {
      direction = "prev";
      currentIndex = clampedPrev(currentIndex);
    }
  }
}
```

Also remove the `let touchStartX = $state<number | null>(null);` line.

- [ ] **Step 4: Remove `ontouchstart`/`ontouchend` from the outer `<div>`**

Find:

```svelte
<div
  class="route-page"
  role="region"
  aria-label="Hunt route"
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
>
```

Replace with:

```svelte
<div
  class="route-page"
  role="region"
  aria-label="Hunt route"
>
```

(Touch handling is now done by `use:swipe` on `.route-page__strip` in the template.)

- [ ] **Step 5: Verify typecheck and lint**

Run: `npm run lint`

Expected: 0 errors. No unused variables.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`

Expected: all tests pass. The `RoutePage.swipe.test.ts` tests only import from `routeNav.ts`, so they are unaffected.

- [ ] **Step 7: Final smoke test**

Run: `npm run dev`. Test all three themes:

**wireframe (snap):**
- Swipe left/right — instant card change with slide animation, no drag feedback.
- Tap Next/Prev buttons — instant change.
- Vertical scroll works normally.

**app (carousel):**
- Drag left/right — all three card portions move together.
- Commit past 30% — smooth animation, card changes.
- Spring back under 30% — card returns to centre.
- Tap Next/Prev — animated card change (same as committing a full swipe).
- Vertical scroll within a card works; horizontal drag does not accidentally scroll.

**GWC (peek):**
- Drag left — current card peels away left, revealing the fixed next card sliver growing.
- Drag right — current card peels away right, revealing prev.
- Commit and spring-back work correctly.
- Tap Next/Prev — animated peek card change.

- [ ] **Step 8: Commit**

```
git add src/pages/RoutePage.svelte
git commit -m "feat: route nav buttons use commit path; remove old touch handlers"
```

- [ ] **Step 9: Update the devlog**

Add an entry at the top of `doc/devlog/_devlog.md`:

```
**05/05/2026, Claude**: [FEAT] Swipe drag feedback with peek/carousel/snap modes.

- Rewrote `swipe.ts` action with direction-locking (horizontal vs vertical) and continuous `onDragMove`/`onDragEnd` events
- Added `SwipeConfig` to `Theme` type; wireframe=snap, app=carousel, GWC=peek with configurable hint px
- RoutePage renders three-card strip (prev/current/next) absolutely positioned; slots translate via CSS transform
- Commit animation (250ms ease-out) and elastic resistance at first/last card
- Nav buttons reuse the same commit path as swipe gestures
```
