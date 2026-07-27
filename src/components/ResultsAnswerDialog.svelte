<script lang="ts">
  import type { ResultsSubmission } from "../types/results";
  import type { FormField } from "../types/data";
  import { visibleFields, formatAnswerValue } from "../utils/resultsData";
  import "./ResultsAnswerDialog.css";

  let {
    submission,
    fields,
    submissionCount,
    onClose,
  }: {
    submission: ResultsSubmission | null;
    fields: FormField[];
    submissionCount: number;
    onClose: () => void;
  } = $props();

  let hasPhotoField = $derived(fields.some((field) => field.type === "photo"));
</script>

{#if submission}
  <div class="results-answer-dialog" role="dialog" aria-modal="true" aria-label={submission.teamName}>
    <button
      class="results-answer-dialog__backdrop"
      aria-label="Close"
      onclick={onClose}
    ></button>
    <div class="results-answer-dialog__content">
      <button class="results-answer-dialog__close" onclick={onClose} aria-label="Close">✕</button>
      <div class="results-answer-dialog__team">{submission.teamName}</div>

      {#each visibleFields(fields) as field (field.id)}
        <div class="results-answer-dialog__qa">
          <span class="results-answer-dialog__question">{field.label}</span>
          <span class="results-answer-dialog__answer">
            {formatAnswerValue(field, submission.answers[field.id ?? ""])}
          </span>
        </div>
      {/each}

      {#if hasPhotoField}
        <p class="results-answer-dialog__photo-note">
          Photo answers aren't shown here — see the Gallery page for uploaded photos.
        </p>
      {/if}

      <p class="results-answer-dialog__footer">
        Submission: {submission.id}
        {#if submissionCount > 1}
          (latest of {submissionCount})
        {/if}
      </p>
    </div>
  </div>
{/if}
