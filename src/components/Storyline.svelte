<script lang="ts">
  import "./Storyline.css";
  import { parseStoryline, validateStoryline } from "../utils/storylineBlocks";
  import StoryBlockRenderer from "./StoryBlockRenderer.svelte";
  import type { StatsDoc } from "../types/storyline";

  let { text, elements }: { text?: string; elements?: Record<string, StatsDoc> } = $props();

  let parsed = $derived(text ? parseStoryline(text, elements) : { blocks: [], warnings: [] });
  let blocks = $derived(parsed.blocks);

  $effect(() => {
    if (import.meta.env.DEV) {
      for (const warning of [...parsed.warnings, ...validateStoryline(blocks)]) {
        console.warn(`Storyline: ${warning}`);
      }
    }
  });
</script>

{#if blocks.length > 0}
  <div class="storyline-root">
    {#each blocks as block, idx (idx)}
      <StoryBlockRenderer {block} />
    {/each}
  </div>
{/if}
