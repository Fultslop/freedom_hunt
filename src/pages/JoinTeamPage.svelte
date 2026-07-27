<script lang="ts">
  import { push } from "svelte-spa-router";
  import { Dice5 } from "lucide-svelte";
  import { authStore } from "../stores/authStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { postLogin } from "../utils/api";
  import { generateTeamName } from "../utils/teamNameGenerator";
  import "./JoinTeamPage.css";

  let { params }: { params: { project: string } } = $props();

  const teamNameKey = `teamName:${params.project}`;

  let teamName = $state(
    localStorage.getItem(teamNameKey) ?? generateTeamName(),
  );
  let error = $state<string | null>(null);
  let loading = $state(false);

  titleBarStore.set({ title: "Join the hunt", progress: null, backPath: null });

  function readPendingPassword(): string | null {
    const raw = sessionStorage.getItem("pendingHuntAuth");
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as { project?: string; password?: string };
      if (parsed.project !== params.project || !parsed.password) {
        return null;
      }
      return parsed.password;
    } catch {
      return null;
    }
  }

  $effect(() => {
    if (!readPendingPassword()) {
      push(`/login/${params.project}`);
    }
  });

  function rerollTeamName() {
    teamName = generateTeamName();
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const password = readPendingPassword();
    if (!password) {
      push(`/login/${params.project}`);
    } else {
      error = null;
      loading = true;
      try {
        const data = await postLogin({ project: params.project, teamName, password });
        if (data.ok) {
          authStore.loginParticipant(
            params.project,
            data.teamName ?? teamName,
            data.contact ?? "",
            data.isAdmin ?? false,
          );
          localStorage.setItem(teamNameKey, teamName);
          sessionStorage.removeItem("pendingHuntAuth");
          push(data.isAdmin ? "/editor" : `/${params.project}`);
        } else {
          error = data.error || "Something went wrong. Please try again.";
        }
      } catch {
        error = "Connection error. Please try again.";
      } finally {
        loading = false;
      }
    }
  }
</script>

<div class="join-team-page">
  <div class="join-team-page__header">
    <div class="join-team-page__headline">What's your team name?</div>
    <div class="join-team-page__subtext">
      Pick something your team will recognize on the leaderboard and photo
      gallery. Use the suggestion below or roll the dice for a new one.
    </div>
  </div>

  <form onsubmit={handleSubmit} class="join-team-page__form">
    <div
      class={error ? "join-team-page__field--error" : "join-team-page__field"}
    >
      <label class="join-team-page__label" for="teamName">Team name</label>
      <div class="join-team-page__input-row">
        <input
          id="teamName"
          type="text"
          bind:value={teamName}
          required
          placeholder="Your team name"
          class={`join-team-page__input${error ? " join-team-page__input--error" : ""}`}
        />
        <button
          type="button"
          onclick={rerollTeamName}
          aria-label="Suggest a new team name"
          class="join-team-page__dice-btn"
        >
          <Dice5 size={20} />
        </button>
      </div>
    </div>

    {#if error}
      <div class="join-team-page__error">✕ {error}</div>
    {/if}

    <button
      type="submit"
      disabled={loading}
      class={`join-team-page__submit${loading ? " join-team-page__submit--loading" : ""}`}
    >
      {loading ? "Joining…" : "Join the Hunt"}
    </button>
  </form>
</div>
