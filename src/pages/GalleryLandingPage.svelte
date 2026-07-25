<script lang="ts">
  import { languageStore } from "../stores/languageStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { loadText } from "../utils/loadText";
  import PhotoHero from "../components/PhotoHero.svelte";
  import PhotoGallery from "../components/PhotoGallery.svelte";
  import PhotoLightbox from "../components/PhotoLightbox.svelte";
  import type { GalleryPhoto } from "../types/gallery";
  import type { ProjectMeta } from "../types/data";
  import "./GalleryLandingPage.css";

  let { params }: { params: { project: string; city: string } } = $props();

  let selectedPhoto = $state<GalleryPhoto | null>(null);
  let organizerUrl = $state<string | null>(null);

  $effect(() => {
    titleBarStore.set({
      title: `${params.city.replace(/_/g, " ")} Photos`,
      progress: null,
      backPath: `/${params.project}/${params.city}`,
    });
  });

  $effect(() => {
    const lang = $languageStore.currentLang;
    loadText<ProjectMeta>(lang, `projects/${params.project}/${params.project}`).then((data) => {
      const url = data?.organizer_url;
      organizerUrl = typeof url === "string" ? url : null;
    });
  });

  function scrollToGallery() {
    document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
  }

  function focusTeamFilter() {
    scrollToGallery();
    (document.getElementById("gallery-team-filter") as HTMLSelectElement | null)?.focus();
  }
</script>

<div class="gallery-landing">
  <header class="gallery-landing__header">
    <h1 class="gallery-landing__title">
      {params.project.replace(/_/g, " ")} Scavenger Hunt
    </h1>
    {#if organizerUrl}
      <a
        href={organizerUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="gallery-landing__organizer-link"
      >
        Event organizer ↗
      </a>
    {/if}
  </header>

  <PhotoHero project={params.project} city={params.city} />

  <div class="gallery-landing__ctas">
    <button class="gallery-landing__cta" onclick={scrollToGallery}>
      Browse All Photos
    </button>
    <button
      class="gallery-landing__cta gallery-landing__cta--secondary"
      onclick={focusTeamFilter}
    >
      Find / Download My Photos
    </button>
  </div>

  <PhotoGallery
    project={params.project}
    city={params.city}
    onSelectPhoto={(photo) => (selectedPhoto = photo)}
  />

  <PhotoLightbox photo={selectedPhoto} onClose={() => (selectedPhoto = null)} />
</div>
