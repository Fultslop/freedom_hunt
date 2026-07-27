<script lang="ts">
  import { fetchImage, getCachedImageUrl } from "../assets/AssetManager";
  import "./ScreenHero.css";

  let { image, title }: { image?: string; title: string } = $props();

  let heroSrc = $state<string | null>(null);

  $effect.pre(() => {
    heroSrc = image ? (getCachedImageUrl(image) ?? null) : null;
  });

  $effect(() => {
    if (!image || getCachedImageUrl(image)) {
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
</script>

<div class="screen-hero">
  {#if heroSrc}
    <img src={heroSrc} alt={title} class="screen-hero__img" />
  {/if}
  <h1 class="screen-hero__title">{title}</h1>
</div>
