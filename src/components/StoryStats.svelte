<script lang="ts">
  import "./StoryStats.css";
  import type { StoryBlock } from "../types/storyline";

  let { block }: { block: Extract<StoryBlock, { type: "stats" }> } = $props();

  let revealed = $state<Record<number, boolean>>({});

  function toggle(idx: number): void {
    revealed = { ...revealed, [idx]: true };
  }

  function display(value: number | string): string {
    return typeof value === "number" ? value.toLocaleString("en-US") : value;
  }

  let anyHiddenCovered = $derived(
    block.doc.items.some(
      (item, idx) => item.visibility === "click_to_reveal" && !revealed[idx],
    ),
  );
</script>

<div class="story-stats">
  {#if block.doc.prompt && anyHiddenCovered}
    <p class="story-stats__prompt">{block.doc.prompt}</p>
  {/if}
  <div class="story-stats__grid">
    {#each block.doc.items as item, idx (idx)}
      <div class="story-stats__item">
        {#if item.visibility === "click_to_reveal" && !revealed[idx]}
          <button
            type="button"
            class="story-stats__cover"
            aria-pressed={false}
            data-testid="story-stats-cover-{idx}"
            onclick={() => toggle(idx)}
          >
            <span class="story-stats__cover-label">Tap to reveal</span>
          </button>
        {:else}
          <div class="story-stats__value">{display(item.value)}</div>
        {/if}
        <div class="story-stats__label">{item.label}</div>
      </div>
    {/each}
  </div>
  {#if block.doc.footnote}
    <p class="story-stats__footnote">{block.doc.footnote}</p>
  {/if}
</div>
