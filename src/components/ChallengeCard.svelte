<script lang="ts">
  import { BookOpen, MapPin, Crosshair, Compass, Check, Minus } from "lucide-svelte";
  import { fetchImage, getCachedImageUrl } from "../assets/AssetManager";
  import { themeStore } from "../stores/themeStore";
  import { leafletMap } from "../actions/leafletMap";
  import MarkdownText from "./MarkdownText.svelte";
  import Storyline from "./Storyline.svelte";
  import ChallengeForm from "./ChallengeForm.svelte";
  import type { Location } from "../types/data";
  import "./ChallengeCard.css";

  let {
    location,
    isLast = false,
    isFirst = false,
    index = undefined,
    routeId = undefined,
    cityId = undefined,
    project = "",
    storeFormsInLocalStorage = true,
    allowResubmit = true,
    badgeStatus = undefined,
    onFormStatusChange = undefined,
    onContinue = undefined,
    onPrev = undefined,
    isCurrent = true,
  }: {
    location: Location;
    isLast?: boolean;
    isFirst?: boolean;
    index?: number;
    routeId?: string;
    cityId?: string;
    project?: string;
    storeFormsInLocalStorage?: boolean;
    allowResubmit?: boolean;
    badgeStatus?: "submitted" | "skipped";
    onFormStatusChange?: (
      locationId: number,
      status: { submitted: boolean; missingLabels: string[] },
    ) => void;
    onContinue?: () => void;
    onPrev?: () => void;
    isCurrent?: boolean;
  } = $props();

  let heroSrc = $state<string | null>(null);
  let hasHero = $derived(!!heroSrc);
  let pos = $derived<[number, number] | null>(
    location.coordinates
      ? [location.coordinates.latitude, location.coordinates.longitude]
      : null,
  );

  // Sync cache hit: runs before DOM commit, so heroSrc is correct on first paint.
  $effect.pre(() => {
    heroSrc = location.image ? (getCachedImageUrl(location.image) ?? null) : null;
  });

  // Async fetch for cold (uncached) images only.
  $effect(() => {
    if (!location.image || getCachedImageUrl(location.image)) {
      return undefined;
    }
    let cancelled = false;
    fetchImage(location.image).then((url) => {
      if (!cancelled) {
        heroSrc = url;
      }
    });
    return () => { cancelled = true; };
  });
</script>

{#snippet badge()}
  <div
    class="cc-badge"
    style="background: {location.themeColor ?? $themeStore.theme.accent}"
    data-testid="location-badge"
  >
    {index}
    {#if badgeStatus === "submitted"}
      <span class="cc-badge-status cc-badge-status--submitted" data-testid="badge-status-submitted">
        <Check size={12} aria-hidden="true" />
      </span>
    {:else if badgeStatus === "skipped"}
      <span class="cc-badge-status cc-badge-status--skipped" data-testid="badge-status-skipped">
        <Minus size={12} aria-hidden="true" />
      </span>
    {/if}
  </div>
{/snippet}

<div class="cc-root">
  {#if hasHero}
    <div class="cc-hero-wrap">
      <img
        src={heroSrc!}
        alt={location.name?.value || location.title}
        class="cc-hero-img"
      />
      <div class="cc-hero-title-wrap">
        <div class="cc-title-card cc-title-card--shadow">
          {@render badge()}
          <div>
            <div class="cc-location-title">{location.title}</div>
            {#if location.name?.value}
              <div class="cc-location-name">{location.name.value}</div>
            {/if}
            {#if location.address}
              <div class="cc-location-address">{location.address}</div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div class="cc-no-hero-wrap">
      <div class="cc-title-card">
        {@render badge()}
        <div>
          <div class="cc-location-title">{location.title}</div>
          {#if location.name?.value}
            <div class="cc-location-name">{location.name.value}</div>
          {/if}
          {#if location.address}
            <div class="cc-location-address">{location.address}</div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <div class="cc-section">
    <div class="cc-section-label">
      <BookOpen size={12} aria-hidden="true" />
      Storyline
    </div>
    <Storyline text={location.storyline} elements={location.storylineElements} />
  </div>

  <div class="cc-section">
    {#if pos}
      <div class="cc-section-label">
        <MapPin size={12} aria-hidden="true" />
        Location
      </div>
      <div
        use:leafletMap={{ center: pos, zoom: 16 }}
        style="height: 180px; border-radius: 6px; border: 1px solid var(--color-border);"
      ></div>
      <div class="cc-map-coords">
        {location.coordinates?.latitude}° N, {location.coordinates?.longitude}° E
      </div>
    {/if}

    <div class="cc-challenge-box">
      <div class="cc-section-label">
        <Crosshair size={12} aria-hidden="true" />
        Challenge
      </div>
      <MarkdownText text={location.challenge.description} />
    </div>

    {#if location.challenge.form && location.challenge.form.length > 0}
      {#key `${project}/${cityId}/${routeId}/${index}`}
        <ChallengeForm
          form={location.challenge.form}
          locationId={index ?? -1}
          {routeId}
          {cityId}
          {project}
          storeInLocalStorage={storeFormsInLocalStorage}
          {allowResubmit}
          taskTitle={location.challenge.name}
          onFormStatusChange={(status) => onFormStatusChange?.(index ?? -1, status)}
        />
      {/key}
    {/if}
  </div>

  {#if !isLast && location.breadcrumb}
    <div class="cc-section--no-border">
      <div class="cc-section-label">
        <Compass size={12} aria-hidden="true" />
        Your clue to your next destination
      </div>
      <div class="cc-breadcrumb">
        <MarkdownText text={location.breadcrumb} />
      </div>
    </div>
  {/if}

  {#if isCurrent}
    <div class="cc-inline-nav">
      {#if !isFirst}
        <button
          type="button"
          class="cc-inline-nav__btn cc-inline-nav__btn--prev"
          aria-label="Previous stop"
          onclick={onPrev}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          Prev
        </button>
      {/if}
      {#if !isLast}
        <button
          type="button"
          class="cc-inline-nav__btn cc-inline-nav__btn--next"
          aria-label="Next stop"
          onclick={onContinue}
        >
          Next stop
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      {:else}
        <p class="cc-inline-nav__end">End of route</p>
      {/if}
    </div>
  {/if}
</div>
