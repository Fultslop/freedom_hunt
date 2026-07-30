<script lang="ts">
  import type { HuntSummary as Summary } from "../utils/huntSummary";
  import "./HuntSummary.css";

  let { summary, projectName, cityLabel, organiser }: {
    summary: Summary | null;
    projectName: string;
    cityLabel: string;
    organiser: string;
  } = $props();

  function formatDistance(meters: number): string {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  function formatDuration(minutes: number): string {
    const hours = minutes / 60;
    return `~${hours % 1 === 0 ? hours : hours.toFixed(1)} hours`;
  }
</script>

<h2 class="hunt-summary__title">{projectName}</h2>
<p class="hunt-summary__help">
  {cityLabel} · hosted by {organiser}
</p>
{#if summary}
  <div class="hunt-summary__chips">
    <span class="hunt-summary__chip">{summary.stopCount} stops</span>
    {#if summary.distanceMeters !== null}
      <span class="hunt-summary__chip">{formatDistance(summary.distanceMeters)}</span>
    {/if}
    <span class="hunt-summary__chip">{formatDuration(summary.durationMinutes)}</span>
  </div>
{/if}
