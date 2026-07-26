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
  import { getHuntSettings } from "../utils/huntSettings";
  import { buildFormStorageKey, loadFormState, saveFormState } from "../utils/formStorage";
  import { isLocationEntry, locationTotal, locationOrdinalAt } from "../utils/routeEntries";
  import { recordEffectFired, type EffectHistory } from "../utils/splashEffectHistory";
  import { swipe } from "../actions/swipe";
  import { preloadImages } from "../assets/AssetManager";
  import RouteScreen from "../components/RouteScreen.svelte";
  import Toast from "../components/Toast.svelte";
  import type { RoutesData, RouteEntry } from "../types/data";
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
  let entries = $state<RouteEntry[]>([]);

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

  let huntSettings = $state(getHuntSettings(null));
  $effect(() => {
    const lang = $languageStore.currentLang;
    loadText<Record<string, unknown>>(
      lang,
      `projects/${params.project}/${params.project}`,
    ).then((data) => {
      huntSettings = getHuntSettings(data);
    });
  });

  $effect(() => {
    const lang = $languageStore.currentLang;
    if (locationPaths.length > 0) {
      loadLocations(lang, locationPaths).then((locs) => {
        entries = locs;
      });
    }
  });

  $effect(() => {
    titleBarStore.set({
      title: params.route.replace(/_/g, " "),
      progress:
        locationTotal(entries) > 0
          ? { current: locationOrdinalAt(entries, currentIndex), total: locationTotal(entries) }
          : null,
      backPath: `/${params.project}/${params.city}`,
    });
  });

  $effect(() => {
    localStorage.setItem(storageKey, String(currentIndex));
  });

  $effect(() => {
    if (entries.length > 0) {
      const images = entries.flatMap((entry) => (entry.image ? [entry.image] : []));
      preloadImages(images);
    }
  });

  function handleDragMove(delta: number) {
    if (!isAnimating) {
      if (swipeMode !== "snap") {
        const atStart = currentIndex === 0;
        const atEnd = currentIndex === entries.length - 1;

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
          if (canAdvance) {
            direction = "next";
            currentIndex = clampedNext(currentIndex, entries.length);
          } else {
            triggerBlockedToast();
          }
        } else if (delta > 60) {
          direction = "prev";
          currentIndex = clampedPrev(currentIndex);
        }
        dragOffset = 0;
      } else {
        const atStart = currentIndex === 0;
        const atEnd = currentIndex === entries.length - 1;
        const goingNext = delta < 0;
        const goingPrev = delta > 0;

        if (goingNext && !atEnd && shouldCommitSwipe(delta, cardWidth)) {
          if (canAdvance) {
            pendingCommit = "next";
            isAnimating = true;
            dragOffset = -cardWidth;
          } else {
            triggerBlockedToast();
            // Only animate a spring-back if there's actually an offset to spring
            // back from (a real drag). A Next-button click never set dragOffset,
            // so it's already 0 here — setting it to 0 again produces no CSS
            // transform change, `transitionend` never fires, and isAnimating
            // would stay stuck true forever, silently no-op'ing every future
            // handleDragEnd call (including the next click).
            if (dragOffset !== 0) {
              isAnimating = true;
              dragOffset = 0;
            }
          }
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
    if (e.propertyName === "transform") {
      isAnimating = false;
      if (pendingCommit === "next") {
        direction = "next";
        currentIndex = clampedNext(currentIndex, entries.length);
        currentSlotIndex = (currentSlotIndex + 1) % 3;
      } else if (pendingCommit === "prev") {
        direction = "prev";
        currentIndex = clampedPrev(currentIndex);
        currentSlotIndex = (currentSlotIndex + 2) % 3;
      }
      pendingCommit = null;
      dragOffset = 0;
    }
  }

  let currentEntry = $derived(entries[currentIndex]);

  let formStatusByIndex = $state<Record<number, { submitted: boolean; missingLabels: string[] }>>({});
  let skippedIndices = $state<Set<number>>(new Set());
  let showToast = $state(false);
  let toastMissingLabels = $state<string[]>([]);
  let splashEffectHistory = $state<EffectHistory>({});

  $effect(() => {
    if (entries.length > 0 && huntSettings.storeFormsInLocalStorage) {
      const restoredStatus: Record<number, { submitted: boolean; missingLabels: string[] }> = {};
      const restoredSkipped = new Set<number>();
      entries.forEach((_entry, i) => {
        const locId = i + 1;
        const state = loadFormState(
          buildFormStorageKey(params.project, params.city, params.route, locId),
        );
        if (state.submitted) {
          restoredStatus[locId] = { submitted: true, missingLabels: [] };
        }
        if (state.skipped) {
          restoredSkipped.add(locId);
        }
      });
      untrack(() => {
        formStatusByIndex = { ...restoredStatus, ...formStatusByIndex };
        skippedIndices = new Set([...restoredSkipped, ...skippedIndices]);
      });
    }
  });

  function handleFormStatusChange(
    locationId: number,
    status: { submitted: boolean; missingLabels: string[] },
  ) {
    // This is invoked synchronously from deep inside AppForm's own $effect (via
    // ChallengeForm -> ChallengeCard -> RouteScreen -> here), so a plain
    // `{...formStatusByIndex}` read here gets attributed as a dependency of THAT
    // effect, and the write right after looks like the same effect writing its
    // own dependency — Svelte's infinite-loop guard (effect_update_depth_exceeded)
    // trips on exactly this shape. untrack() keeps the read from being
    // attributed to whichever effect is currently running up the call stack.
    const current = untrack(() => formStatusByIndex);
    formStatusByIndex = { ...current, [locationId]: status };
  }

  function handleSplashEffectPlayed(index: number) {
    // Same untrack() reasoning as handleFormStatusChange above — this fires
    // synchronously from SplashScreen's own $effect.
    const current = untrack(() => splashEffectHistory);
    splashEffectHistory = recordEffectFired(current, index, Date.now());
  }

  function computeBadgeStatus(locationId: number, hasForm: boolean): "submitted" | "skipped" | undefined {
    if (!hasForm) {
      return undefined;
    }
    if (formStatusByIndex[locationId]?.submitted) {
      return "submitted";
    }
    if (skippedIndices.has(locationId)) {
      return "skipped";
    }
    return undefined;
  }

  let currentLocationId = $derived(currentIndex + 1);
  let currentHasForm = $derived(
    currentEntry !== undefined &&
      isLocationEntry(currentEntry) &&
      (currentEntry.challenge.form?.length ?? 0) > 0,
  );
  let currentFormStatus = $derived(
    formStatusByIndex[currentLocationId] ?? { submitted: false, missingLabels: [] },
  );
  let currentSkipped = $derived(skippedIndices.has(currentLocationId));
  let canAdvance = $derived(
    !huntSettings.formRequired ||
      !currentHasForm ||
      currentFormStatus.submitted ||
      currentSkipped,
  );

  function triggerBlockedToast() {
    toastMissingLabels = currentFormStatus.missingLabels;
    showToast = true;
  }

  function handleSkip() {
    const locId = currentLocationId;
    skippedIndices = new Set(skippedIndices).add(locId);
    if (huntSettings.storeFormsInLocalStorage) {
      const key = buildFormStorageKey(params.project, params.city, params.route, locId);
      saveFormState(key, { ...loadFormState(key), skipped: true });
    }
    showToast = false;
    if (swipeMode === "snap") {
      direction = "next";
      currentIndex = clampedNext(currentIndex, entries.length);
    } else {
      pendingCommit = "next";
      isAnimating = true;
      dragOffset = -cardWidth;
    }
  }

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
  {#if entries.length > 0 && currentEntry}
    {#if swipeMode === "snap"}
      <div
        class="route-page__cards"
        style={`animation: ${direction === "next" ? "slideInFromRight" : "slideInFromLeft"} 250ms ease-out`}
      >
        <RouteScreen
          entry={currentEntry}
          isLast={currentIndex === entries.length - 1}
          index={currentIndex + 1}
          routeId={params.route}
          cityId={params.city}
          project={params.project}
          storeFormsInLocalStorage={huntSettings.storeFormsInLocalStorage}
          allowResubmit={huntSettings.allowResubmit}
          onFormStatusChange={handleFormStatusChange}
          badgeStatus={computeBadgeStatus(currentIndex + 1, currentHasForm)}
          {splashEffectHistory}
          onSplashEffectPlayed={handleSplashEffectPlayed}
        />
      </div>
    {:else}
      <div class="route-page__strip">
        {#each [0, 1, 2] as slotIdx (slotIdx)}
          {@const roleRaw = (slotIdx - currentSlotIndex + 3) % 3}
          {@const role = roleRaw === 2 ? -1 : roleRaw}
          {@const locIdx = currentIndex + role}
          {@const slotEntry = locIdx >= 0 && locIdx < entries.length ? entries[locIdx] : null}
          {@const translateX = hint + role * cardWidth + dragOffset}
          {#if slotEntry}
            <div
              class="route-page__slot"
              class:route-page__slot--animating={isAnimating}
              style="width: {cardWidth}px; transform: translateX({translateX}px)"
              ontransitionend={role === 0 ? handleTransitionEnd : undefined}
            >
              <RouteScreen
                entry={slotEntry}
                isLast={locIdx === entries.length - 1}
                index={locIdx + 1}
                routeId={params.route}
                cityId={params.city}
                project={params.project}
                storeFormsInLocalStorage={huntSettings.storeFormsInLocalStorage}
                allowResubmit={huntSettings.allowResubmit}
                onFormStatusChange={handleFormStatusChange}
                badgeStatus={computeBadgeStatus(locIdx + 1, isLocationEntry(slotEntry) && (slotEntry.challenge.form?.length ?? 0) > 0)}
                {splashEffectHistory}
                onSplashEffectPlayed={handleSplashEffectPlayed}
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
      {#if currentIndex < entries.length - 1}
        <button
          aria-label="Next stop"
          onclick={() => handleDragEnd(-cardWidth)}
          class="route-page__next-btn"
          class:route-page__next-btn--pending={!canAdvance}
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

  {#if showToast}
    <Toast
      message={toastMissingLabels.length > 0
        ? `Please complete: ${toastMissingLabels.join(", ")}`
        : "Please submit the form to continue."}
      onDismiss={() => (showToast = false)}
      skipLabel={huntSettings.canFormsSkip ? "Skip" : undefined}
      onSkip={huntSettings.canFormsSkip ? handleSkip : undefined}
    />
  {/if}
</div>
