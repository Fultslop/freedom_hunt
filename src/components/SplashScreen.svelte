<script lang="ts">
  import { fetchImage, getCachedImageUrl } from "../assets/AssetManager";
  import ConfettiEffect from "./effects/ConfettiEffect.svelte";
  import ShootingStarsEffect from "./effects/ShootingStarsEffect.svelte";
  import FireworksEffect from "./effects/FireworksEffect.svelte";
  import { untrack } from "svelte";
  import type { SplashShader, SplashEffectConfig, SplashAnchor } from "../types/data";
  import "./SplashScreen.css";

  let {
    image,
    title,
    shader = "none",
    effectConfig = undefined,
    anchor = { horizontal: "center", vertical: "center" },
    isCurrent = true,
  }: {
    image: string;
    title: string;
    shader?: SplashShader;
    effectConfig?: SplashEffectConfig;
    anchor?: SplashAnchor;
    isCurrent?: boolean;
  } = $props();

  let bgSrc = $state<string | null>(null);
  let activeEffects = $state<{ id: number; type: string }[]>([]);
  let nextId = 0;

  $effect.pre(() => {
    bgSrc = getCachedImageUrl(image) ?? null;
  });

  $effect(() => {
    if (getCachedImageUrl(image)) {
      return undefined;
    }
    let cancelled = false;
    fetchImage(image).then((url) => {
      if (!cancelled) {
        bgSrc = url;
      }
    });
    return () => {
      cancelled = true;
    };
  });

  function randomCooldownMs(config: SplashEffectConfig): number {
    const maxSeconds = config.cooldown?.max ?? 1;
    const minSeconds = config.cooldown?.min ?? maxSeconds;
    const seconds = minSeconds + Math.random() * Math.max(0, maxSeconds - minSeconds);
    return seconds * 1000;
  }

  $effect(() => {
    if (!isCurrent || !effectConfig) {
      activeEffects = [];
      return undefined;
    }

    const config = effectConfig;
    const maxIterations = config.max ?? 1;
    let iteration = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function playIteration() {
      if (!cancelled) {
        iteration += 1;
        const id = nextId++;
        activeEffects = untrack(() => [...activeEffects, { id, type: config.type }]);
        if (maxIterations < 0 || iteration < maxIterations) {
          timer = setTimeout(playIteration, randomCooldownMs(config));
        }
      }
    }

    playIteration();

    return () => {
      cancelled = true;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      activeEffects = [];
    };
  });
</script>

<div
  class="splash-screen"
  class:splash-screen--grayscale={shader === "grayscale"}
  class:splash-screen--duotone={shader === "duotone"}
  style={bgSrc ? `background-image: url(${bgSrc})` : undefined}
>
  {#if shader === "vignette"}
    <div class="splash-screen__overlay splash-screen__overlay--vignette"></div>
  {:else if shader === "darken"}
    <div class="splash-screen__overlay splash-screen__overlay--darken"></div>
  {/if}

  {#each activeEffects as eff (eff.id)}
    {#if eff.type === "confetti"}
      <ConfettiEffect />
    {:else if eff.type === "shooting-stars"}
      <ShootingStarsEffect />
    {:else if eff.type === "fireworks"}
      <FireworksEffect />
    {/if}
  {/each}

  <div
    class="splash-screen__title-wrap"
    class:splash-screen__title-wrap--h-left={anchor.horizontal === "left"}
    class:splash-screen__title-wrap--h-right={anchor.horizontal === "right"}
    class:splash-screen__title-wrap--v-top={anchor.vertical === "top"}
    class:splash-screen__title-wrap--v-bottom={anchor.vertical === "bottom"}
  >
    <h1 class="splash-screen__title">{title}</h1>
  </div>
</div>
