<script lang="ts">
  import "./SourcedTextareaField.css";

  let {
    domId,
    value,
    hasError = false,
    describedBy = undefined,
    rows = 5,
    sourceValue,
    touched,
    onChange,
    onUpdateFromSource,
  }: {
    domId: string;
    value: string;
    hasError?: boolean;
    describedBy?: string;
    rows?: number;
    sourceValue: string | undefined;
    touched: boolean;
    onChange: (value: string) => void;
    onUpdateFromSource: () => void;
  } = $props();

  let showConfirm = $state(false);
</script>

<textarea
  id={domId}
  class="stf-textarea"
  class:stf-textarea--error={hasError}
  aria-describedby={describedBy}
  {rows}
  {value}
  oninput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
></textarea>

{#if touched && sourceValue !== undefined}
  {#if showConfirm}
    <div class="stf-confirm">
      <p class="stf-confirm-msg">Replace your edits with the latest source text? This can't be undone.</p>
      <div class="stf-confirm-actions">
        <button type="button" class="stf-confirm-cancel" onclick={() => (showConfirm = false)}>
          Cancel
        </button>
        <button
          type="button"
          class="stf-confirm-ok"
          onclick={() => {
            onUpdateFromSource();
            showConfirm = false;
          }}
        >
          Replace
        </button>
      </div>
    </div>
  {:else}
    <button type="button" class="stf-update-btn" onclick={() => (showConfirm = true)}>
      Update available
    </button>
  {/if}
{/if}
