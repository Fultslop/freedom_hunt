<script lang="ts">
  import { BookOpen, MapPin, Crosshair, Compass } from "lucide-svelte";
  import { fetchImage, getCachedImageUrl } from "../assets/AssetManager";
  import { themeStore } from "../stores/themeStore";
  import { leafletMap } from "../actions/leafletMap";
  import MarkdownText from "./MarkdownText.svelte";
  import ChallengeForm from "./ChallengeForm.svelte";
  import type { Location } from "../types/data";
  import "./ChallengeCard.css";

  let {
    location,
    isLast = false,
    index = undefined,
    routeId = undefined,
  }: {
    // TODO: move this to a separate type file, don't inline
    location: Location;
    isLast?: boolean;
    index?: number;
    routeId?: string;
  } = $props();

  let heroSrc = $state<string | null>(null);
  let hasHero = $derived(!!heroSrc);
  let pos = $derived<[number, number]>([
    location.coordinates.latitude,
    location.coordinates.longitude,
  ]);

  // Sync cache hit: runs before DOM commit, so heroSrc is correct on first paint.
  $effect.pre(() => {
    heroSrc = location.image ? (getCachedImageUrl(location.image) ?? null) : null;
  });

  // Async fetch for cold (uncached) images only.
  $effect(() => {
    if (!location.image || getCachedImageUrl(location.image)) return undefined;
    let cancelled = false;
    fetchImage(location.image).then((url) => {
      if (!cancelled) heroSrc = url;
    });
    return () => { cancelled = true; };
  });
</script>

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
          <div
            class="cc-badge"
            style="background: {location.themeColor ??
              $themeStore.theme.accent}"
            data-testid="location-badge"
          >
            {index}
          </div>
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
        <div
          class="cc-badge"
          style="background: {location.themeColor ?? $themeStore.theme.accent}"
          data-testid="location-badge"
        >
          {index}
        </div>
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
    <MarkdownText text={location.storyline} />
  </div>

  <div class="cc-section">
    <div class="cc-section-label">
      <MapPin size={12} aria-hidden="true" />
      Location
    </div>
    <div
      use:leafletMap={{ center: pos, zoom: 16 }}
      style="height: 180px; border-radius: 6px; border: 1px solid var(--color-border);"
    ></div>
    <div class="cc-map-coords">
      {location.coordinates.latitude}° N, {location.coordinates.longitude}° E
    </div>

    <div class="cc-challenge-box">
      <div class="cc-section-label">
        <Crosshair size={12} aria-hidden="true" />
        Challenge
      </div>
      <MarkdownText text={location.challenge.description} />
    </div>

    {#if location.challenge.form && location.challenge.form.length > 0}
      <ChallengeForm
        form={location.challenge.form}
        locationId={location.locationId}
        {routeId}
      />
    {/if}
  </div>

  {#if !isLast}
    <div class="cc-section--no-border">
      <div class="cc-section-label">
        <Compass size={12} aria-hidden="true" />
        Your clue to your next destination
      </div>
      <p class="cc-breadcrumb">{location.breadcrumb}</p>
    </div>
  {/if}
</div>
