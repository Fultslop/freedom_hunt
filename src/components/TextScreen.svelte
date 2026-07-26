<script lang="ts">
  import ScreenHero from "./ScreenHero.svelte";
  import MarkdownText from "./MarkdownText.svelte";
  import "./TextScreen.css";

  let {
    image,
    title,
    text,
    margin,
  }: { image?: string; title: string; text: string; margin?: string } = $props();
</script>

<div class="text-screen">
  <ScreenHero {image} {title} />
  <div class="text-screen__body" style={margin ? `margin: ${margin}` : undefined}>
    <MarkdownText {text} />
  </div>
</div>
