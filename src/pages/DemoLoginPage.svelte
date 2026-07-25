<script lang="ts">
  import { push } from "svelte-spa-router";
  import { authStore } from "../stores/authStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { postLogin } from "../utils/api";
  import "./DemoLoginPage.css";

  const project = "demo";

  let email = $state("");
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
        project,
        teamName: "",
        contact: "",
        password,
        email,
      });
      if (data.ok) {
        authStore.loginParticipant(
          project,
          data.teamName ?? "",
          data.contact ?? "",
          data.isAdmin ?? false,
        );
        push(`/${project}`);
      } else {
        error = data.error || "Incorrect email or password.";
      }
    } catch {
      error = "Connection error. Please try again.";
    } finally {
      loading = false;
    }
  }
</script>

<div class="demo-login">
  <div class="demo-login__header">
    <div class="demo-login__headline">Sign in to Demo</div>
  </div>

  <form onsubmit={handleSubmit} class="demo-login__form">
    <div class="demo-login__field">
      <label class="demo-login__label" for="email">Email</label>
      <input
        id="email"
        type="email"
        bind:value={email}
        required
        class="demo-login__input"
      />
    </div>

    <div class="demo-login__field">
      <label class="demo-login__label" for="password">Password</label>
      <div class="demo-login__password-wrap">
        <input
          id="password"
          type={showPassword ? "text" : "password"}
          bind:value={password}
          required
          class="demo-login__input demo-login__input--with-eye"
        />
        <button
          type="button"
          onclick={() => (showPassword = !showPassword)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          class="demo-login__eye-btn"
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
      <div class="demo-login__error">✕ {error}</div>
    {/if}

    <button type="submit" disabled={loading} class="demo-login__submit">
      {loading ? "Signing in…" : "Sign in"}
    </button>
  </form>

  <div class="demo-login__footer">
    New here? <a href="#/signup/demo">Create an account</a>
  </div>
</div>
