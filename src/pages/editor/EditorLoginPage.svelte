<script lang="ts">
  import { push } from "svelte-spa-router";
  import { authStore } from "../../stores/authStore";
  import { titleBarStore } from "../../stores/titleBarStore";
  import "./EditorLoginPage.css";

  let project = $state("democrats_abroad");
  let password = $state("");
  let error = $state<string | null>(null);
  let submitting = $state(false);

  titleBarStore.set({ title: "Sign in", progress: null, backPath: null });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = null;
    submitting = true;
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, teamName: "", contact: "", password }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        isAdmin?: boolean;
        error?: string;
      };
      if (data.ok && data.isAdmin) {
        authStore.login(project, "", "", true);
        push("/editor");
      } else if (data.ok && !data.isAdmin) {
        error = "These credentials do not have organiser access.";
      } else {
        error = data.error ?? "Incorrect password.";
      }
    } catch {
      error = "Connection error. Please try again.";
    } finally {
      submitting = false;
    }
  }
</script>

<div class="editor-login">
  <div class="editor-login__header">
    <div class="editor-login__eyebrow">Organiser tools</div>
    <div class="editor-login__headline">Sign in</div>
  </div>
  <form onsubmit={handleSubmit} class="editor-login__form">
    <div class="editor-login__field">
      <label class="editor-login__label" for="project">Project</label>
      <input
        id="project"
        type="text"
        bind:value={project}
        required
        class="editor-login__input"
      />
    </div>
    <div
      class={error
        ? "editor-login__field--last-error"
        : "editor-login__field--last"}
    >
      <label class="editor-login__label" for="password">Admin password</label>
      <input
        id="password"
        type="password"
        bind:value={password}
        required
        class={`editor-login__input${error ? " editor-login__input--error" : ""}`}
      />
    </div>
    {#if error}
      <div class="editor-login__error">✕ {error}</div>
    {/if}
    <button
      type="submit"
      disabled={submitting}
      class={`editor-login__submit${submitting ? " editor-login__submit--loading" : ""}`}
    >
      {submitting ? "Signing in…" : "Sign in"}
    </button>
  </form>

  {#if import.meta.env.DEV}
    <div class="editor-login__dev-hint">
      <div class="editor-login__dev-hint-title">Local dev setup</div>
      <p>The editor requires an admin entry in the local KV store. Run this once:</p>
      <pre class="editor-login__dev-hint-code">npx wrangler kv key put "admin:democrats_abroad" "devpassword" \
  --binding AUTH_STORE --local</pre>
      <p>Then sign in with:</p>
      <ul>
        <li><strong>Project:</strong> democrats_abroad</li>
        <li><strong>Password:</strong> devpassword</li>
      </ul>
    </div>
  {/if}
</div>
