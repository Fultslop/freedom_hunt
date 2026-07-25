<script lang="ts">
  import { fetchGalleryPhotos } from "../utils/api";
  import type { GalleryPhoto } from "../types/gallery";
  import GalleryFilters from "./GalleryFilters.svelte";
  import PhotoThumb from "./PhotoThumb.svelte";
  import "./PhotoGallery.css";

  let {
    project,
    city,
    onSelectPhoto,
  }: {
    project: string;
    city: string;
    onSelectPhoto: (photo: GalleryPhoto) => void;
  } = $props();

  let photos = $state<GalleryPhoto[]>([]);
  let loaded = $state(false);
  let selectedTeam = $state("");
  let selectedTask = $state("");

  $effect(() => {
    let cancelled = false;
    fetchGalleryPhotos(project, city).then((data) => {
      if (!cancelled) {
        photos = data.ok && data.photos ? data.photos : [];
        loaded = true;
      }
    });
    return () => {
      cancelled = true;
    };
  });

  let teams = $derived([...new Set(photos.map((photo) => photo.teamName))].sort());
  let tasks = $derived([...new Set(photos.map((photo) => photo.taskTitle))].sort());

  let filteredPhotos = $derived(
    photos.filter(
      (photo) =>
        (selectedTeam === "" || photo.teamName === selectedTeam) &&
        (selectedTask === "" || photo.taskTitle === selectedTask),
    ),
  );
</script>

<div class="photo-gallery" id="gallery">
  <GalleryFilters
    {teams}
    {tasks}
    {selectedTeam}
    {selectedTask}
    onTeamChange={(value) => (selectedTeam = value)}
    onTaskChange={(value) => (selectedTask = value)}
  />

  {#if loaded && photos.length === 0}
    <p class="photo-gallery__empty">No photos yet.</p>
  {:else if loaded && filteredPhotos.length === 0}
    <p class="photo-gallery__empty">No photos match your filters.</p>
  {:else}
    <div class="photo-gallery__grid">
      {#each filteredPhotos as photo (photo.id)}
        <PhotoThumb {photo} onClick={() => onSelectPhoto(photo)} />
      {/each}
    </div>
  {/if}
</div>
