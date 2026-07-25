<script lang="ts">
  import { push } from "svelte-spa-router";
  import { authStore } from "../stores/authStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { postDemoSignup } from "../utils/api";
  import "./DemoSignupPage.css";

  const project = "demo";

  let email = $state("");
  let password = $state("");
  let error = $state<string | null>(null);
  let submitting = $state(false);
  let showPassword = $state(false);

  titleBarStore.set({ title: "Create account", progress: null, backPath: null });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = null;
    submitting = true;
    try {
      const data = await postDemoSignup({
        project,
        email,
        password,
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
        error = data.error ?? "Signup failed.";
      }
    } catch {
      error = "Connection error. Please try again.";
    } finally {
      submitting = false;
    }
  }
</script>

<div class="demo-signup">
  <div class="demo-signup__header">
    <div class="demo-signup__headline">Create account</div>
  </div>

  <form onsubmit={handleSubmit} class="demo-signup__form" aria-label="signup">
    <div class="demo-signup__field">
      <label class="demo-signup__label" for="email">Email</label>
      <input id="email" type="email" bind:value={email} required class="demo-signup__input" />
    </div>

    <div class="demo-signup__field">
      <label class="demo-signup__label" for="password">Password</label>
      <div class="demo-signup__password-wrap">
        <input
          id="password"
          type={showPassword ? "text" : "password"}
          bind:value={password}
          required
          minlength="8"
          class="demo-signup__input demo-signup__input--with-eye"
        />
        <button
          type="button"
          onclick={() => (showPassword = !showPassword)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          class="demo-signup__eye-btn"
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
      <div class="demo-signup__error">✕ {error}</div>
    {/if}

    <button type="submit" disabled={submitting} class="demo-signup__submit">
      {submitting ? "Creating account…" : "Create account"}
    </button>
  </form>

  <div class="demo-signup__footer">
    Already have an account? <a href="#/login/demo">Sign in</a>
  </div>
</div>
