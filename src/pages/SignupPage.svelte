<script lang="ts">
  import { push } from "svelte-spa-router";
  import { authStore } from "../stores/authStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { postSignup, postInviteAccept } from "../utils/api";
  import "./SignupPage.css";

  let email = $state("");
  let username = $state("");
  let password = $state("");
  let consentResults = $state(false);
  let consentMarketing = $state(false);
  let error = $state<string | null>(null);
  let submitting = $state(false);

  titleBarStore.set({ title: "Create account", progress: null, backPath: null });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = null;
    submitting = true;
    try {
      const data = await postSignup({
        email,
        username,
        password,
        email_consent_results: consentResults,
        email_consent_marketing: consentMarketing,
      });

      if (data.ok && data.userId) {
        authStore.loginEditor(
          data.userId,
          data.email ?? email,
          data.username ?? username,
          data.capabilities ?? [],
        );

        const pendingInvite = sessionStorage.getItem("pendingInvite");
        if (pendingInvite) {
          sessionStorage.removeItem("pendingInvite");
          const inviteData = await postInviteAccept(pendingInvite);
          if (inviteData.ok && inviteData.userId) {
            authStore.loginEditor(
              inviteData.userId,
              inviteData.email ?? data.email ?? email,
              inviteData.username ?? data.username ?? username,
              inviteData.capabilities ?? [],
            );
          }
        }

        push("/editor");
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

<div class="signup">
  <div class="signup__header">
    <div class="signup__eyebrow">Organiser tools</div>
    <div class="signup__headline">Create account</div>
  </div>

  <form onsubmit={handleSubmit} class="signup__form" aria-label="signup">
    <div class="signup__field">
      <label class="signup__label" for="email">Email</label>
      <input
        id="email"
        type="email"
        bind:value={email}
        required
        class={`signup__input${error ? " signup__input--error" : ""}`}
      />
    </div>

    <div class="signup__field">
      <label class="signup__label" for="username">Username</label>
      <input
        id="username"
        type="text"
        bind:value={username}
        required
        class="signup__input"
      />
    </div>

    <div class="signup__field">
      <label class="signup__label" for="password">Password</label>
      <input
        id="password"
        type="password"
        bind:value={password}
        required
        minlength="8"
        class={`signup__input${error ? " signup__input--error" : ""}`}
      />
    </div>

    <div class="signup__consent">
      <div class="signup__consent-label">Email preferences (optional)</div>
      <label class="signup__consent-row">
        <input type="checkbox" bind:checked={consentResults} />
        Notify me about hunt results
      </label>
      <label class="signup__consent-row">
        <input type="checkbox" bind:checked={consentMarketing} />
        Send me product updates
      </label>
    </div>

    {#if error}
      <div class="signup_error">✕ {error}</div>
    {/if}

    <button
      type="submit"
      disabled={submitting}
      class="signup__submit"
    >
      {submitting ? "Creating account…" : "Create account"}
    </button>
  </form>

  <div class="signup__footer">
    Already have an account? <a href="#/editor/login">Sign in</a>
  </div>
</div>
