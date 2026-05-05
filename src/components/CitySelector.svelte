<script lang="ts">
  import { push } from "svelte-spa-router";
  import { fetchImage } from "../assets/AssetManager";
  import type { City } from "../types/data";
  import "./CitySelector.css";

  let {
    project,
    city,
  }: {
    project: string;
    city: City;
  } = $props();

  let imageSrc = $state<string | null>(null);

  $effect(() => {
    if (!city.image) {
      return undefined;
    }
    let cancelled = false;
    fetchImage(city.image).then((url) => {
      if (!cancelled) {
        imageSrc = url;
      }
    });
    return () => {
      cancelled = true;
    };
  });

  function handleNav() {
    push(`/${project}/${city.id}`);
  }
</script>

<div
  role="button"
  tabindex="0"
  class="city-card"
  onclick={handleNav}
  onkeydown={(evt) => (evt.key === "Enter" || evt.key === " ") && handleNav()}
>
  {#if imageSrc}
    <img src={imageSrc} alt={city.name} class="city-card__image" />
  {/if}
  <div>
    <div class="city-card__name">{city.name}</div>
    <div class="city-card__country">{city.country}</div>
    {#if city.description}
      <div class="city-card__description">{city.description}</div>
    {/if}
  </div>
</div>
