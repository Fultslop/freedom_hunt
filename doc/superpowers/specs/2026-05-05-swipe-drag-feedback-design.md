# Swipe Drag Feedback — Design Spec

**Date:** 2026-05-05  
**Status:** Approved

## Problem

On mobile, swiping between challenge cards gives no real-time feedback. Nothing moves until the gesture ends, at which point the new card appears via a slide animation. This feels unresponsive and disconnects the gesture from the result.

## Goal

- The current card follows the user's finger as they swipe
- Adjacent cards (prev/next) are pre-rendered and peek into view during a drag
- The behaviour is configurable per theme: `peek`, `carousel`, or `snap`
- Vertical scrolling within cards is unaffected

---

## Theme Config

Each theme gains a `swipe` sub-object:

```typescript
interface SwipeConfig {
  mode: 'peek' | 'carousel' | 'snap';
  hint: number; // px of adjacent card visible at rest; always 0 for snap
}
```

| Theme | mode | hint |
|---|---|---|
| wireframe | `snap` | `0` |
| app | `carousel` | `16` |
| GWC | `peek` | `12` |

`snap` mode preserves the existing behaviour (no drag feedback, CSS slide animation on index change). `hint: 0` is enforced for snap regardless of what is set.

---

## Swipe Action (`src/actions/swipe.ts`)

Full rewrite. The action is mode-agnostic — it always emits drag deltas; RoutePage decides what to do with them based on the active theme.

```typescript
interface SwipeParams {
  onDragMove: (delta: number) => void;
  onDragEnd: (delta: number) => void;
  threshold?: number; // px before direction is locked (default 10)
}
```

### Direction lock

On `touchstart`: record `startX`, `startY`. Set `locked = false`.

On first `touchmove` where `Math.max(|dx|, |dy|) >= threshold`:
- If `|dy| > |dx|`: vertical gesture — do nothing for this entire touch (let browser handle scroll)
- If `|dx| >= |dy|`: horizontal gesture — call `e.preventDefault()` to suppress scroll, begin emitting drag deltas

Once locked, direction does not change for the life of that touch.

On `touchend`: emit `onDragEnd(finalDelta)`. Reset all state.

---

## RoutePage — Strip Layout

### DOM structure

RoutePage always renders three card slots. Out-of-bounds slots (prev when `currentIndex === 0`, next when at the last card) render empty placeholder divs of identical dimensions to keep geometry stable.

```
.route-page__strip
  .route-page__slot          ← prev (or empty placeholder)
    <ChallengeCard />
  .route-page__slot          ← current
    <ChallengeCard />
  .route-page__slot          ← next (or empty placeholder)
    <ChallengeCard />
```

### Sizing

- `cardWidth = window.innerWidth - 2 * hint` (computed once on mount and on resize)
- Each slot is `cardWidth` px wide, absolutely positioned within a `position: relative` container that is `100vw` wide and `overflow: hidden`
- Resting positions (at `dragOffset = 0`):
  - prev: `left = hint - cardWidth` (right edge lands at `hint` px from left — shows `hint` px)
  - current: `left = hint`
  - next: `left = hint + cardWidth` (left edge lands at `100vw - hint` — shows `hint` px from right)

### Drag state

```typescript
let dragOffset = $state(0);
let isAnimating = $state(false);
```

`isAnimating` prevents new drags from starting during a commit or spring-back animation.

### During drag (`onDragMove(delta)`)

All three slots are always absolutely positioned (both modes). The difference is which elements translate:

| Mode | Behaviour |
|---|---|
| `snap` | Ignore — `dragOffset` stays `0` |
| `carousel` | `dragOffset = delta` — all three slots translate together (each by `dragOffset`) |
| `peek` | `dragOffset = delta` — only the current slot translates; prev and next stay at their resting positions |

**Elastic resistance at edges:** when dragging toward a missing neighbour (first card swiping right, last card swiping left), `dragOffset = delta * 0.2`. The card moves but resists.

### On release (`onDragEnd(delta)`)

Commit threshold: `Math.abs(delta) >= cardWidth * 0.3`

- **Commit**: enable CSS transition on the moving element(s), animate `dragOffset` to `±cardWidth` (full card travel), then in `transitionend`: advance `currentIndex`, disable transition, reset `dragOffset` to `0` instantly. The slots re-render at new resting positions with no visible jump.
- **Spring back**: enable CSS transition, set `dragOffset = 0`, disable transition in `transitionend`.

In carousel mode the transition applies to the whole-strip wrapper; in peek mode it applies to the current slot element only.

The nav buttons (Prev / Next) call the same commit path so both input methods behave identically.

### Snap mode

`hint = 0`, `dragOffset` always `0`. The card fills the full viewport. On swipe end, `currentIndex` changes and a CSS class triggers the existing `slideInFromRight`/`slideInFromLeft` keyframe animations. These keyframes are kept in `global.css` for snap mode only.

---

## CSS (`src/pages/RoutePage.css`)

Each card slot is `height: 100dvh; overflow-y: auto` — cards fill the viewport and scroll vertically within their slot. This is the standard mobile pattern and solves the strip height problem: the strip also sets `height: 100dvh`, so `overflow: hidden` clips horizontal overflow correctly without affecting vertical scroll (which is internal to each slot, not to the strip).

```css
.route-page__strip {
  position: relative;
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
}

.route-page__slot {
  position: absolute;
  top: 0;
  height: 100dvh;
  overflow-y: auto;
  /* left and width set via inline style (runtime: hint + dragOffset) */
  will-change: transform;
}

.route-page__slot--animating {
  transition: transform 250ms ease-out;
}

.route-page__slot--empty {
  /* same dimensions, no content */
}
```

`will-change: transform`, slot `left`, and slot `width` are inline styles — runtime-computed. The `--animating` modifier is toggled by Svelte class binding during commit/spring-back only.

The existing `.route-page__cards` padding-bottom (for the fixed nav bar) moves to `.route-page__slot` so each card's scroll area clears the nav.

---

## Files Changed

| File | Change |
|---|---|
| `src/theme/themes.ts` | Add `swipe: SwipeConfig` to each of the three themes |
| `src/types/theme.ts` (new file) | Add `SwipeConfig` interface |
| `src/actions/swipe.ts` | Rewrite: drag-aware, direction-locking, mode-agnostic |
| `src/pages/RoutePage.svelte` | Three-card strip, drag state, commit/spring-back logic, theme-driven mode |
| `src/pages/RoutePage.css` | Strip + slot classes, animating modifier |
| `src/styles/global.css` | Keep `slideInFromRight`/`slideInFromLeft` keyframes — used by snap mode |

---

## Testing

### `src/test/swipe.test.ts` (new — unit tests for the action)

- Direction lock: a `touchmove` more vertical than horizontal does not call `onDragMove` and does not call `preventDefault`
- Direction lock: a `touchmove` more horizontal than vertical calls `onDragMove(delta)` and calls `preventDefault`
- Lock commits on first qualifying move and does not change within the same touch

### `src/test/RoutePage.swipe.test.ts` (extended)

- `dragOffset` tracks `onDragMove` delta in carousel and peek modes
- `dragOffset` stays `0` in snap mode
- Releasing at `>= 30%` of card width advances `currentIndex`
- Releasing below `30%` does not advance `currentIndex`
- Dragging toward a missing neighbour produces `delta * 0.2` offset (elastic resistance)
- Changing theme mid-session applies the new mode immediately
