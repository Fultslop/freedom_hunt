<script lang="ts">
  import { themeStore } from "../stores/themeStore";
  import "./DepthWordmark.css";

  let { project }: { project?: string } = $props();

  let sheenEnabled = $derived($themeStore.theme.intro.sheen);
  let lines = $derived(
    project ? ["Searchspace", "Scavenger Hunt", project] : ["Searchspace", "Scavenger Hunt"],
  );
</script>

<div class="depth-wordmark">
  {#each lines as line, index (index)}
    <div
      class={`depth-wordmark__line${index === lines.length - 1 && sheenEnabled ? " depth-wordmark__line--sheen" : ""}`}
      style={`padding-left: ${index * 20}px; animation-delay: ${-index * 2.6}s;`}
    >
      {line}
    </div>
  {/each}
</div>
