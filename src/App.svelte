<script lang="ts" module>
  export { requireAuth, requireAdmin } from "./utils/authGuards";
</script>

<script lang="ts">
  import Router from "svelte-spa-router";
  import { wrap } from "svelte-spa-router/wrap";
  import type { ComponentType } from "svelte";
  import { onMount } from "svelte";
  import { themeStore } from "./stores/themeStore";
  import { fontSizeStore } from "./stores/fontSizeStore";
  import { authStore } from "./stores/authStore";
  import { requireAuth, requireAdmin } from "./utils/authGuards";
  import TitleBar from "./components/TitleBar.svelte";
  import AppPage from "./pages/AppPage.svelte";
  import LoginPage from "./pages/LoginPage.svelte";
  import ProjectPage from "./pages/ProjectPage.svelte";
  import CityPage from "./pages/CityPage.svelte";
  import RoutePage from "./pages/RoutePage.svelte";
  import EditorLoginPage from "./pages/editor/EditorLoginPage.svelte";
  import EditorPage from "./pages/editor/EditorPage.svelte";
  import EditorLocationList from "./pages/editor/EditorLocationList.svelte";
  import EditorLocationForm from "./pages/editor/EditorLocationForm.svelte";

  // svelte-spa-router uses Svelte 4 ComponentType; Svelte 5 components need a cast
  function asRoute(comp: unknown): ComponentType {
    return comp as ComponentType;
  }

  const routes = {
    "/": asRoute(AppPage),
    "/login/:project": asRoute(LoginPage),
    "/:project": wrap({
      component: asRoute(ProjectPage),
      conditions: [requireAuth],
    }),
    "/:project/:city": wrap({
      component: asRoute(CityPage),
      conditions: [requireAuth],
    }),
    "/:project/:city/:route": wrap({
      component: asRoute(RoutePage),
      conditions: [requireAuth],
    }),
    "/editor/login": asRoute(EditorLoginPage),
    "/editor": wrap({
      component: asRoute(EditorPage),
      conditions: [requireAdmin],
    }),
    "/editor/locations/:project/:city": wrap({
      component: asRoute(EditorLocationList),
      conditions: [requireAdmin],
    }),
    "/editor/locations/:project/:city/new": wrap({
      component: asRoute(EditorLocationForm),
      conditions: [requireAdmin],
    }),
    "/editor/locations/:project/:city/edit/:filename": wrap({
      component: asRoute(EditorLocationForm),
      conditions: [requireAdmin],
    }),
  };

  // Sync theme tokens to CSS custom properties on <html>
  $effect(() => {
    const { theme } = $themeStore;
    const root = document.documentElement;
    root.style.setProperty("--font-family", theme.fontFamily);
    root.style.setProperty("--color-background", theme.background);
    root.style.setProperty("--color-surface", theme.surface);
    root.style.setProperty("--color-border", theme.border);
    root.style.setProperty("--color-text", theme.text);
    root.style.setProperty("--color-text-secondary", theme.textSecondary);
    root.style.setProperty("--color-text-muted", theme.textMuted);
    root.style.setProperty("--color-accent", theme.accent);
    root.style.setProperty("--color-bar-background", theme.barBackground);
    root.style.setProperty("--color-bar-border", theme.barBorder);
    root.style.setProperty("--color-bar-text", theme.barText);
    root.style.setProperty(
      "--color-bar-text-secondary",
      theme.barTextSecondary,
    );
    root.style.setProperty("--color-progress-track", theme.progressTrack);
    root.style.setProperty("--color-progress-fill", theme.progressFill);
    root.style.setProperty("--color-clue-background", theme.clueBackground);
    root.style.setProperty("--color-clue-border-color", theme.clueBorderColor);
    document.body.style.background = theme.background;
  });

  // Sync font size to data-fontsize attribute on <html>
  $effect(() => {
    document.documentElement.dataset.fontsize = $fontSizeStore.fontSize;
  });

  onMount(() => {
    authStore.init();
  });
</script>

<TitleBar />
<Router {routes} />
