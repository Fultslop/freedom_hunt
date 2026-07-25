<script lang="ts">
  import type { GalleryPhoto } from "../types/gallery";
  import "./PhotoLightbox.css";

  let { photo, onClose }: { photo: GalleryPhoto | null; onClose: () => void } = $props();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
    }
  }

  async function handleDownload() {
    if (photo) {
      const res = await fetch(photo.fullUrl);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${photo.teamName} - ${photo.taskTitle}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
      }
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
      <button class="photo-lightbox__download" onclick={handleDownload}>Download Photo</button>
    </div>
  </div>
{/if}
