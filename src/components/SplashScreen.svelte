<script lang="ts">
  import { fetchImage, getCachedImageUrl } from "../assets/AssetManager";
  import ConfettiEffect from "./effects/ConfettiEffect.svelte";
  import ShootingStarsEffect from "./effects/ShootingStarsEffect.svelte";
  import FireworksEffect from "./effects/FireworksEffect.svelte";
  import type { SplashShader, SplashEffectName, SplashAnchor } from "../types/data";
  import "./SplashScreen.css";

  let {
    image,
    title,
    shader = "none",
    effectName = undefined,
    anchor = { horizontal: "center", vertical: "center" },
    playEffect = false,
    entryKey,
    onEffectPlayed = undefined,
  }: {
    image: string;
    title: string;
    shader?: SplashShader;
    effectName?: SplashEffectName;
    anchor?: SplashAnchor;
    playEffect?: boolean;
    entryKey: number;
    onEffectPlayed?: () => void;
  } = $props();

  let bgSrc = $state<string | null>(null);
  let showEffect = $state(false);

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

  // entryKey (the array index this instance currently displays) is read here
  // purely to force this effect to re-run every time the caller swaps in a
  // different splash entry — in carousel/peek swipe mode a single SplashScreen
  // instance is reused across many different entries via prop changes rather
  // than being remounted, so re-triggering must be keyed off entry identity,
  // not component lifecycle.
  $effect(() => {
    void entryKey;
    if (playEffect && effectName) {
      showEffect = true;
      onEffectPlayed?.();
    } else {
      showEffect = false;
    }
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

  {#if showEffect}
    {#if effectName === "confetti"}
      <ConfettiEffect />
    {:else if effectName === "shooting-stars"}
      <ShootingStarsEffect />
    {:else if effectName === "fireworks"}
      <FireworksEffect />
    {/if}
  {/if}

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
