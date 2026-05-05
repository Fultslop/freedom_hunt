<script lang="ts">
  import { themeStore } from "../stores/themeStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import { fetchImage } from "../assets/AssetManager";
  import CitySelector from "../components/CitySelector.svelte";
  import MarkdownText from "../components/MarkdownText.svelte";
  import { loadText } from "../utils/loadText";
  import type { CitiesText, ProjectMeta } from "../types/data";
  import "./ProjectPage.css";

  let { params }: { params: { project: string } } = $props();

  let citiesText = $state<CitiesText | null>(null);
  let logoUrl = $state<string | null>(null);

  $effect(() => {
    const lang = $languageStore.currentLang;
    loadText<ProjectMeta>(lang, `projects/${params.project}/${params.project}`).then((data) => {
      if (data && "style" in data && data.style) {
        themeStore.setThemeName(data.style as any);
      }
      if (data && "project.image" in data && data["project.image"]) {
        fetchImage(data["project.image"] as string).then((url) => { logoUrl = url; });
      }
    });
    loadText<CitiesText>(lang, `projects/${params.project}/cities`).then((data) => {
      citiesText = data;
      titleBarStore.set({
        title: (data?.["page.title"] as string) ?? params.project,
        progress: null,
        backPath: "/",
      });
    });
  });
</script>

<div class="project-page">
  {#if logoUrl}
    <img src={logoUrl} alt="" class="project-page__logo" />
  {/if}
  {#if citiesText}
    <h1 class="project-page__title">{citiesText["page.title"]}</h1>
    <MarkdownText text={citiesText["page.text"] as string | undefined} />
    <h2 class="project-page__select-city">{citiesText["page.selectCity"]}</h2>
    <div class="project-page__city-list">
      {#each citiesText.items as city (city.id)}
        <CitySelector project={params.project} {city} />
      {/each}
    </div>
  {:else}
    <p class="project-page__loading">Loading…</p>
  {/if}
</div>