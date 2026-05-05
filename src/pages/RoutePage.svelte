<script lang="ts" module>
  export { clampedNext, clampedPrev } from "../utils/routeNav";
</script>

<script lang="ts">
  import { push } from "svelte-spa-router";
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import { loadText } from "../utils/loadText";
  import { loadLocations } from "../utils/loadLocations";
  import { clampedNext, clampedPrev } from "../utils/routeNav";
  import ChallengeCard from "../components/ChallengeCard.svelte";
  import type { RoutesData, Location } from "../types/data";
  import "./RoutePage.css";

  let { params }: { params: { project: string; city: string; route: string } } = $props();

  let storageKey = $derived(`${params.project}/${params.city}/${params.route}`);
  let routesText = $state<RoutesData | null>(null);
  let routeData = $derived(routesText?.[params.route] ?? null);
  let locationPaths = $derived(
    routeData ? routeData.locations.map((id: string) => `projects/${params.project}/${params.city}/${id}`) : []
  );
  let locations = $state<Location[]>([]);

  const _savedIndex = localStorage.getItem(storageKey);
  const _parsedIndex = _savedIndex ? parseInt(_savedIndex, 10) : 0;
  let currentIndex = $state<number>(isNaN(_parsedIndex) ? 0 : _parsedIndex);
  let direction = $state<"next" | "prev">("next");
  let touchStartX = $state<number | null>(null);

  $effect(() => {
    const lang = $languageStore.currentLang;
    loadText<RoutesData>(lang, `projects/${params.project}/${params.city}/routes`).then((data) => {
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
      progress: locations.length > 0 ? { current: currentIndex + 1, total: locations.length } : null,
      backPath: `/${params.project}/${params.city}`,
    });
  });

  $effect(() => {
    localStorage.setItem(storageKey, String(currentIndex));
  });

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

  let currentLocation = $derived(locations[currentIndex]);
</script>

<div
  class="route-page"
  role="region"
  aria-label="Hunt route"
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
>
  {#if locations.length > 0 && currentLocation}
    <div class="route-page__cards" style={`animation: ${direction === "next" ? "slideInFromRight" : "slideInFromLeft"} 250ms ease-out`}>
      <ChallengeCard
        location={currentLocation}
        isLast={currentIndex === locations.length - 1}
        index={currentIndex + 1}
        routeId={params.route}
      />
    </div>
  {:else}
    <p class="route-page__loading">Loading…</p>
  {/if}

  <div class="route-page__nav">
    <div class="route-page__nav-slot">
      {#if currentIndex > 0}
        <button
          aria-label="Previous stop"
          onclick={() => { direction = "prev"; currentIndex = clampedPrev(currentIndex); }}
          class="route-page__prev-btn"
        >
          <!-- ChevronLeft -->
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Prev
        </button>
      {/if}
    </div>

    <button onclick={() => push(`/${params.project}/${params.city}`)} class="route-page__exit-btn">
      Exit
    </button>

    <div class="route-page__nav-slot--right">
      {#if currentIndex < locations.length - 1}
        <button
          aria-label="Next stop"
          onclick={() => { direction = "next"; currentIndex = clampedNext(currentIndex, locations.length); }}
          class="route-page__next-btn"
        >
          Next
          <!-- ChevronRight -->
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      {/if}
    </div>
  </div>
</div>