<script lang="ts">
  import { push } from "svelte-spa-router";
  import { authStore } from "../stores/authStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { postLogin } from "../utils/api";
  import "./LoginPage.css";

  let { params }: { params: { project: string } } = $props();

  let teamName = $state("");
  let contact = $state("");
  let password = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);
  let showPassword = $state(false);

  titleBarStore.set({ title: "Sign in", progress: null, backPath: null });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = null;
    loading = true;
    try {
      const data = await postLogin({
        project: params.project,
        teamName,
        contact,
        password,
      });
      if (data.ok) {
        authStore.login(
          params.project,
          data.teamName ?? teamName,
          data.contact ?? contact,
          data.isAdmin ?? false,
        );
        push(data.isAdmin ? "/editor" : `/${params.project}`);
      } else {
        error = data.error || "Incorrect password. Please try again.";
      }
    } catch {
      error = "Connection error. Please try again.";
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-page">
  <div class="login-page__header">
    <div class="login-page__project">{params.project.replace(/_/g, " ")}</div>
    <div class="login-page__headline">Start exploring</div>
    <div class="login-page__subtext">
      Enter your team details and the password<br />shared by your event
      organizer.
    </div>
  </div>

  <form
    onsubmit={(e) => {
      e.preventDefault();
      handleSubmit(e);
    }}
    class="login-page__form"
  >
    <div class="login-page__field">
      <label class="login-page__label" for="teamName">Team name</label>
      <input
        id="teamName"
        type="text"
        bind:value={teamName}
        required
        placeholder="Your team name"
        class="login-page__input"
      />
    </div>

    <div class="login-page__field">
      <label class="login-page__label" for="contact">
        Contact email <span class="login-page__label-note">(optional)</span>
      </label>
      <input
        id="contact"
        type="email"
        bind:value={contact}
        placeholder="you@example.com"
        class="login-page__input"
      />
    </div>

    <div
      class={error
        ? "login-page__field--last-error"
        : "login-page__field--last"}
    >
      <label class="login-page__label" for="password">Password</label>
      <div style="position: relative; width: 100%;">
        <input
          id="password"
          type={showPassword ? "text" : "password"}
          bind:value={password}
          required
          placeholder="Event password"
          class={`login-page__input${error ? " login-page__input--error" : ""}`}
          style="width: 100%; padding-right: 40px;"
        />
        <button
          type="button"
          onclick={() => (showPassword = !showPassword)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          class="login-page__eye-btn"
        >
          {#if showPassword}
            <!-- EyeOff icon -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
              /><line x1="1" y1="1" x2="23" y2="23" /></svg
            >
          {:else}
            <!-- Eye icon -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle
                cx="12"
                cy="12"
                r="3"
              /></svg
            >
          {/if}
        </button>
      </div>
    </div>

    {#if error}
      <div class="login-page__error">✕ {error}</div>
    {/if}

    <button
      type="submit"
      disabled={loading}
      class={`login-page__submit${loading ? " login-page__submit--loading" : ""}`}
    >
      {loading ? "Joining…" : "Join the Hunt"}
    </button>
  </form>
</div>
