<script lang="ts">
  import "./ConfettiEffect.css";

  const COLORS = ["#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#a855f7"];
  const PARTICLE_COUNT = 32;
  const OUTLINE_VALUE_FACTOR = 0.05;

  // Darkens a #rrggbb color to `factor` of its original value, keeping the hue —
  // matches the dark ink outline every confetti piece has in celebration.png.
  function darken(hex: string, factor: number): string {
    const channel = (start: number) =>
      Math.round(parseInt(hex.slice(start, start + 2), 16) * factor)
        .toString(16)
        .padStart(2, "0");
    return `#${channel(1)}${channel(3)}${channel(5)}`;
  }

  const particles = Array.from({ length: PARTICLE_COUNT }, (_unused, i) => {
    const color = COLORS[i % COLORS.length];
    return {
      left: (i / PARTICLE_COUNT) * 100 + (Math.random() * 4 - 2),
      delay: Math.random() * 0.4,
      duration: 1.2 + Math.random() * 0.8,
      color,
      outline: darken(color, OUTLINE_VALUE_FACTOR),
    };
  });
</script>

<div class="confetti-effect" aria-hidden="true">
  {#each particles as p, i (i)}
    <span
      class="confetti-effect__particle"
      style="left: {p.left}%; background: {p.color}; border-color: {p.outline}; animation-duration: {p.duration}s; animation-delay: {p.delay}s"
    ></span>
  {/each}
</div>
