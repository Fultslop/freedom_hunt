<script lang="ts">
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import { themeStore } from "../stores/themeStore";
  import { loadText } from "../utils/loadText";
  import { loadLocations } from "../utils/loadLocations";
  import {
    shouldCommitSwipe,
    elasticOffset,
  } from "../utils/routeNav";
  import { getHuntSettings } from "../utils/huntSettings";
  import { readConsentCache } from "../utils/consentCache";
  import { fetchConsentVersion } from "../utils/api";
  import { buildFormStorageKey, loadFormState, saveFormState } from "../utils/formStorage";
  import { isLocationEntry, locationTotal, locationOrdinalAt, locationIdAt, isNavBarVisible } from "../utils/routeEntries";
  import {
    nextNavigableIndex,
    prevNavigableIndex,
    earliestAllowedIndex,
    checkpointsBetween,
    isCheckpointEntry,
  } from "../utils/checkpointNav";
  import { evaluateGate } from "../utils/routeRequirements";
  import { computePhotosTaken, computeElapsedSinceFirstSubmission, formatElapsed } from "../utils/completionStats";
  import CheckpointGateModal from "../components/CheckpointGateModal.svelte";
  import { swipe } from "../actions/swipe";
  import { preloadImages } from "../assets/AssetManager";
  import RouteScreen from "../components/RouteScreen.svelte";
  import Toast from "../components/Toast.svelte";
  import type { RoutesData, RouteEntry, ConsentBulletSection } from "../types/data";
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

  let consentDefaults = $state<{ safety?: ConsentBulletSection; photos?: ConsentBulletSection } | null>(null);
  $effect(() => {
    const lang = $languageStore.currentLang;
    loadText<{ safety?: ConsentBulletSection; photos?: ConsentBulletSection }>(lang, "consent_defaults").then((data) => {
      consentDefaults = data;
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
    if (currentEntry?.["template-type"] === "completion") {
      titleBarStore.set({
        title: params.route.replace(/_/g, " "),
        progress: { current: stopsCompleted, total: stopsTotal, animateMs: 900 },
        backPath: `/${params.project}/${params.city}`,
      });
      const timer = setTimeout(() => {
        titleBarStore.update((state) => ({
          ...state,
          progress: state.progress ? { ...state.progress, current: stopsTotal } : state.progress,
        }));
      }, 500);
      return () => clearTimeout(timer);
    }
    titleBarStore.set({
      title: params.route.replace(/_/g, " "),
      progress:
        stopsTotal > 0
          ? { current: locationOrdinalAt(entries, currentIndex), total: stopsTotal }
          : null,
      backPath: `/${params.project}/${params.city}`,
    });
    return undefined;
  });

  $effect(() => {
    localStorage.setItem(storageKey, String(currentIndex));
  });

  let mountNormalizeAttempted = $state(false);

  $effect(() => {
    if (!mountNormalizeAttempted && entries.length > 0) {
      mountNormalizeAttempted = true;
      if (isCheckpointEntry(entries[currentIndex])) {
        attemptAdvance(currentIndex - 1);
      }
    }
  });

  $effect(() => {
    // Re-runs on every currentIndex change — deliberately, not just at mount,
    // so a consentVersion bump interrupts an already-open tab mid-route, not
    // only at route start. See spec §12 for why this needs a network check at
    // all (this app has no live CMS; an open tab can't learn a version bump on
    // its own) and why a failed check must fail open (§13).
    currentIndex;
    if (consentEntryIndex !== -1) {
      const cached = readConsentCache(params.project, params.city, params.route);
      if (cached) {
        fetchConsentVersion(params.project, params.city, params.route)
          .then((res) => {
            if (res.ok && res.consentVersion !== undefined && res.consentVersion !== cached.consentVersion) {
              currentIndex = consentEntryIndex;
            }
          })
          .catch(() => {
            // Fail open — a network blip must not force a spurious redirect.
          });
      }
    }
  });

  $effect(() => {
    if (entries.length > 0) {
      const images = entries.flatMap((entry) => {
        if (entry["template-type"] === "checkpoint") { return []; }
        const img = (entry as { image?: string }).image;
        return img ? [img] : [];
      });
      preloadImages(images);
    }
  });

  function handleDragMove(delta: number) {
    if (!isAnimating) {
      if (swipeMode !== "snap") {
        const atStart = currentIndex === earliestAllowed;
        const atEnd = !canGoForward;

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
            attemptAdvance();
          } else {
            triggerBlockedToast();
          }
        } else if (delta > 60) {
          if (currentIndex > earliestAllowed) {
            direction = "prev";
            currentIndex = prevNavigableIndex(entries, currentIndex);
          }
        }
        dragOffset = 0;
      } else {
        const atStart = currentIndex === earliestAllowed;
        const atEnd = !canGoForward;
        const goingNext = delta < 0;
        const goingPrev = delta > 0;

        if (goingNext && !atEnd && shouldCommitSwipe(delta, cardWidth)) {
          if (canAdvance) {
            attemptAdvance();
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
              armAnimationFallback("blocked-spring-back");
              dragOffset = 0;
            }
          }
        } else if (goingPrev && !atStart && shouldCommitSwipe(delta, cardWidth)) {
          pendingCommit = "prev";
          isAnimating = true;
          armAnimationFallback("prev-commit");
          dragOffset = cardWidth;
        } else {
          // spring back
          isAnimating = true;
          armAnimationFallback("spring-back");
          dragOffset = 0;
        }
      }
    }
  }

  // Every path above that sets isAnimating = true depends on the browser firing
  // a real `transitionend` (handleTransitionEnd) to reset it — that's the only
  // place isAnimating/pendingCommit/dragOffset get cleared. If that event is
  // ever skipped (dropped compositor frame, backgrounded tab, an extension
  // that strips/short-circuits CSS transitions), isAnimating stays stuck true
  // forever and every future click (Next, Prev, swipe) silently no-ops with no
  // error — this is what a Den Haag participant hit on 28/07/2026: Next
  // stopped responding on her laptop with only an unrelated browser-extension
  // console error, and we couldn't reproduce it locally. This timer is a
  // defense-in-depth fallback so a missed transitionend can no longer wedge
  // navigation permanently; the console.warn gives us a trail if it fires
  // again in the wild.
  const ANIMATION_FALLBACK_MS = 400; // CSS transition is 250ms; padding for slow devices
  let animationFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  function armAnimationFallback(source: string) {
    if (animationFallbackTimer !== null) {
      clearTimeout(animationFallbackTimer);
    }
    animationFallbackTimer = setTimeout(() => {
      console.warn(
        "[RoutePage] transitionend never fired — recovering via fallback timer",
        {
          source,
          pendingCommit,
          pendingTarget,
          dragOffset,
          currentIndex,
          swipeMode,
          route: `${params.project}/${params.city}/${params.route}`,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        },
      );
      resolveAnimation();
    }, ANIMATION_FALLBACK_MS);
  }

  function resolveAnimation() {
    if (animationFallbackTimer !== null) {
      clearTimeout(animationFallbackTimer);
      animationFallbackTimer = null;
    }
    isAnimating = false;
    if (pendingCommit === "next" && pendingTarget !== null) {
      direction = "next";
      currentIndex = pendingTarget;
      currentSlotIndex = (currentSlotIndex + 1) % 3;
    } else if (pendingCommit === "prev") {
      direction = "prev";
      currentIndex = prevNavigableIndex(entries, currentIndex);
      currentSlotIndex = (currentSlotIndex + 2) % 3;
    }
    pendingCommit = null;
    pendingTarget = null;
    dragOffset = 0;
  }

  function handleTransitionEnd(e: TransitionEvent) {
    if (e.propertyName === "transform") {
      resolveAnimation();
    }
  }

  let currentEntry = $derived(entries[currentIndex]);
  // Hiding the nav bar also disables swipe on this screen — nav-bar.visible: false
  // means the entry's own content controls navigation, not the generic route
  // chrome, so a tracked action (e.g. an EULA's "I understand") can't be bypassed
  // by swiping past it.
  let consentEntryIndex = $derived(entries.findIndex((e) => e["template-type"] === "consent"));
  let navBarVisible = $derived(currentEntry === undefined || isNavBarVisible(currentEntry));
  let earliestAllowed = $derived(entries.length > 0 ? earliestAllowedIndex(entries, currentIndex) : currentIndex);
  let canGoForward = $derived(entries.length > 0 ? nextNavigableIndex(entries, currentIndex) !== currentIndex : false);

  let formStatusByIndex = $state<Record<string, { submitted: boolean; missingLabels: string[] }>>({});
  let skippedIndices = $state<Set<string>>(new Set());
  let showToast = $state(false);
  let toastMissingLabels = $state<string[]>([]);
  let gateModal = $state<{ mode: "fail" | "succeed"; message: string; skippable: boolean; target: number } | null>(null);
  let pendingTarget = $state<number | null>(null);

  $effect(() => {
    if (entries.length > 0 && huntSettings.storeFormsInLocalStorage) {
      const restoredStatus: Record<string, { submitted: boolean; missingLabels: string[] }> = {};
      const restoredSkipped = new Set<string>();
      entries.forEach((_entry, i) => {
        const locId = locationIdAt(routeData?.locations ?? [], i);
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
    locationId: string,
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

  function computeBadgeStatus(locationKey: string, hasForm: boolean): "submitted" | "skipped" | undefined {
    if (!hasForm) {
      return undefined;
    }
    if (formStatusByIndex[locationKey]?.submitted) {
      return "submitted";
    }
    if (skippedIndices.has(locationKey)) {
      return "skipped";
    }
    return undefined;
  }

  let currentDisplayIndex = $derived(locationOrdinalAt(entries, currentIndex));
  let currentLocationKey = $derived(locationIdAt(routeData?.locations ?? [], currentIndex));
  let currentHasForm = $derived(
    currentEntry !== undefined &&
      isLocationEntry(currentEntry) &&
      (currentEntry.challenge.form?.length ?? 0) > 0,
  );
  let currentFormStatus = $derived(
    formStatusByIndex[currentLocationKey] ?? { submitted: false, missingLabels: [] },
  );
  let currentSkipped = $derived(skippedIndices.has(currentLocationKey));
  let canAdvance = $derived(
    !huntSettings.formRequired ||
      !currentHasForm ||
      currentFormStatus.submitted ||
      currentSkipped,
  );

  let stopsTotal = $derived(locationTotal(entries));
  let stopsCompleted = $derived(
    entries.reduce((count, entry, i) => {
      if (!isLocationEntry(entry)) {
        return count;
      }
      const locId = locationIdAt(routeData?.locations ?? [], i);
      const hasForm = (entry.challenge.form?.length ?? 0) > 0;
      const resolved =
        !hasForm || formStatusByIndex[locId]?.submitted === true || skippedIndices.has(locId);
      return resolved ? count + 1 : count;
    }, 0),
  );
  let photosCount = $derived(
    huntSettings.storeFormsInLocalStorage
      ? computePhotosTaken(params.project, params.city, params.route, routeData?.locations ?? [])
      : ("—" as const),
  );
  let timeOnFoot = $derived.by(() => {
    if (!huntSettings.storeFormsInLocalStorage) {
      return "—";
    }
    const elapsed = computeElapsedSinceFirstSubmission(
      params.project,
      params.city,
      params.route,
      routeData?.locations ?? [],
      Date.now(),
    );
    return elapsed === undefined ? "—" : formatElapsed(elapsed);
  });
  let completionStats = $derived({ stopsCompleted, stopsTotal, photosCount, timeOnFoot });

  function triggerBlockedToast() {
    toastMissingLabels = currentFormStatus.missingLabels;
    showToast = true;
  }

  function handleSkip() {
    const locId = currentLocationKey;
    skippedIndices = new Set(skippedIndices).add(locId);
    if (huntSettings.storeFormsInLocalStorage) {
      const key = buildFormStorageKey(params.project, params.city, params.route, locId);
      saveFormState(key, { ...loadFormState(key), skipped: true });
    }
    showToast = false;
    attemptAdvance();
  }

  function commitAdvance(target: number) {
    if (swipeMode === "snap") {
      direction = "next";
      currentIndex = target;
      dragOffset = 0;
    } else {
      pendingCommit = "next";
      pendingTarget = target;
      isAnimating = true;
      armAnimationFallback("commit-advance");
      dragOffset = -cardWidth;
    }
  }

  function springBackIfDragging() {
    if (swipeMode !== "snap" && dragOffset !== 0) {
      isAnimating = true;
      armAnimationFallback("gate-spring-back");
      dragOffset = 0;
    }
  }

  function attemptAdvance(from: number = currentIndex) {
    const target = nextNavigableIndex(entries, from);
    if (target === from) {
      /* nothing to advance to — no-op */
    } else {
      const crossed = checkpointsBetween(entries, from, target);
      if (crossed.length === 0) {
        commitAdvance(target);
      } else {
        let blocked = false;
        for (const { index, checkpoint } of crossed) {
          const result = evaluateGate(checkpoint.entry?.requirements, {
            entries,
            beforeIndex: index,
            formStatusByIndex,
            skippedIndices,
            routeLocations: routeData?.locations ?? [],
          });
          if (!result.met) {
            gateModal = {
              mode: "fail",
              message: result.message ?? "",
              skippable: checkpoint.entry?.skippable ?? true,
              target,
            };
            springBackIfDragging();
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          const onSucceed = crossed
            .map(({ checkpoint }) => checkpoint.entry?.on_succeed)
            .find((maybeMsg) => maybeMsg !== undefined);
          if (onSucceed) {
            gateModal = { mode: "succeed", message: onSucceed.message, skippable: false, target };
            springBackIfDragging();
          } else {
            commitAdvance(target);
          }
        }
      }
    }
  }

  function resolveGateStay() {
    gateModal = null;
  }

  function resolveGateProceed() {
    const target = gateModal?.target;
    gateModal = null;
    if (target !== undefined) {
      commitAdvance(target);
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

  $effect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (!(target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
        if (e.key === "ArrowLeft" && currentIndex > earliestAllowed) {
          handleDragEnd(cardWidth);
        } else if (e.key === "ArrowRight" && canGoForward) {
          handleDragEnd(-cardWidth);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
</script>

<div
  class="route-page"
  role="region"
  aria-label="Hunt route"
  use:swipe={{
    onDragMove: (delta) => { if (navBarVisible) { handleDragMove(delta); } },
    onDragEnd: (delta) => { if (navBarVisible) { handleDragEnd(delta); } },
  }}
>
  {#if entries.length > 0 && currentEntry}
    {#if swipeMode === "snap"}
      <div
        class="route-page__cards"
        style={`animation: ${direction === "next" ? "slideInFromRight" : "slideInFromLeft"} 250ms ease-out`}
      >
        <RouteScreen
          entry={currentEntry}
          isLast={!canGoForward}
          isFirst={currentIndex <= earliestAllowed}
          index={currentDisplayIndex}
          locationKey={currentLocationKey}
          routeId={params.route}
          cityId={params.city}
          project={params.project}
          storeFormsInLocalStorage={huntSettings.storeFormsInLocalStorage}
          allowResubmit={huntSettings.allowResubmit}
          safetyDefault={consentDefaults?.safety}
          photosDefault={consentDefaults?.photos}
          onFormStatusChange={handleFormStatusChange}
          badgeStatus={computeBadgeStatus(currentLocationKey, currentHasForm)}
          onContinue={() => handleDragEnd(-cardWidth)}
          onPrev={() => handleDragEnd(cardWidth)}
          isCurrent={true}
          stats={completionStats}
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
                isLast={nextNavigableIndex(entries, locIdx) === locIdx}
                isFirst={locIdx <= earliestAllowedIndex(entries, locIdx)}
                index={locationOrdinalAt(entries, locIdx)}
                locationKey={locationIdAt(routeData?.locations ?? [], locIdx)}
                routeId={params.route}
                cityId={params.city}
                project={params.project}
                storeFormsInLocalStorage={huntSettings.storeFormsInLocalStorage}
                allowResubmit={huntSettings.allowResubmit}
                safetyDefault={consentDefaults?.safety}
                photosDefault={consentDefaults?.photos}
                onFormStatusChange={handleFormStatusChange}
                badgeStatus={computeBadgeStatus(locationIdAt(routeData?.locations ?? [], locIdx), isLocationEntry(slotEntry) && (slotEntry.challenge.form?.length ?? 0) > 0)}
                onContinue={() => handleDragEnd(-cardWidth)}
                onPrev={() => handleDragEnd(cardWidth)}
                isCurrent={role === 0}
                stats={role === 0 ? completionStats : undefined}
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

  {#if navBarVisible}
    <button
      aria-label="Previous"
      class="route-page__gutter-arrow route-page__gutter-arrow--prev"
      class:route-page__gutter-arrow--hidden={currentIndex <= earliestAllowed}
      onclick={() => handleDragEnd(cardWidth)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
    </button>
    <button
      aria-label="Next"
      class="route-page__gutter-arrow route-page__gutter-arrow--next"
      class:route-page__gutter-arrow--hidden={!canGoForward}
      onclick={() => handleDragEnd(-cardWidth)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
    </button>
  {/if}

  {#if gateModal}
    <CheckpointGateModal
      mode={gateModal.mode}
      message={gateModal.message}
      skippable={gateModal.skippable}
      onStay={resolveGateStay}
      onProceed={resolveGateProceed}
    />
  {/if}

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
