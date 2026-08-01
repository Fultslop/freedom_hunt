<script lang="ts">
  import { push } from "svelte-spa-router";
  import ScreenHero from "./ScreenHero.svelte";
  import MarkdownText from "./MarkdownText.svelte";
  import { authStore } from "../stores/authStore";
  import { postFormSubmit } from "../utils/api";
  import { resolvePageUrl } from "../utils/optionTargets";
  import type { OptionTarget } from "../types/data";
  import "./OptionsScreen.css";

  let {
    image,
    title,
    text,
    options,
    locationId,
    project,
    city,
    route,
    onContinue = undefined,
  }: {
    image?: string;
    title: string;
    text?: string;
    options: Array<{ text: string; target: OptionTarget; track?: boolean }>;
    locationId: string;
    project: string;
    city: string;
    route: string;
    onContinue?: () => void;
  } = $props();

  // Best-effort only: fires the same postFormSubmit path challenge forms use so
  // organizers can see which teams clicked a tracked button (e.g. a EULA's "I
  // understand"), but never blocks navigation on the network call succeeding.
  async function trackSelection(optionText: string) {
    const auth = $authStore.activeAuth;
    try {
      await postFormSubmit({
        locationId,
        routeId: route,
        cityId: city,
        teamName: auth?.kind === "participant" ? auth.teamName : "",
        contact: auth?.kind === "participant" ? (auth.contact ?? "") : "",
        answers: { selected: optionText },
      });
    } catch {
      /* tracking is best-effort — never block navigation on it */
    }
  }

  function handlePageSelect(value: "title" | "project" | "start_route" | "gallery" | "continue") {
    if (value === "continue") {
      onContinue?.();
    } else {
      if (value === "start_route") {
        const auth = $authStore.activeAuth;
        const teamName = auth?.kind === "participant" ? auth.teamName : "";
        localStorage.removeItem(`${project}/${teamName}/${city}/${route}`);
      }
      push(resolvePageUrl(value, { project, city, route }));
    }
  }
</script>

<div class="options-screen">
  <ScreenHero {image} {title} />
  {#if text}
    <div class="options-screen__text">
      <MarkdownText {text} />
    </div>
  {/if}
  <div class="options-screen__buttons">
    {#each options as option, i (i)}
      {#if option.target.type === "link"}
        <a
          class="options-screen__button"
          href={option.target.value}
          target="_blank"
          rel="noopener noreferrer"
          onclick={() => {
            if (option.track) {
              void trackSelection(option.text);
            }
          }}
        >
          {option.text}
        </a>
      {:else}
        <button
          class="options-screen__button"
          type="button"
          onclick={() => {
            if (option.track) {
              void trackSelection(option.text);
            }
            handlePageSelect(option.target.value as "title" | "project" | "start_route" | "gallery" | "continue");
          }}
        >
          {option.text}
        </button>
      {/if}
    {/each}
  </div>
</div>
