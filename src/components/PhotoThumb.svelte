<script lang="ts">
  import type { GalleryPhoto } from "../types/gallery";
  import "./PhotoThumb.css";

  let { photo, onClick }: { photo: GalleryPhoto; onClick: () => void } = $props();

  let fallbackUsed = $state(false);
  let src = $derived(fallbackUsed ? photo.fullUrl : photo.thumbUrl);

  function handleError() {
    fallbackUsed = true;
  }
</script>

<button class="photo-thumb" onclick={onClick} data-testid="photo-thumb">
  <img
    src={src}
    alt={photo.taskTitle}
    class="photo-thumb__img"
    onerror={handleError}
  />
  <div class="photo-thumb__caption">
    <span class="photo-thumb__team">{photo.teamName}</span>
    <span class="photo-thumb__task">{photo.taskTitle}</span>
  </div>
</button>
