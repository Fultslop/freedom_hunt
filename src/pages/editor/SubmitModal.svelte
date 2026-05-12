<script lang="ts">
  import "./SubmitModal.css";

  let {
    state,
    prTitle,
    isNewPr,
    existingPrUrl = undefined,
    newPrUrl = undefined,
    error = undefined,
    onBack,
    onRetry,
  }: {
    state: "submitting" | "success" | "failed";
    prTitle: string;
    isNewPr: boolean;
    existingPrUrl?: string;
    newPrUrl?: string;
    error?: string;
    onBack: () => void;
    onRetry: () => void;
  } = $props();

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  function extractPrNumber(url: string | undefined): string | null {
    if (!url) { return null; }
    const match = url.match(/\/pull\/(\d+)/);
    return match ? match[1] : null;
  }

  const existingPrNumber = $derived(extractPrNumber(existingPrUrl));
  const newPrNumber = $derived(extractPrNumber(newPrUrl));
</script>

<div class="submit-modal-backdrop" use:portal>
  <div class="submit-modal">
    {#if state === "submitting"}
      <h2 class="submit-modal__heading">Submitting form for review</h2>
      <p class="submit-modal__subtext">
        {#if isNewPr}
          Opening PR: "{prTitle}"
        {:else}
          Updating PR #{existingPrNumber}
        {/if}
      </p>
      <div class="submit-modal__progress"></div>
      <button
        class="submit-modal__btn submit-modal__btn--secondary"
        onclick={onBack}
      >
        ← Back to location list
      </button>
    {:else if state === "success"}
      <h2 class="submit-modal__heading submit-modal__heading--success">
        ✓ Form submitted for review
      </h2>
      <p class="submit-modal__subtext">
        {#if newPrUrl}
          <a
            href={newPrUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="submit-modal__pr-link"
          >
            PR #{newPrNumber}
            {isNewPr ? "opened" : "updated"} →
          </a>
        {/if}
      </p>
      <button
        class="submit-modal__btn submit-modal__btn--primary"
        onclick={onBack}
      >
        ← Back to location list
      </button>
    {:else}
      <h2 class="submit-modal__heading submit-modal__heading--failed">
        ✕ Submission failed
      </h2>
      <pre class="submit-modal__error">{error}</pre>
      <div class="submit-modal__actions">
        <button
          class="submit-modal__btn submit-modal__btn--secondary"
          onclick={onBack}
        >
          ← Back to list
        </button>
        <button
          class="submit-modal__btn submit-modal__btn--danger"
          onclick={onRetry}
        >
          ↺ Retry
        </button>
      </div>
    {/if}
  </div>
</div>
