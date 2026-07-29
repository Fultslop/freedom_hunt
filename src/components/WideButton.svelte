<script lang="ts">
  import { push } from "svelte-spa-router";
  import { themeStore } from "../stores/themeStore";
  import { resolvePageUrl } from "../utils/optionTargets";
  import type { WideButtonTarget } from "../types/data";
  import "./WideButton.css";

  let {
    text,
    target,
    color = undefined,
    project,
    cityId,
  }: {
    text: string;
    target: WideButtonTarget;
    color?: "primary" | "secondary";
    project: string;
    cityId: string;
  } = $props();

  let resolvedColor = $derived(color ?? $themeStore.theme.defaultButtonColor);
</script>

{#if target.type === "link"}
  <a
    class="wide-btn wide-btn--{resolvedColor}"
    href={target.value}
    target="_blank"
    rel="noopener noreferrer"
  >
    {text}
  </a>
{:else}
  <button
    type="button"
    class="wide-btn wide-btn--{resolvedColor}"
    onclick={() => push(resolvePageUrl(target.value, { project, city: cityId }))}
  >
    {text}
  </button>
{/if}
