<script lang="ts">
  import MarkdownText from "./MarkdownText.svelte";
  import "./CheckpointGateModal.css";

  let {
    message,
    mode,
    skippable = true,
    onStay,
    onProceed = undefined,
  }: {
    message: string;
    mode: "fail" | "succeed";
    skippable?: boolean;
    onStay: () => void;
    onProceed?: () => void;
  } = $props();

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  let showProceed = $derived(mode === "succeed" || (mode === "fail" && skippable));
</script>

<div class="checkpoint-gate-modal__overlay" use:portal>
  <div class="checkpoint-gate-modal__dialog" role="alertdialog" aria-modal="true">
    <div class="checkpoint-gate-modal__message">
      <MarkdownText text={message} />
    </div>
    <div class="checkpoint-gate-modal__actions">
      <button class="checkpoint-gate-modal__stay" onclick={onStay}>
        {mode === "fail" ? "Go Back" : "Cancel"}
      </button>
      {#if showProceed}
        <button class="checkpoint-gate-modal__proceed" onclick={onProceed}>
          {mode === "fail" ? "Skip" : "Continue"}
        </button>
      {/if}
    </div>
  </div>
</div>
