<script lang="ts">
  import { push } from "svelte-spa-router";
  import { themeStore } from "../stores/themeStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import { fetchImage } from "../assets/AssetManager";
  import { loadText } from "../utils/loadText";
  import type { ApplicationText } from "../types/data";
  import "./AppPage.css";

  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  themeStore.setThemeName("app");

  let appText = $state<ApplicationText | null>(null);
  let landingImageUrl = $state<string | null>(null);
  let imgHeight = $state(0);

  $effect(() => {
    loadText<ApplicationText>($languageStore.currentLang, "application").then(
      (data) => {
        appText = data;
        if (data) {
          titleBarStore.set({
            title: data["app.title"] ?? "Freedom Hunt",
            progress: null,
            backPath: null,
          });
        }
      },
    );
    fetchImage("landing-page.jpg").then((url) => {
      landingImageUrl = url;
    });
  });

  let contentMarginTop = $derived(
    imgHeight
      ? Math.round(-(imgHeight / 2 - window.innerHeight * 0.2))
      : landingImageUrl
        ? -80
        : 0,
  );
</script>

<div class="app-page">
  {#if landingImageUrl}
    <div
      class="app-page__hero-wrap"
      style={`height: ${imgHeight ? imgHeight / 2 + "px" : "auto"}`}
    >
      <img
        src={landingImageUrl}
        alt=""
        onload={(e) =>
          (imgHeight = (e.target as HTMLImageElement).offsetHeight)}
        class="app-page__hero-img"
      />
      <div class="app-page__hero-gradient"></div>
    </div>
  {/if}

  <div class="app-page__content" style={`margin-top: ${contentMarginTop}px`}>
    {#if appText}
      <div class="app-page__heading">
        <h1 class="app-page__title">{appText["app.title"]}</h1>
        <p class="app-page__tagline">{appText["app.tagline"]}</p>
      </div>
    {/if}

    <button
      type="button"
      class="app-page__start-btn"
      onclick={() => push("/start")}
    >
      Start Hunting
    </button>
  </div>
</div>
