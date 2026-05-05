<script lang="ts">
  import { push } from "svelte-spa-router";
  import { authStore } from "../../stores/authStore";
  import { titleBarStore } from "../../stores/titleBarStore";
  import "./EditorPage.css";

  titleBarStore.set({ title: "Editor", progress: null, backPath: null });

  let project = $derived($authStore.activeAuth?.projectId ?? "democrats_abroad");
</script>

<div class="editor-page">
  <h1 class="editor-page__title">Organiser tools</h1>
  <p class="editor-page__subtitle">{project.replace(/_/g, " ")}</p>

  <div class="editor-page__tiles">
    <div class="editor-page__tile editor-page__tile--disabled">
      <div class="editor-page__tile-name">Cities</div>
      <div class="editor-page__tile-desc">Add or edit city entries</div>
      <span class="editor-page__tile-tag">Coming soon</span>
    </div>

    <div class="editor-page__tile editor-page__tile--disabled">
      <div class="editor-page__tile-name">Routes</div>
      <div class="editor-page__tile-desc">Define which locations belong to each route</div>
      <span class="editor-page__tile-tag">Coming soon</span>
    </div>

    <button
      class="editor-page__tile"
      onclick={() => push(`/editor/locations/${project}/den_haag`)}
    >
      <div class="editor-page__tile-name">Locations</div>
      <div class="editor-page__tile-desc">Add, edit, or hide individual hunt locations</div>
    </button>
  </div>
</div>
