<script lang="ts">
  import { push } from "svelte-spa-router";
  import { themeStore } from "../stores/themeStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { languageStore } from "../stores/languageStore";
  import { fetchImage } from "../assets/AssetManager";
  import MarkdownText from "../components/MarkdownText.svelte";
  import { loadText } from "../utils/loadText";
  import type { ApplicationText, ProjectsText } from "../types/data";
  import "./AppPage.css";

  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  themeStore.setThemeName("app");

  let appText = $state<ApplicationText | null>(null);
  let projectsText = $state<ProjectsText | null>(null);
  let landingImageUrl = $state<string | null>(null);
  let imgHeight = $state(0);
  let projectImageUrls = $state<Record<string, string>>({});

  $effect(() => {
    loadText<ApplicationText>($languageStore.currentLang, "application").then(
      (data) => {
        appText = data;
        if (data)
          titleBarStore.set({
            title: data["app.title"] ?? "Freedom Hunt",
            progress: null,
            backPath: null,
          });
      },
    );
    loadText<ProjectsText>(
      $languageStore.currentLang,
      "projects/projects",
    ).then((data) => {
      projectsText = data;
      if (data?.items) {
        data.items.forEach((project) => {
          if (project.image) {
            fetchImage(project.image).then((url) => {
              if (url)
                projectImageUrls = { ...projectImageUrls, [project.id]: url };
            });
          }
        });
      }
    });
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

    {#if projectsText}
      <h2 class="app-page__subtitle">{projectsText["page.subtitle"]}</h2>
      {#each projectsText.items as project (project.id)}
        <div
          role="button"
          tabindex="0"
          class="app-page__project-card"
          onclick={() => push(`/${project.id}`)}
          onkeydown={(e) =>
            (e.key === "Enter" || e.key === " ") && push(`/${project.id}`)}
        >
          {#if projectImageUrls[project.id]}
            <img
              src={projectImageUrls[project.id]}
              alt=""
              class="app-page__project-img"
            />
          {/if}
          <div class="app-page__project-body">
            <div class="app-page__project-name">{project.name}</div>
            <MarkdownText
              text={project.description}
              style={{
                fontSize: 13,
                color: $themeStore.theme.textMuted,
                marginTop: 4,
                lineHeight: "1.5",
              }}
            />
          </div>
        </div>
      {/each}
    {:else}
      <p class="app-page__loading">Loading…</p>
    {/if}
  </div>
</div>
