# Task 11: EditorLoginPage + EditorPage Updates

**Files:**
- Modify: `src/pages/editor/EditorLoginPage.svelte`
- Modify: `src/pages/editor/EditorPage.svelte`
- Modify: `src/test/EditorLoginPage.test.ts`
- Modify: `src/test/EditorPage.test.ts`

EditorLoginPage gets:
1. Email-based login (replacing the project+password form for editor sessions)
2. A "Sign up" link
3. Pending invite acceptance after successful login

EditorPage gets an "Invite editor" button that calls `POST /auth/invite/create` and shows the copyable link.

---

- [ ] **Step 1: Write failing tests**

Add to `src/test/EditorLoginPage.test.ts`:

```typescript
describe("EditorLoginPage — new fields", () => {
  it("renders email and password fields (not project field for editor login)", () => {
    render(EditorLoginPage);
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
  });

  it("has a link to the signup page", () => {
    render(EditorLoginPage);
    expect(screen.getByText(/create account/i)).toBeTruthy();
  });

  it("accepts a pending invite after login", async () => {
    sessionStorage.setItem("pendingInvite", "tok456");
    vi.mocked(api.postUserLogin).mockResolvedValue({
      ok: true, userId: "u1", email: "a@b.com", username: "alice", capabilities: ["editor"],
    });
    vi.mocked(api.postInviteAccept).mockResolvedValue({ ok: true, capabilities: ["editor"] });
    render(EditorLoginPage);
    await fireEvent.input(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    await fireEvent.input(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    await fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => {
      expect(api.postInviteAccept).toHaveBeenCalledWith("tok456");
      expect(sessionStorage.getItem("pendingInvite")).toBeNull();
    });
  });
});
```

Add to `src/test/EditorPage.test.ts`:

```typescript
describe("EditorPage — invite editor", () => {
  it("shows the Invite editor button", async () => {
    // Set up auth store with organizer capability
    authStore.setForTest({
      activeAuth: { kind: "editor", userId: "u1", email: "a@b.com", username: "alice", capabilities: ["organizer"] },
      authLoading: false,
      isLoggingOut: false,
    });
    render(EditorPage, { params: { project: "democrats_abroad" } });
    await waitFor(() => {
      expect(screen.getByText(/invite editor/i)).toBeTruthy();
    });
  });

  it("shows the invite URL after clicking the button", async () => {
    authStore.setForTest({
      activeAuth: { kind: "editor", userId: "u1", email: "a@b.com", username: "alice", capabilities: ["organizer"] },
      authLoading: false,
      isLoggingOut: false,
    });
    vi.mocked(api.postInviteCreate).mockResolvedValue({
      ok: true, token: "tok789", inviteUrl: "https://example.com/#/invite/tok789",
    });
    render(EditorPage, { params: { project: "democrats_abroad" } });
    await waitFor(() => screen.getByText(/invite editor/i));
    await fireEvent.click(screen.getByText(/invite editor/i));
    await waitFor(() => {
      expect(screen.getByText(/tok789/)).toBeTruthy();
    });
  });
});
```

Run: `npm run test:run -- src/test/EditorLoginPage.test.ts src/test/EditorPage.test.ts`
Expected: FAIL — new fields / button not yet present.

---

- [ ] **Step 2: Replace `src/pages/editor/EditorLoginPage.svelte`**

```svelte
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
          await postInviteAccept(pendingInvite);
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
```

---

- [ ] **Step 3: Add invite button to `src/pages/editor/EditorPage.svelte`**

Find the section in `EditorPage.svelte` where the page tiles/actions are listed. Add an "Invite editor" button that calls `postInviteCreate` and shows the result.

Add to the `<script>` block (imports and state):

```typescript
import { postInviteCreate } from "../../utils/api";
import { get } from "svelte/store";
import { authStore } from "../../stores/authStore";

let inviteUrl = $state<string | null>(null);
let inviteError = $state<string | null>(null);
let creatingInvite = $state(false);

async function handleInvite() {
  const { activeAuth } = get(authStore);
  if (!activeAuth || activeAuth.kind !== "editor") { return; }
  creatingInvite = true;
  inviteError = null;
  inviteUrl = null;
  try {
    const data = await postInviteCreate("democrats_abroad", "editor");
    if (data.ok && data.inviteUrl) {
      inviteUrl = data.inviteUrl;
    } else {
      inviteError = data.error ?? "Failed to create invite.";
    }
  } catch {
    inviteError = "Connection error.";
  } finally {
    creatingInvite = false;
  }
}
```

Add to the template, inside the editor page content area:

```svelte
<div class="editor-page__invite">
  <button
    class="editor-page__invite-btn"
    disabled={creatingInvite}
    onclick={handleInvite}
  >
    {creatingInvite ? "Generating…" : "Invite editor"}
  </button>
  {#if inviteUrl}
    <div class="editor-page__invite-url">
      <span>Share this link:</span>
      <code>{inviteUrl}</code>
    </div>
  {/if}
  {#if inviteError}
    <div class="editor-page__invite-error">✕ {inviteError}</div>
  {/if}
</div>
```

Add to `EditorPage.css`:

```css
.editor-page__invite {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.editor-page__invite-btn {
  padding: 0.625rem 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  font-size: 0.875rem;
  cursor: pointer;
  align-self: flex-start;
}

.editor-page__invite-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.editor-page__invite-url {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  word-break: break-all;
}

.editor-page__invite-url code {
  display: block;
  margin-top: 0.25rem;
  padding: 0.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-family: monospace;
}

.editor-page__invite-error {
  font-size: 0.875rem;
  color: var(--color-error, #c0392b);
}
```

---

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- src/test/EditorLoginPage.test.ts src/test/EditorPage.test.ts
```

Expected: all tests pass.

---

- [ ] **Step 5: Run full suite**

```bash
npm run test:run
```

Expected: all tests pass.

---

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

---

- [ ] **Step 7: Commit**

```bash
git add src/pages/editor/EditorLoginPage.svelte src/pages/editor/EditorPage.svelte src/test/EditorLoginPage.test.ts src/test/EditorPage.test.ts
git commit -m "feat: update editor login to email-based auth, add invite editor button to EditorPage"
```
