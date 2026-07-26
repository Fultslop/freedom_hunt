<script lang="ts">
  import "./Toast.css";

  let {
    message,
    onDismiss,
    skipLabel = undefined,
    onSkip = undefined,
    autoDismissMs = 4000,
  }: {
    message: string;
    onDismiss: () => void;
    skipLabel?: string;
    onSkip?: () => void;
    autoDismissMs?: number;
  } = $props();

  $effect(() => {
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  });
</script>

<div class="toast" role="status">
  <p class="toast__message">{message}</p>
  <div class="toast__actions">
    {#if skipLabel && onSkip}
      <button class="toast__skip" onclick={onSkip}>{skipLabel}</button>
    {/if}
    <button class="toast__close" aria-label="Dismiss" onclick={onDismiss}>✕</button>
  </div>
</div>
