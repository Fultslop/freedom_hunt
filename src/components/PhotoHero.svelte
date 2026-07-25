<script lang="ts">
  import { fetchRandomPhotos } from "../utils/api";
  import type { GalleryPhoto } from "../types/gallery";
  import "./PhotoHero.css";

  let { project, city }: { project: string; city: string } = $props();

  const ROTATE_INTERVAL_MS = 3500;
  const MIN_PHOTOS_TO_SHOW = 3;

  let photos = $state<GalleryPhoto[]>([]);
  let currentIndex = $state(0);

  $effect(() => {
    let cancelled = false;
    fetchRandomPhotos(project, city).then((data) => {
      if (!cancelled && data.ok && data.photos) {
        photos = data.photos;
      }
    });
    return () => {
      cancelled = true;
    };
  });

  $effect(() => {
    if (photos.length < MIN_PHOTOS_TO_SHOW) {
      return undefined;
    }
    const timer = setInterval(() => {
      currentIndex = (currentIndex + 1) % photos.length;
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  });

  /** Deterministic per-photo tilt (-5deg to +5deg) so it doesn't jitter on rotation. */
  function tiltForPhoto(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) % 1000;
    }
    return (hash / 1000) * 10 - 5;
  }

  let currentPhoto = $derived(photos[currentIndex]);
  let shouldShow = $derived(photos.length >= MIN_PHOTOS_TO_SHOW && !!currentPhoto);
</script>

{#if shouldShow}
  <div class="photo-hero">
    <div
      class="photo-hero__polaroid"
      style="transform: rotate({tiltForPhoto(currentPhoto.id)}deg)"
      data-testid="photo-hero-card"
    >
      <img
        src={currentPhoto.mediumUrl}
        alt={currentPhoto.taskTitle}
        class="photo-hero__img"
      />
      <div class="photo-hero__caption">
        <div class="photo-hero__team">{currentPhoto.teamName}</div>
        <div class="photo-hero__task">{currentPhoto.taskTitle}</div>
      </div>
    </div>
  </div>
{/if}
