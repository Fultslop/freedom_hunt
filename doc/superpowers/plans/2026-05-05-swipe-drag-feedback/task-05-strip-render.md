# Task 5: RoutePage — static three-card strip

Status: Completed

**Previous:** [Task 4 — CSS](task-04-css.md)  
**Next:** [Task 6 — Drag state + commit/spring-back](task-06-drag-wiring.md)

**Files:**
- Modify: `src/pages/RoutePage.svelte`

---

Add the strip template for `peek` and `carousel` modes alongside the existing single-card template. No drag behaviour yet — cards are statically positioned at their resting positions (`dragOffset = 0`).

- [ ] **Step 1: Add new imports and derived state to the `<script>` block**

In `src/pages/RoutePage.svelte`, add these imports at the top of the `<script lang="ts">` block:

```typescript
import { swipe } from "../actions/swipe";
import { shouldCommitSwipe, elasticOffset } from "../utils/routeNav";
```

Add these derived values after the existing `let currentLocation = $derived(...)` line:

```typescript
let swipeMode = $derived($themeStore.theme.swipe.mode);
let hint = $derived(swipeMode === "snap" ? 0 : $themeStore.theme.swipe.hint);
let cardWidth = $derived(
  typeof window !== "undefined" ? window.innerWidth - 2 * hint : 375 - 2 * hint
);

let prevLocation = $derived(
  currentIndex > 0 ? locations[currentIndex - 1] : null
);
let nextLocation = $derived(
  currentIndex < locations.length - 1 ? locations[currentIndex + 1] : null
);

// Resting left positions for each slot (px from left edge of strip)
let prevLeft = $derived(hint - cardWidth);   // right edge at hint px
let currentLeft = $derived(hint);
let nextLeft = $derived(hint + cardWidth);   // left edge at 100vw - hint px
```

Also add the `themeStore` import if it is not already present:

```typescript
import { themeStore } from "../stores/themeStore";
```

- [ ] **Step 2: Add the strip template to the markup**

The existing markup has:

```svelte
{#if locations.length > 0 && currentLocation}
  <div
    class="route-page__cards"
    style={`animation: ${direction === "next" ? "slideInFromRight" : "slideInFromLeft"} 250ms ease-out`}
  >
    <ChallengeCard ... />
  </div>
{:else}
  <p class="route-page__loading">Loading…</p>
{/if}
```

Replace the entire `{#if locations.length > 0 && currentLocation}` block (leaving the loading paragraph alone) with:

```svelte
{#if locations.length > 0 && currentLocation}
  {#if swipeMode === "snap"}
    <div
      class="route-page__cards"
      style={`animation: ${direction === "next" ? "slideInFromRight" : "slideInFromLeft"} 250ms ease-out`}
    >
      <ChallengeCard
        location={currentLocation}
        isLast={currentIndex === locations.length - 1}
        index={currentIndex + 1}
        routeId={params.route}
      />
    </div>
  {:else}
    <div class="route-page__strip">
      <!-- Prev slot -->
      {#if prevLocation}
        <div
          class="route-page__slot"
          style="left: {prevLeft}px; width: {cardWidth}px; transform: translateX(0px)"
        >
          <ChallengeCard
            location={prevLocation}
            isLast={currentIndex - 1 === locations.length - 1}
            index={currentIndex}
            routeId={params.route}
          />
        </div>
      {:else}
        <div
          class="route-page__slot route-page__slot--empty"
          style="left: {prevLeft}px; width: {cardWidth}px"
        ></div>
      {/if}

      <!-- Current slot -->
      <div
        class="route-page__slot"
        style="left: {currentLeft}px; width: {cardWidth}px; transform: translateX(0px)"
      >
        <ChallengeCard
          location={currentLocation}
          isLast={currentIndex === locations.length - 1}
          index={currentIndex + 1}
          routeId={params.route}
        />
      </div>

      <!-- Next slot -->
      {#if nextLocation}
        <div
          class="route-page__slot"
          style="left: {nextLeft}px; width: {cardWidth}px; transform: translateX(0px)"
        >
          <ChallengeCard
            location={nextLocation}
            isLast={currentIndex + 1 === locations.length - 1}
            index={currentIndex + 2}
            routeId={params.route}
          />
        </div>
      {:else}
        <div
          class="route-page__slot route-page__slot--empty"
          style="left: {nextLeft}px; width: {cardWidth}px"
        ></div>
      {/if}
    </div>
  {/if}
{:else}
  <p class="route-page__loading">Loading…</p>
{/if}
```

- [ ] **Step 3: Verify typecheck and lint**

Run: `npm run lint`

Expected: 0 errors. The `app` and `GWC` themes should now show the three-card strip; `wireframe` shows the original single-card layout.

- [ ] **Step 4: Smoke-test in browser**

Run: `npm run dev` and open the app in a browser at `http://localhost:5173`.

Navigate to a route. Confirm:
- With `app` or `GWC` theme: the current card is inset from the edges (hint slivers visible on left and right).
- With `wireframe` theme: card fills full width as before.
- Cards render correctly — no blank slots, no layout breakage.

- [ ] **Step 5: Commit**

```
git add src/pages/RoutePage.svelte
git commit -m "feat: add static three-card strip render for peek/carousel modes"
```
