<script lang="ts">
  import type { GalleryPhoto } from "../types/gallery";
  import "./PhotoLightbox.css";

  let { photo, onClose }: { photo: GalleryPhoto | null; onClose: () => void } = $props();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if photo}
  <div class="photo-lightbox" role="dialog" aria-modal="true" aria-label={photo.taskTitle}>
    <button
      class="photo-lightbox__backdrop"
      aria-label="Close photo preview"
      onclick={onClose}
    ></button>
    <div class="photo-lightbox__content">
      <button class="photo-lightbox__close" onclick={onClose} aria-label="Close">✕</button>
      <img src={photo.mediumUrl} alt={photo.taskTitle} class="photo-lightbox__img" />
      <div class="photo-lightbox__meta">
        <div class="photo-lightbox__team">{photo.teamName}</div>
        <div class="photo-lightbox__task">{photo.taskTitle}</div>
      </div>
      <a href={photo.fullUrl} download class="photo-lightbox__download">Download Photo</a>
    </div>
  </div>
{/if}
