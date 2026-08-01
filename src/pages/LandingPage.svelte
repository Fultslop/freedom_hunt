<script lang="ts">
  import { push, location } from "svelte-spa-router";
  import { Image, History, Github } from "lucide-svelte";
  import { themeStore } from "../stores/themeStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import SearchPlane from "../components/SearchPlane.svelte";
  import DepthWordmark from "../components/DepthWordmark.svelte";
  import JoinSheet from "../components/JoinSheet.svelte";
  import "./LandingPage.css";

  let { params = {} }: { params?: Record<string, string> } = $props();

  let theme = $derived($themeStore.theme);

  let sheetOpen = $derived($location !== "/");

  let initialCode = $derived((params as Record<string, string | undefined>).code ?? "");

  $effect(() => {
    titleBarStore.set(
      sheetOpen
        ? { title: "Join the hunt", progress: { current: 1, total: 2 }, backPath: "/" }
        : { title: "Freedom Hunt", progress: null, backPath: null },
    );
  });

  function handleResolved(_project: string) {}

  function handleJoin(project: string) {
    push(`/team/${project}`);
  }

  function handleContinue(path: string) {
    push(path);
  }

  function handleDemo() {
    push("/login/demo");
  }

  function handleClose() {
    push("/");
  }
</script>

<div class="landing-page">
  <SearchPlane mode={theme.intro.motion === "none" ? "frozen" : "search"} anchor={64} paused={sheetOpen} />
  <div class="landing-page__fog"></div>
  <div class="landing-page__content">
    <DepthWordmark />
    <p class="landing-page__sub">
      Discover the city <strong class="landing-page__sub-accent">together</strong>, one clue at a time.
    </p>
  </div>
  <div class="landing-page__scrim"></div>
  <div class="landing-page__controls">
    <button
      type="button"
      class={`landing-page__cta landing-page__cta--${theme.defaultButtonColor}`}
      onclick={() => push("/start")}
    >
      Start hunting
    </button>
    <nav class="landing-page__nav">
      <button type="button" class="landing-page__nav-item">
        <Image size={18} aria-hidden="true" />
        Gallery
      </button>
      <button type="button" class="landing-page__nav-item">
        <History size={18} aria-hidden="true" />
        Past hunts
      </button>
      <button type="button" class="landing-page__nav-item">
        <Github size={18} aria-hidden="true" />
        Self-host
      </button>
    </nav>
    <p class="landing-page__version">{__BUILD_VERSION__}</p>
  </div>
  <JoinSheet
    open={sheetOpen}
    {initialCode}
    onResolved={handleResolved}
    onJoin={handleJoin}
    onContinue={handleContinue}
    onDemo={handleDemo}
    onClose={handleClose}
  />
</div>
