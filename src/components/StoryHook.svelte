<script lang="ts">
  import "./StoryHook.css";
  import { storylineMarked } from "../utils/storylineMarked";
  import type { StoryBlock } from "../types/storyline";
  /* eslint-disable svelte/no-at-html-tags */

  let { block }: { block: Extract<StoryBlock, { type: "hook" }> } = $props();
</script>

<div class="story-hook">
  {@html storylineMarked.parseInline(block.markdown)}
</div>
