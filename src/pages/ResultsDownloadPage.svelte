<script lang="ts">
  import { languageStore } from "../stores/languageStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { fetchResultsSubmissions } from "../utils/api";
  import { buildRouteIndex } from "../utils/resultsRouteIndex";
  import { buildResultsMarkdown } from "../utils/resultsMarkdown";
  import { teamsForRoute, type RouteIndex, type RouteLocationEntry } from "../utils/resultsData";
  import type { ResultsSubmission } from "../types/results";
  import type { FormField } from "../types/data";
  import ResultsTable from "../components/ResultsTable.svelte";
  import ResultsLocationReports from "../components/ResultsLocationReports.svelte";
  import ResultsAnswerDialog from "../components/ResultsAnswerDialog.svelte";
  import "./ResultsDownloadPage.css";

  let { params }: { params: { project: string; city: string } } = $props();

  let submissions = $state<ResultsSubmission[]>([]);
  let routeIndex = $state<RouteIndex>({});
  let loaded = $state(false);
  let dialogSubmission = $state<ResultsSubmission | null>(null);
  let dialogFields = $state<FormField[]>([]);
  let dialogCount = $state(0);

  $effect(() => {
    titleBarStore.set({
      title: `${params.city.replace(/_/g, " ")} Results`,
      progress: null,
      backPath: `/${params.project}/${params.city}`,
    });
  });

  $effect(() => {
    const lang = $languageStore.currentLang;
    Promise.all([
      fetchResultsSubmissions(params.project, params.city),
      buildRouteIndex(lang, params.project, params.city),
    ]).then(([submissionsRes, index]) => {
      submissions =
        submissionsRes.ok && submissionsRes.submissions ? submissionsRes.submissions : [];
      routeIndex = index;
      loaded = true;
    });
  });

  function openDialog(
    submission: ResultsSubmission,
    entry: RouteLocationEntry,
    submissionCount: number,
  ) {
    dialogSubmission = submission;
    dialogFields = entry.fields;
    dialogCount = submissionCount;
  }

  function closeDialog() {
    dialogSubmission = null;
  }

  function handleDownload() {
    const markdown = buildResultsMarkdown(params.project, params.city, routeIndex, submissions);
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${params.project}-${params.city}-results.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="results-download-page">
  <div class="results-download-page__header">
    <h1>{params.city.replace(/_/g, " ")} Results</h1>
    <button class="results-download-page__download-button" onclick={handleDownload}>
      Download
    </button>
  </div>

  {#if loaded && submissions.length === 0}
    <p class="results-download-page__empty">No results yet for this city.</p>
  {:else if loaded}
    {#each Object.entries(routeIndex) as [routeId, entries] (routeId)}
      {@const teams = teamsForRoute(submissions, routeId)}
      <section>
        <h2 class="results-download-page__route-heading">Route: {routeId.replace(/_/g, " ")}</h2>
        <ResultsTable {routeId} {entries} {teams} {submissions} onView={openDialog} />
        <ResultsLocationReports {routeId} {entries} {teams} {submissions} />
      </section>
    {/each}
  {/if}

  <ResultsAnswerDialog
    submission={dialogSubmission}
    fields={dialogFields}
    submissionCount={dialogCount}
    onClose={closeDialog}
  />
</div>
