<script lang="ts">
  import type { StoryBlock, FoldBlock } from "../types/storyline";
  import StoryProse from "./StoryProse.svelte";
  import StoryHook from "./StoryHook.svelte";
  import StoryStats from "./StoryStats.svelte";
  import StoryFold from "./StoryFold.svelte";

  let { block }: { block: StoryBlock | FoldBlock } = $props();
</script>

{#if block.type === "prose"}
  <StoryProse markdown={block.markdown} />
{:else if block.type === "hook"}
  <StoryHook {block} />
{:else if block.type === "stats"}
  <StoryStats {block} />
{:else if block.type === "fold"}
  <StoryFold {block} />
{/if}
