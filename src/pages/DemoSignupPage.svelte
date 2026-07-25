<script lang="ts">
  import { push } from "svelte-spa-router";
  import { authStore } from "../stores/authStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { postDemoSignup } from "../utils/api";
  import "./DemoSignupPage.css";

  let { params }: { params: { project: string } } = $props();

  let email = $state("");
  let teamName = $state("");
  let contact = $state("");
  let password = $state("");
  let error = $state<string | null>(null);
  let submitting = $state(false);

  titleBarStore.set({ title: "Create account", progress: null, backPath: null });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = null;
    submitting = true;
    try {
      const data = await postDemoSignup({
        project: params.project,
        email,
        teamName,
        contact: contact || undefined,
        password,
      });
      if (data.ok) {
        authStore.loginParticipant(
          params.project,
          data.teamName ?? teamName,
          data.contact ?? contact,
          data.isAdmin ?? false,
        );
        push(`/${params.project}`);
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
      <label class="demo-signup__label" for="teamName">Team name</label>
      <input id="teamName" type="text" bind:value={teamName} required class="demo-signup__input" />
    </div>

    <div class="demo-signup__field">
      <label class="demo-signup__label" for="contact">Contact <span class="demo-signup__label-note">(optional)</span></label>
      <input id="contact" type="email" bind:value={contact} class="demo-signup__input" />
    </div>

    <div class="demo-signup__field">
      <label class="demo-signup__label" for="password">Password</label>
      <input id="password" type="password" bind:value={password} required minlength="8" class="demo-signup__input" />
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
