<script lang="ts">
  import "./ConfettiEffect.css";

  const COLORS = ["#f59e0b", "#ef4444", "#22c55e", "#3b82f6", "#a855f7"];
  const PARTICLE_COUNT = 24;

  const particles = Array.from({ length: PARTICLE_COUNT }, (_unused, i) => ({
    left: (i / PARTICLE_COUNT) * 100 + (Math.random() * 4 - 2),
    delay: Math.random() * 0.4,
    duration: 1.2 + Math.random() * 0.8,
    color: COLORS[i % COLORS.length],
  }));
</script>

<div class="confetti-effect" aria-hidden="true">
  {#each particles as p, i (i)}
    <span
      class="confetti-effect__particle"
      style="left: {p.left}%; background: {p.color}; animation-duration: {p.duration}s; animation-delay: {p.delay}s"
    ></span>
  {/each}
</div>
