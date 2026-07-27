<script lang="ts">
  import type { ResultsSubmission } from "../types/results";
  import { buildRouteGrid, type RouteLocationEntry, type GridRow } from "../utils/resultsData";
  import ResultsFilters from "./ResultsFilters.svelte";
  import "./ResultsTable.css";

  let {
    routeId,
    entries,
    teams,
    submissions,
    onView,
  }: {
    routeId: string;
    entries: RouteLocationEntry[];
    teams: string[];
    submissions: ResultsSubmission[];
    onView: (submission: ResultsSubmission, entry: RouteLocationEntry, submissionCount: number) => void;
  } = $props();

  let selectedTeam = $state("");
  let selectedOrdinal = $state("");
  let missingOnly = $state(false);

  let allRows = $derived(buildRouteGrid(entries, teams, submissions, routeId));

  let filteredRows = $derived(
    allRows.filter(
      (row) =>
        (selectedTeam === "" || row.teamName === selectedTeam) &&
        (selectedOrdinal === "" || String(row.ordinal) === selectedOrdinal) &&
        (!missingOnly || row.submission === undefined),
    ),
  );

  let filterLocations = $derived(
    entries.map((entry) => ({ ordinal: entry.ordinal, name: entry.name })),
  );

  function entryForOrdinal(ordinal: number): RouteLocationEntry {
    return entries.find((entry) => entry.ordinal === ordinal) as RouteLocationEntry;
  }

  function formatDatetime(seconds: number): string {
    return new Date(seconds * 1000).toLocaleString();
  }

  function handleView(row: GridRow) {
    const entry = entryForOrdinal(row.ordinal);
    onView(row.submission as ResultsSubmission, entry, row.submissionCount);
  }
</script>

<div class="results-table-wrap">
  <ResultsFilters
    teams={teams}
    locations={filterLocations}
    {selectedTeam}
    {selectedOrdinal}
    {missingOnly}
    onTeamChange={(value) => (selectedTeam = value)}
    onLocationChange={(value) => (selectedOrdinal = value)}
    onMissingOnlyChange={(value) => (missingOnly = value)}
  />

  <table class="results-table">
    <thead>
      <tr>
        <th>Team</th>
        <th>Datetime</th>
        <th>Location id</th>
        <th>Location name</th>
        <th>Answers</th>
      </tr>
    </thead>
    <tbody>
      {#each filteredRows as row (`${row.ordinal}-${row.teamName}`)}
        <tr>
          <td>{row.teamName}</td>
          <td>{row.submission ? formatDatetime(row.submission.submittedAt) : "-"}</td>
          <td>{row.ordinal}</td>
          <td>{row.locationName}</td>
          <td>
            {#if row.submission}
              <button
                class="results-table__view-button"
                onclick={() => handleView(row)}
              >
                View
              </button>
              {#if row.submissionCount > 1}
                <span class="results-table__edited-tag">(edited)</span>
              {/if}
            {:else}
              <span class="results-table__dash">-</span>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
