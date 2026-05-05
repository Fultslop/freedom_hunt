<script lang="ts" module>
  export { clampedNext, clampedPrev } from "../utils/routeNav";
</script>

<script lang="ts">
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import { themeStore } from "../stores/themeStore";
  import { loadText } from "../utils/loadText";
  import { loadLocations } from "../utils/loadLocations";
  import {
    clampedNext,
    clampedPrev,
    shouldCommitSwipe,
    elasticOffset,
  } from "../utils/routeNav";
  import { swipe } from "../actions/swipe";
  import { preloadImages } from "../assets/AssetManager";
  import ChallengeCard from "../components/ChallengeCard.svelte";
  import type { RoutesData, Location } from "../types/data";
  import { untrack } from "svelte";
  import "./RoutePage.css";

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
  let locations = $state<Location[]>([]);

  // use localStorage to remember the last visited location index for this route
  // we use untrack to avoid svelte warnings
  const _savedIndex = localStorage.getItem(untrack(() => storageKey));
  const _parsedIndex = _savedIndex ? parseInt(_savedIndex, 10) : 0;
  let currentIndex = $state<number>(isNaN(_parsedIndex) ? 0 : _parsedIndex);
  let direction = $state<"next" | "prev">("next");

  let dragOffset = $state(0);
  let isAnimating = $state(false);
  let pendingCommit = $state<"next" | "prev" | null>(null);
  let currentSlotIndex = $state(1); // which of the 3 divs is the "current" slot

  $effect(() => {
    const lang = $languageStore.currentLang;
    loadText<RoutesData>(
      lang,
      `projects/${params.project}/${params.city}/routes`,
    ).then((data) => {
      routesText = data;
    });
  });

  $effect(() => {
    const lang = $languageStore.currentLang;
    if (locationPaths.length > 0) {
      loadLocations(lang, locationPaths).then((locs) => {
        locations = locs;
      });
    }
  });

  $effect(() => {
    titleBarStore.set({
      title: params.route.replace(/_/g, " "),
      progress:
        locations.length > 0
          ? { current: currentIndex + 1, total: locations.length }
          : null,
      backPath: `/${params.project}/${params.city}`,
    });
  });

  $effect(() => {
    localStorage.setItem(storageKey, String(currentIndex));
  });

  $effect(() => {
    if (locations.length === 0) return;
    const images = locations.flatMap((l) => (l.image ? [l.image] : []));
    preloadImages(images);
  });

  function handleDragMove(delta: number) {
    if (!isAnimating) {
      if (swipeMode !== "snap") {
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
    }
  }

  function handleDragEnd(delta: number) {
    if (!isAnimating) {
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
      } else {
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
    }
  }

  function handleTransitionEnd(e: TransitionEvent) {
    if (e.propertyName !== "transform") return;
    isAnimating = false;
    if (pendingCommit === "next") {
      direction = "next";
      currentIndex = clampedNext(currentIndex, locations.length);
      currentSlotIndex = (currentSlotIndex + 1) % 3;
    } else if (pendingCommit === "prev") {
      direction = "prev";
      currentIndex = clampedPrev(currentIndex);
      currentSlotIndex = (currentSlotIndex + 2) % 3;
    }
    pendingCommit = null;
    dragOffset = 0;
  }

  let currentLocation = $derived(locations[currentIndex]);

  let swipeMode = $derived($themeStore.theme.swipe.mode);
  let hint = $derived(swipeMode === "snap" ? 0 : $themeStore.theme.swipe.hint);

  let windowWidth = $state(window.innerWidth);
  $effect(() => {
    function onResize() { windowWidth = window.innerWidth; }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });
  let cardWidth = $derived(windowWidth - 2 * hint);

</script>

<div
  class="route-page"
  role="region"
  aria-label="Hunt route"
  use:swipe={{ onDragMove: handleDragMove, onDragEnd: handleDragEnd }}
>
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
        {#each [0, 1, 2] as slotIdx (slotIdx)}
          {@const roleRaw = (slotIdx - currentSlotIndex + 3) % 3}
          {@const role = roleRaw === 2 ? -1 : roleRaw}
          {@const locIdx = currentIndex + role}
          {@const slotLocation = locIdx >= 0 && locIdx < locations.length ? locations[locIdx] : null}
          {@const translateX = hint + role * cardWidth + dragOffset}
          {#if slotLocation}
            <div
              class="route-page__slot"
              class:route-page__slot--animating={isAnimating}
              style="width: {cardWidth}px; transform: translateX({translateX}px)"
              ontransitionend={role === 0 ? handleTransitionEnd : undefined}
            >
              <ChallengeCard
                location={slotLocation}
                isLast={locIdx === locations.length - 1}
                index={locIdx + 1}
                routeId={params.route}
              />
            </div>
          {:else}
            <div
              class="route-page__slot route-page__slot--empty"
              style="width: {cardWidth}px; transform: translateX({hint + role * cardWidth}px)"
            ></div>
          {/if}
        {/each}
      </div>
    {/if}
  {:else}
    <p class="route-page__loading">Loading…</p>
  {/if}

  <div class="route-page__nav">
    <div class="route-page__nav-slot">
      {#if currentIndex > 0}
        <button
          aria-label="Previous stop"
          onclick={() => handleDragEnd(cardWidth)}
          class="route-page__prev-btn"
        >
          <!-- ChevronLeft -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg
          >
          Prev
        </button>
      {/if}
    </div>

    <button
      onclick={() => push(`/${params.project}/${params.city}`)}
      class="route-page__exit-btn"
    >
      Exit
    </button>

    <div class="route-page__nav-slot--right">
      {#if currentIndex < locations.length - 1}
        <button
          aria-label="Next stop"
          onclick={() => handleDragEnd(-cardWidth)}
          class="route-page__next-btn"
        >
          Next
          <!-- ChevronRight -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg
          >
        </button>
      {/if}
    </div>
  </div>
</div>
