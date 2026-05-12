<script lang="ts">
  import { onMount } from "svelte";
  import type { ImageEntry } from "../utils/images";
  import "./ImagePickerDialog.css";

  let {
    currentValue,
    images,
    onSelect,
    onCancel,
  }: {
    currentValue: string;
    images: ImageEntry[];
    onSelect: (filename: string) => void;
    onCancel: () => void;
  } = $props();

  let cancelBtn: HTMLButtonElement | undefined;

  const isNoneSelected = $derived(
    currentValue === "" || !images.find((img) => img.filename === currentValue),
  );

  onMount(() => {
    cancelBtn?.focus();
  });
</script>

<svelte:window onkeydown={(e) => { if (e.key === "Escape") { onCancel(); } }} />

<div class="ipd-overlay" role="dialog" aria-label="Pick an image">
  <div class="ipd-dialog">
    <div class="ipd-grid">
      <button
        type="button"
        class="ipd-tile"
        class:ipd-tile--selected={isNoneSelected}
        onclick={() => onSelect("")}
      >
        {#if isNoneSelected}
          <span class="ipd-tile__check" aria-hidden="true">✓</span>
        {/if}
        <div class="ipd-tile__none" aria-hidden="true">✕</div>
        <span class="ipd-tile__name">None</span>
      </button>

      {#each images as img (img.filename)}
        {@const isSelected = currentValue === img.filename}
        <button
          type="button"
          class="ipd-tile"
          class:ipd-tile--selected={isSelected}
          onclick={() => onSelect(img.filename)}
        >
          {#if isSelected}
            <span class="ipd-tile__check" aria-hidden="true">✓</span>
          {/if}
          <img src={img.url} alt={img.filename} class="ipd-tile__img" />
          <span class="ipd-tile__name" aria-hidden="true">{img.filename}</span>
        </button>
      {/each}
    </div>

    <div class="ipd-actions">
      <button
        type="button"
        class="ipd-cancel"
        onclick={onCancel}
        bind:this={cancelBtn}
      >
        Cancel
      </button>
    </div>
  </div>
</div>
