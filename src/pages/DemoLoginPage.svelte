<script lang="ts">
  import { push } from "svelte-spa-router";
  import { authStore } from "../stores/authStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { postLogin } from "../utils/api";
  import "./DemoLoginPage.css";

  let { params }: { params: { project: string } } = $props();

  let email = $state("");
  let password = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  titleBarStore.set({ title: "Sign in", progress: null, backPath: null });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = null;
    loading = true;
    try {
      const data = await postLogin({
        project: params.project,
        teamName: "",
        contact: "",
        password,
        email,
      });
      if (data.ok) {
        authStore.loginParticipant(
          params.project,
          data.teamName ?? "",
          data.contact ?? "",
          data.isAdmin ?? false,
        );
        push(`/${params.project}`);
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
      <input
        id="password"
        type="password"
        bind:value={password}
        required
        class="demo-login__input"
      />
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
