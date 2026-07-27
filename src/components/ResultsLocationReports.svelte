<script lang="ts">
  import type { ResultsSubmission } from "../types/results";
  import {
    completionCount,
    buildLocationReport,
    visibleFields,
    formatAnswerValue,
    type RouteLocationEntry,
  } from "../utils/resultsData";
  import "./ResultsLocationReports.css";

  let {
    routeId,
    entries,
    teams,
    submissions,
  }: {
    routeId: string;
    entries: RouteLocationEntry[];
    teams: string[];
    submissions: ResultsSubmission[];
  } = $props();

  function formatDatetime(seconds: number): string {
    return new Date(seconds * 1000).toLocaleString();
  }
</script>

<div class="results-location-reports">
  {#each entries as entry (entry.ordinal)}
    {@const completion = completionCount(entry, teams, submissions, routeId)}
    {@const report = buildLocationReport(entry, teams, submissions, routeId)}
    <details class="results-location-reports__item">
      <summary class="results-location-reports__summary">
        Location {entry.ordinal} — {entry.name} ({completion.answered}/{completion.total} teams answered)
      </summary>
      {#each report as row (row.teamName)}
        <div class="results-location-reports__team-block">
          <div class="results-location-reports__team-name">{row.teamName}</div>
          <div class="results-location-reports__time">{formatDatetime(row.submission.submittedAt)}</div>
          {#each visibleFields(entry.fields) as field (field.id)}
            <div class="results-location-reports__question">{field.label}</div>
            <div class="results-location-reports__answer">
              {formatAnswerValue(field, row.submission.answers[field.id ?? ""])}
            </div>
          {/each}
        </div>
      {/each}
    </details>
  {/each}
</div>
