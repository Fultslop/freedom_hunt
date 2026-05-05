<script lang="ts">
  import { fetchImage } from "../assets/AssetManager";
  import { themeStore } from "../stores/themeStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import { loadText } from "../utils/loadText";
  import RouteSelector from "../components/RouteSelector.svelte";
  import MarkdownText from "../components/MarkdownText.svelte";
  import type { CityText, RoutesData, ProjectMeta } from "../types/data";
  import "./CityPage.css";

  let { params }: { params: { project: string; city: string } } = $props();

  let cityText = $state<CityText | null>(null);
  let routesText = $state<RoutesData | null>(null);
  let logoUrl = $state<string | null>(null);

  $effect(() => {
    const lang = $languageStore.currentLang;
    loadText<ProjectMeta>(lang, `projects/${params.project}/${params.project}`).then((data) => {
      if (data && "project.image" in data && data["project.image"]) {
        fetchImage(data["project.image"] as string).then((url) => { logoUrl = url; });
      }
    });
    loadText<CityText>(lang, `projects/${params.project}/${params.city}/${params.city}`).then((data) => {
      cityText = data;
      titleBarStore.set({
        title: (cityText?.["city.title"] as string) ?? params.city,
        progress: null,
        backPath: `/${params.project}`,
      });
    });
    loadText<RoutesData>(lang, `projects/${params.project}/${params.city}/routes`).then((data) => {
      routesText = data;
    });
  });

  let theme = $derived($themeStore.theme);
</script>

<div class="city-page">
  {#if logoUrl}
    <img src={logoUrl} alt="" class="city-page__logo" />
  {/if}
  {#if cityText}
    <div class="city-page__intro">
      <h1 class="city-page__title">{cityText["city.title"]}</h1>
      <MarkdownText
        text={cityText["city.description"] as string | undefined}
        style={{
          fontSize: 14,
          color: theme.textSecondary,
          marginTop: 8,
          lineHeight: "1.6",
        }}
      />
    </div>
  {/if}
  {#if routesText}
    <h2 class="city-page__subtitle">Choose a route</h2>
    {#each Object.entries(routesText) as [routeId, route] (routeId)}
      <RouteSelector
        project={params.project}
        city={params.city}
        routeId={routeId}
        {route}
      />
    {/each}
  {:else}
    <p class="city-page__loading">Loading…</p>
  {/if}
</div>