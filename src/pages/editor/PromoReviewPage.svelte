<script lang="ts">
  import { fetchPromoReviewPhotos, postPromoApprove, type PromoReviewPhoto } from "../../utils/api";
  import "./PromoReviewPage.css";

  let { params }: { params: { project: string; city: string } } = $props();

  let photos = $state<PromoReviewPhoto[]>([]);

  $effect(() => {
    fetchPromoReviewPhotos(params.project, params.city).then((res) => {
      photos = res.photos ?? [];
    });
  });

  async function approve(photo: PromoReviewPhoto) {
    const res = await postPromoApprove(params.project, photo.team_name, photo.contact);
    if (res.ok) {
      photos = photos.filter((p) => p.team_name !== photo.team_name || p.contact !== photo.contact);
    }
  }
</script>

<div class="promo-review-page">
  <h1>Photo promotion review</h1>
  {#each photos as photo (photo.id)}
    <div class="promo-review-page__row">
      <img src={`/photos/${photo.id}/thumb`} alt={photo.task_title} class="promo-review-page__thumb" />
      <span class="promo-review-page__team">{photo.team_name}</span>
      <button type="button" onclick={() => approve(photo)}>Approve</button>
    </div>
  {/each}
  {#if photos.length === 0}
    <p>Nothing pending review.</p>
  {/if}
</div>
