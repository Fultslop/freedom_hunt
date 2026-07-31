<script lang="ts" module>
  export { requireAuth, requireEditorAccess, requireOrganizerAccess } from "./utils/authGuards";
</script>

<script lang="ts">
  import Router from "svelte-spa-router";
  import { wrap } from "svelte-spa-router/wrap";
  import { onMount } from "svelte";
  import { themeStore } from "./stores/themeStore";
  import { fontSizeStore } from "./stores/fontSizeStore";
  import { authStore } from "./stores/authStore";
  import { requireAuth, requireEditorAccess, requireOrganizerAccess } from "./utils/authGuards";
  import TitleBar from "./components/TitleBar.svelte";
  import LandingPage from "./pages/LandingPage.svelte";
  import TeamSetupPage from "./pages/TeamSetupPage.svelte";
  import LoginPage from "./pages/LoginPage.svelte";
  import DemoLoginPage from "./pages/DemoLoginPage.svelte";
  import DemoSignupPage from "./pages/DemoSignupPage.svelte";
  import SignupPage from "./pages/SignupPage.svelte";
  import InviteAcceptPage from "./pages/InviteAcceptPage.svelte";
  import ProjectPage from "./pages/ProjectPage.svelte";
  import CityPage from "./pages/CityPage.svelte";
  import RoutePage from "./pages/RoutePage.svelte";
  import GalleryLandingPage from "./pages/GalleryLandingPage.svelte";
  import ResultsDownloadPage from "./pages/ResultsDownloadPage.svelte";
  import EditorLoginPage from "./pages/editor/EditorLoginPage.svelte";
  import EditorPage from "./pages/editor/EditorPage.svelte";
  import EditorLocationList from "./pages/editor/EditorLocationList.svelte";
  import EditorLocationForm from "./pages/editor/EditorLocationForm.svelte";
  import PromoReviewPage from "./pages/editor/PromoReviewPage.svelte";

  function asRoute(comp: unknown): any {
    return comp;
  }

  // Order matters: svelte-spa-router matches the first route whose pattern
  // fits the URL. Wildcard segments (e.g. :route) match any string, so a
  // more specific literal path (e.g. .../gallery) must be declared before a
  // wildcard route that would otherwise match the same URL and win first.
  const routes = {
    "/": asRoute(LandingPage),
    "/start": asRoute(LandingPage),
    "/join/:code": asRoute(LandingPage),
    "/team/:project": asRoute(TeamSetupPage),
    "/login/demo": asRoute(DemoLoginPage),
    "/login/:project": asRoute(LoginPage),
    "/signup/demo": asRoute(DemoSignupPage),
    "/signup": asRoute(SignupPage),
    "/invite/:token": asRoute(InviteAcceptPage),
    "/editor/login": asRoute(EditorLoginPage),
    "/editor": wrap({
      component: asRoute(EditorPage),
      conditions: [requireEditorAccess],
    }),
    "/editor/locations/:project/:city": wrap({
      component: asRoute(EditorLocationList),
      conditions: [requireEditorAccess],
    }),
    "/editor/locations/:project/:city/new/:newId": wrap({
      component: asRoute(EditorLocationForm),
      conditions: [requireEditorAccess],
    }),
    "/editor/locations/:project/:city/edit/:filename": wrap({
      component: asRoute(EditorLocationForm),
      conditions: [requireEditorAccess],
    }),
    "/editor/:project/:city/promo-review": wrap({
      component: asRoute(PromoReviewPage),
      conditions: [requireOrganizerAccess],
    }),
    "/:project": wrap({
      component: asRoute(ProjectPage),
      conditions: [requireAuth],
    }),
    "/:project/:city": wrap({
      component: asRoute(CityPage),
      conditions: [requireAuth],
    }),
    "/:project/:city/gallery": wrap({
      component: asRoute(GalleryLandingPage),
      conditions: [requireAuth],
    }),
    "/:project/:city/results_download": wrap({
      component: asRoute(ResultsDownloadPage),
      conditions: [requireAuth],
    }),
    "/:project/:city/:route": wrap({
      component: asRoute(RoutePage),
      conditions: [requireAuth],
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
    root.style.setProperty("--search-grid", theme.searchGrid);
    root.style.setProperty("--search-edge", theme.searchEdge);
    root.style.setProperty("--search-edge-active", theme.searchEdgeActive);
    root.style.setProperty("--search-edge-visited", theme.searchEdgeVisited);
    root.style.setProperty("--search-node", theme.searchNode);
    root.style.setProperty("--search-node-active", theme.searchNodeActive);
    root.style.setProperty("--search-node-halo", theme.searchNodeHalo);
    root.style.setProperty("--search-label", theme.searchLabel);
    root.style.setProperty("--search-pin-stem", theme.searchPinStem);
    root.style.setProperty("--search-pin-head", theme.searchPinHead);
    root.style.setProperty("--intro-fog", theme.introFog);
    root.style.setProperty("--intro-scrim", theme.introScrim);
    root.style.setProperty("--sheen-image", theme.sheenImage);
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
