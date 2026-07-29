<script lang="ts">
  import { push } from "svelte-spa-router";
  import { Check, Sparkles } from "lucide-svelte";
  import { fetchImage, getCachedImageUrl } from "../assets/AssetManager";
  import { themeStore } from "../stores/themeStore";
  import MarkdownText from "./MarkdownText.svelte";
  import StoryStats from "./StoryStats.svelte";
  import ConfettiEffect from "./effects/ConfettiEffect.svelte";
  import type { StoryBlock } from "../types/storyline";
  import type { CompletionStats } from "../types/data";
  import "./CompletionScreen.css";

  let {
    image,
    title,
    subtitle,
    place,
    caption = undefined,
    closingText = undefined,
    registration,
    hint = undefined,
    stats,
    project,
    cityId,
    isCurrent = true,
  }: {
    image: string;
    title: string;
    subtitle: string;
    place: string;
    caption?: string;
    closingText?: string;
    registration: { text: string; url: string };
    hint?: string;
    stats: CompletionStats;
    project: string;
    cityId: string;
    isCurrent?: boolean;
  } = $props();

  let heroSrc = $state<string | null>(null);

  $effect.pre(() => {
    heroSrc = getCachedImageUrl(image) ?? null;
  });

  $effect(() => {
    if (getCachedImageUrl(image)) {
      return undefined;
    }
    let cancelled = false;
    fetchImage(image).then((url) => {
      if (!cancelled) {
        heroSrc = url;
      }
    });
    return () => {
      cancelled = true;
    };
  });

  let statsBlock = $derived<Extract<StoryBlock, { type: "stats" }>>({
    type: "stats",
    ref: "completion",
    doc: {
      items: [
        {
          value: stats.stopsCompleted,
          label: `Stops completed (of ${stats.stopsTotal})`,
          visibility: "count_up",
        },
        { value: stats.photosCount, label: "Photos taken", visibility: "count_up" },
        { value: stats.timeOnFoot, label: "Time on foot", visibility: "visible" },
      ],
    },
  });

  let cardIn = $state(false);
  let badgeIn = $state(false);
  let statsIn = $state(false);
  let captionIn = $state(false);
  let closerIn = $state(false);
  let actionsIn = $state(false);
  let playKenBurns = $state(false);
  let confettiFired = $state(false);

  const STATS_STAGGER_MS = 150;

  function prefersReducedMotion(): boolean {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  }

  $effect(() => {
    if (!isCurrent) {
      cardIn = false;
      badgeIn = false;
      statsIn = false;
      captionIn = false;
      closerIn = false;
      actionsIn = false;
      playKenBurns = false;
      confettiFired = false;
      return undefined;
    }

    if (prefersReducedMotion()) {
      cardIn = true;
      badgeIn = true;
      statsIn = true;
      captionIn = true;
      closerIn = true;
      actionsIn = true;
      playKenBurns = false;
      confettiFired = false;
      return undefined;
    }

    playKenBurns = true;
    const timers: ReturnType<typeof setTimeout>[] = [
      setTimeout(() => { cardIn = true; }, 120),
      setTimeout(() => { badgeIn = true; }, 380),
      setTimeout(() => {
        confettiFired = true;
        if (typeof navigator.vibrate === "function") {
          navigator.vibrate(40);
        }
      }, 780),
      setTimeout(() => { statsIn = true; }, 1000),
      setTimeout(() => { captionIn = true; }, 1520),
      setTimeout(() => { closerIn = true; }, 1680),
      setTimeout(() => { actionsIn = true; }, 1900),
    ];

    return () => {
      timers.forEach(clearTimeout);
      playKenBurns = false;
    };
  });

  function goToResults() {
    push(`/${project}/${cityId}/results_download`);
  }
</script>

<div class="cmpl-root">
  <div class="cmpl-hero" class:cmpl-hero--play={playKenBurns}>
    {#if heroSrc}
      <div class="cmpl-hero-img" style="background-image: url({heroSrc})"></div>
    {/if}
    {#if confettiFired}
      <ConfettiEffect />
    {/if}
  </div>

  <div class="cmpl-card cmpl-reveal" class:cmpl-reveal--in={cardIn}>
    <div
      class="cmpl-badge"
      class:cmpl-badge--in={badgeIn}
      style="background: {$themeStore.theme.accent}"
    >
      <Check size={22} aria-hidden="true" />
    </div>
    <div>
      <div class="cmpl-title">{title}</div>
      <div class="cmpl-subtitle">{subtitle}</div>
      <div class="cmpl-place">{place}</div>
    </div>
  </div>

  <div class="cmpl-section cmpl-reveal" class:cmpl-reveal--in={statsIn}>
    <div class="cmpl-section-label">
      <Sparkles size={12} aria-hidden="true" />
      Your hunt
    </div>
    <StoryStats block={statsBlock} staggerMs={STATS_STAGGER_MS} />
  </div>

  {#if caption}
    <p class="cmpl-caption cmpl-reveal" class:cmpl-reveal--in={captionIn}>{caption}</p>
  {/if}

  {#if closingText}
    <div class="cmpl-closer cmpl-reveal" class:cmpl-reveal--in={closerIn}>
      <MarkdownText text={closingText} />
    </div>
  {/if}

  <div class="cmpl-actions cmpl-reveal" class:cmpl-reveal--in={actionsIn}>
    <a class="cmpl-btn-primary" href={registration.url} target="_blank" rel="noopener noreferrer">
      {registration.text}
    </a>
    <button type="button" class="cmpl-btn-secondary" onclick={goToResults}>
      See your answers
    </button>
    {#if hint}
      <p class="cmpl-hint">{hint}</p>
    {/if}
  </div>
</div>
