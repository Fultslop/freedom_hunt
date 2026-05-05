<script lang="ts">
  import { marked } from "marked";
  import "./MarkdownText.css";
  /* eslint-disable svelte/no-at-html-tags */
  let {
    text,
    style,
  }: { text?: string; style?: Record<string, string | number> } = $props();

  function toCssString(obj: Record<string, string | number>): string {
    return Object.entries(obj)
      .map(([k, v]) => {
        const prop = k.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);
        const val =
          typeof v === "number" && prop !== "line-height" && prop !== "opacity"
            ? `${v}px`
            : String(v);
        return `${prop}: ${val}`;
      })
      .join("; ");
  }
</script>

{#if text}
  <div class="markdown-text" style={style ? toCssString(style) : undefined}>
    {@html marked.parse(text)}
  </div>
{/if}
