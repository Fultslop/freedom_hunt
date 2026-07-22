<script lang="ts">
  import { push, replace } from "svelte-spa-router";
  import { get } from "svelte/store";
  import { authStore } from "../stores/authStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { fetchInviteToken, postInviteAccept } from "../utils/api";
  import "./InviteAcceptPage.css";

  interface Props {
    params: { token: string };
  }
  const { params }: Props = $props();

  let loading = $state(true);
  let error = $state<string | null>(null);
  let projectId = $state<string | null>(null);
  let capability = $state<string | null>(null);
  let accepting = $state(false);

  titleBarStore.set({ title: "Join project", progress: null, backPath: null });

  $effect(() => {
    void validateToken();
  });

  async function validateToken() {
    loading = true;
    error = null;
    try {
      const data = await fetchInviteToken(params.token);
      if (!data.ok) {
        error = data.error ?? "Invalid invite link.";
        loading = false;
      } else {
        projectId = data.projectId ?? null;
        capability = data.capability ?? null;
        const { activeAuth, authLoading } = get(authStore);
        if (!authLoading && !activeAuth) {
          sessionStorage.setItem("pendingInvite", params.token);
          replace("/editor/login");
        } else {
          loading = false;
        }
      }
    } catch {
      error = "Connection error. Please try again.";
      loading = false;
    }
  }

  async function handleAccept() {
    accepting = true;
    error = null;
    try {
      const data = await postInviteAccept(params.token);
      if (data.ok) {
        if (data.userId) {
          authStore.loginEditor(
            data.userId,
            data.email ?? "",
            data.username ?? "",
            data.capabilities ?? [],
          );
        }
        push("/editor");
      } else {
        error = data.error ?? "Could not accept invite.";
      }
    } catch {
      error = "Connection error. Please try again.";
    } finally {
      accepting = false;
    }
  }
</script>

<div class="invite">
  <div class="invite__header">
    <div class="invite__eyebrow">Organiser tools</div>
    <div class="invite__headline">You've been invited</div>
  </div>

  {#if loading}
    <p class="invite__loading">Validating invite…</p>
  {:else if error}
    <p class="invite__error">✕ {error}</p>
  {:else}
    <div class="invite__card">
      <div class="invite__row">
        <div class="invite__row-label">Project</div>
        <div class="invite__row-value">{projectId}</div>
      </div>
      <div class="invite__row">
        <div class="invite__row-label">Access level</div>
        <div class="invite__row-value">{capability}</div>
      </div>
      <button
        class="invite__accept"
        disabled={accepting}
        onclick={handleAccept}
      >
        {accepting ? "Accepting…" : "Accept invitation"}
      </button>
    </div>
  {/if}
</div>
