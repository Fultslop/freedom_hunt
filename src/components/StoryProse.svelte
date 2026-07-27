<script lang="ts">
  import "./MarkdownText.css";
  import "./StoryProse.css";
  import { storylineMarked } from "../utils/storylineMarked";
  /* eslint-disable svelte/no-at-html-tags */

  let { markdown }: { markdown: string } = $props();
</script>

<div class="markdown-text">
  {@html storylineMarked.parse(markdown)}
</div>
