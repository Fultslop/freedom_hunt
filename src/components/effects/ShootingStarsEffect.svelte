<script lang="ts">
  import "./ShootingStarsEffect.css";

  const STAR_COUNT = 6;

  const stars = Array.from({ length: STAR_COUNT }, (_unused, i) => ({
    top: (i / STAR_COUNT) * 70 + Math.random() * 10,
    left: Math.random() * 40,
    delay: i * 0.25 + Math.random() * 0.2,
    duration: 0.9 + Math.random() * 0.4,
  }));
</script>

<div class="shooting-stars-effect" aria-hidden="true">
  {#each stars as s, i (i)}
    <span
      class="shooting-stars-effect__star"
      style="top: {s.top}%; left: {s.left}%; animation-duration: {s.duration}s; animation-delay: {s.delay}s"
    ></span>
  {/each}
</div>
