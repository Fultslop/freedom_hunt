<script lang="ts">
  import { untrack } from "svelte";
  import "./StoryStats.css";
  import type { StoryBlock } from "../types/storyline";

  let {
    block,
    staggerMs = 0,
  }: { block: Extract<StoryBlock, { type: "stats" }>; staggerMs?: number } = $props();

  let revealed = $state<Record<number, boolean>>({});
  let animatedValues = $state<Record<number, number>>(
    Object.fromEntries(
      block.doc.items
        .map((item, idx) => [idx, item] as const)
        .filter(([, item]) => item.visibility === "count_up" && typeof item.value === "number")
        .map(([idx]) => [idx, 0]),
    ),
  );
  let popped = $state<Record<number, boolean>>({});

  function toggle(idx: number): void {
    revealed = { ...revealed, [idx]: true };
  }

  function display(value: number | string): string {
    return typeof value === "number" ? value.toLocaleString("en-US") : value;
  }

  function displayItem(item: { value: number | string }, idx: number): string {
    if (typeof item.value === "number" && animatedValues[idx] !== undefined) {
      return display(animatedValues[idx]);
    }
    return display(item.value);
  }

  const COUNT_UP_DURATION_MS = 600;
  const COUNT_UP_STEPS = 20;
  const COUNT_UP_STEP_MS = COUNT_UP_DURATION_MS / COUNT_UP_STEPS;

  $effect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
    const startTimers: ReturnType<typeof setTimeout>[] = [];
    const tickTimers: ReturnType<typeof setInterval>[] = [];

    block.doc.items.forEach((item, idx) => {
      if (item.visibility === "count_up" && typeof item.value === "number") {
        const target = item.value;
        if (prefersReducedMotion) {
          const current = untrack(() => animatedValues);
          animatedValues = { ...current, [idx]: target };
        } else {
          startTimers.push(
            setTimeout(() => {
              let step = 0;
              const interval = setInterval(() => {
                step += 1;
                const progress = Math.min(1, step / COUNT_UP_STEPS);
                const current = untrack(() => animatedValues);
                animatedValues = { ...current, [idx]: Math.round(target * progress) };
                if (progress >= 1) {
                  clearInterval(interval);
                  const currentPopped = untrack(() => popped);
                  popped = { ...currentPopped, [idx]: true };
                }
              }, COUNT_UP_STEP_MS);
              tickTimers.push(interval);
            }, idx * staggerMs),
          );
        }
      }
    });

    return () => {
      startTimers.forEach(clearTimeout);
      tickTimers.forEach(clearInterval);
    };
  });

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
          <div
            class="story-stats__value"
            class:story-stats__value--pop={popped[idx]}
          >
            {displayItem(item, idx)}
          </div>
        {/if}
        <div class="story-stats__label">{item.label}</div>
      </div>
    {/each}
  </div>
  {#if block.doc.footnote}
    <p class="story-stats__footnote">{block.doc.footnote}</p>
  {/if}
</div>
