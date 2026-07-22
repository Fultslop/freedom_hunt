<script lang="ts">
  import { push } from "svelte-spa-router";
  import { authStore } from "../../stores/authStore";
  import { titleBarStore } from "../../stores/titleBarStore";
  import { postUserLogin, postInviteAccept } from "../../utils/api";
  import "./EditorLoginPage.css";

  let email = $state("");
  let password = $state("");
  let error = $state<string | null>(null);
  let submitting = $state(false);

  titleBarStore.set({ title: "Sign in", progress: null, backPath: null });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = null;
    submitting = true;
    try {
      const data = await postUserLogin({ email, password });

      if (data.ok && data.userId) {
        authStore.loginEditor(
          data.userId,
          data.email ?? email,
          data.username ?? "",
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
              inviteData.username ?? data.username ?? "",
              inviteData.capabilities ?? [],
            );
          }
        }

        push("/editor");
      } else if (data.isBootstrap) {
        error = "This password is for maintainer bootstrap only. Please create a regular account.";
      } else {
        error = data.error ?? "Incorrect email or password.";
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
  <form onsubmit={handleSubmit} class="editor-login__form" aria-label="login">
    <div class="editor-login__field">
      <label class="editor-login__label" for="email">Email</label>
      <input
        id="email"
        type="email"
        bind:value={email}
        required
        class="editor-login__input"
      />
    </div>
    <div
      class={error
        ? "editor-login__field--last-error"
        : "editor-login__field--last"}
    >
      <label class="editor-login__label" for="password">Password</label>
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

  <div style="margin-top: 1.5rem; text-align: center; font-size: 0.875rem; color: var(--color-text-secondary);">
    Don't have an account? <a href="#/signup" style="color: var(--color-accent); text-decoration: none;">Create account</a>
  </div>

  {#if import.meta.env.DEV}
    <div class="editor-login__dev-hint">
      <div class="editor-login__dev-hint-title">Local dev setup</div>
      <p>Sign up at <code>#/signup</code>, then bootstrap organizer access:</p>
      <pre class="editor-login__dev-hint-code">npx wrangler kv key put "admin:democrats_abroad" "devpassword" \
  --binding AUTH_STORE --local</pre>
      <p>Then call <code>POST /auth/login</code> with the admin password to get a bootstrap token, and <code>POST /auth/bootstrap/promote</code> with your user_id.</p>
    </div>
  {/if}
</div>
