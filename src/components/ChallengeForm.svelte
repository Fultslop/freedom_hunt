<script lang="ts">
  import { Flag } from "lucide-svelte";
  import { authStore } from "../stores/authStore";
  import type { FormField } from "../types/data";
  import { postFormSubmit, postPhotoUpload } from "../utils/api";
  import AppForm from "./AppForm.svelte";
  import "./ChallengeForm.css";

  let {
    form,
    locationId,
    routeId = undefined,
  }: { form: FormField[]; locationId: number; routeId?: string } = $props();

  let submitted = $state(false);

  async function handleSubmit(values: Record<string, unknown>) {
    const data = await postFormSubmit({
      locationId,
      routeId,
      teamName: $authStore.activeAuth?.teamName ?? "",
      contact: $authStore.activeAuth?.contact ?? "",
      answers: values,
    });
    if (!data.ok) { throw new Error("Submission failed"); }
  }

  async function handlePhotoUpload(file: File): Promise<{ ok: boolean }> {
    return postPhotoUpload(locationId, file);
  }
</script>

<div class="challenge-form">
  {#if submitted}
    <p class="cf-success">Submitted! ✓</p>
  {:else}
    <div class="cf-divider" aria-hidden="true">
      <span class="cf-divider__line"></span>
      <Flag size={12} aria-hidden="true" />
      <span class="cf-divider__line"></span>
    </div>

    <AppForm
      fields={form}
      onSubmit={handleSubmit}
      onPhotoUpload={handlePhotoUpload}
      onSuccess={() => (submitted = true)}
      confirmMessage="Submit your answers?"
      submitLabel="Submit"
    />

    <div class="cf-divider" aria-hidden="true">
      <span class="cf-divider__line"></span>
      <Flag size={12} aria-hidden="true" />
      <span class="cf-divider__line"></span>
    </div>
  {/if}
</div>
