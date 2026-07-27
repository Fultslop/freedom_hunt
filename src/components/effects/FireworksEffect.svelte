<script lang="ts">
  import "./FireworksEffect.css";

  const BURST_COUNT = 3;
  const DOTS_PER_BURST = 10;
  const COLORS = ["#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#a855f7"];

  const bursts = Array.from({ length: BURST_COUNT }, (_unused, b) => ({
    top: 20 + Math.random() * 40,
    left: 15 + (b / BURST_COUNT) * 70 + Math.random() * 10,
    delay: b * 0.3,
    dots: Array.from({ length: DOTS_PER_BURST }, (_inner, dotIndex) => {
      const angle = (dotIndex / DOTS_PER_BURST) * 2 * Math.PI;
      return {
        deltaX: Math.cos(angle) * 60,
        deltaY: Math.sin(angle) * 60,
        color: COLORS[dotIndex % COLORS.length],
      };
    }),
  }));
</script>

<div class="fireworks-effect" aria-hidden="true">
  {#each bursts as burst, b (b)}
    <div
      class="fireworks-effect__burst"
      style="top: {burst.top}%; left: {burst.left}%;"
    >
      {#each burst.dots as dot, d (d)}
        <span
          class="fireworks-effect__dot"
          style="background: {dot.color}; --dx: {dot.deltaX}px; --dy: {dot.deltaY}px; animation-delay: {burst.delay}s"
        ></span>
      {/each}
    </div>
  {/each}
</div>
