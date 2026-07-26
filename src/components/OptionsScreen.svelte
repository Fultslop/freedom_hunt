<script lang="ts">
  import { push } from "svelte-spa-router";
  import ScreenHero from "./ScreenHero.svelte";
  import type { OptionTarget } from "../types/data";
  import "./OptionsScreen.css";

  let {
    image,
    title,
    options,
    project,
    city,
    route,
  }: {
    image?: string;
    title: string;
    options: Array<{ text: string; target: OptionTarget }>;
    project: string;
    city: string;
    route: string;
  } = $props();

  function handlePageSelect(value: "title" | "project" | "start_route" | "gallery") {
    if (value === "title") {
      push(`/${project}/${city}`);
    } else if (value === "project") {
      push(`/${project}`);
    } else if (value === "gallery") {
      push(`/${project}/${city}/gallery`);
    } else {
      localStorage.removeItem(`${project}/${city}/${route}`);
      push(`/${project}/${city}/${route}`);
    }
  }
</script>

<div class="options-screen">
  <ScreenHero {image} {title} />
  <div class="options-screen__buttons">
    {#each options as option, i (i)}
      {#if option.target.type === "link"}
        <a
          class="options-screen__button"
          href={option.target.value}
          target="_blank"
          rel="noopener noreferrer"
        >
          {option.text}
        </a>
      {:else}
        <button
          class="options-screen__button"
          type="button"
          onclick={() => handlePageSelect(option.target.value as "title" | "project" | "start_route" | "gallery")}
        >
          {option.text}
        </button>
      {/if}
    {/each}
  </div>
</div>
