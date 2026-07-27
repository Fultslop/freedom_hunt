<script lang="ts">
  import "./StoryFold.css";
  import type { StoryBlock } from "../types/storyline";
  import StoryBlockRenderer from "./StoryBlockRenderer.svelte";
  import { ChevronDown } from "lucide-svelte";

  let { block }: { block: Extract<StoryBlock, { type: "fold" }> } = $props();

  let open = $state(false);

  function toggle(): void {
    open = !open;
  }
</script>

<div class="story-fold">
  <button
    type="button"
    class="story-fold__toggle"
    aria-expanded={open}
    data-testid="story-fold-toggle"
    onclick={toggle}
  >
    <span class="story-fold__label">{open ? "Show less" : block.label}</span>
    <span class="story-fold__caret" class:story-fold__caret--open={open}>
      <ChevronDown size={16} aria-hidden="true" />
    </span>
  </button>
  {#if open}
    <div class="story-fold__body" data-testid="story-fold-body">
      {#each block.blocks as inner, idx (idx)}
        <StoryBlockRenderer block={inner} />
      {/each}
    </div>
  {/if}
</div>
