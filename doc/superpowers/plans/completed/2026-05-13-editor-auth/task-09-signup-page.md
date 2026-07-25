# Task 09: SignupPage

**Files:**
- Create: `src/pages/SignupPage.svelte`
- Create: `src/pages/SignupPage.css`
- Create: `src/test/SignupPage.test.ts`

The signup page mirrors `EditorLoginPage` in structure. After a successful signup, if `sessionStorage` has a `pendingInvite` key, the page calls `POST /auth/invite/accept` automatically before redirecting to `/editor`.

---

- [ ] **Step 1: Write failing tests**

Create `src/test/SignupPage.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import SignupPage from "../pages/SignupPage.svelte";
import * as api from "../utils/api";

vi.mock("../utils/api");
vi.mock("svelte-spa-router", () => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("../stores/authStore", () => ({
  authStore: { loginEditor: vi.fn(), subscribe: vi.fn(() => () => {}) },
}));
vi.mock("../stores/titleBarStore", () => ({
  titleBarStore: { set: vi.fn() },
}));

const { push } = await import("svelte-spa-router");

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("SignupPage", () => {
  it("renders email, username, password fields and two consent checkboxes", () => {
    render(SignupPage);
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/username/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
    expect(screen.getByLabelText(/hunt results/i)).toBeTruthy();
    expect(screen.getByLabelText(/product updates/i)).toBeTruthy();
  });

  it("submits signup and navigates to /editor on success", async () => {
    vi.mocked(api.postSignup).mockResolvedValue({
      ok: true, userId: "u1", email: "a@b.com", username: "alice", capabilities: [],
    });
    render(SignupPage);
    await fireEvent.input(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    await fireEvent.input(screen.getByLabelText(/username/i), { target: { value: "alice" } });
    await fireEvent.input(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    await fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => {
      expect(api.postSignup).toHaveBeenCalledWith(expect.objectContaining({
        email: "a@b.com", username: "alice", password: "password123",
      }));
      expect(push).toHaveBeenCalledWith("/editor");
    });
  });

  it("shows an error on signup failure", async () => {
    vi.mocked(api.postSignup).mockResolvedValue({ ok: false, error: "Email already registered" });
    render(SignupPage);
    await fireEvent.input(screen.getByLabelText(/email/i), { target: { value: "x@b.com" } });
    await fireEvent.input(screen.getByLabelText(/username/i), { target: { value: "x" } });
    await fireEvent.input(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    await fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeTruthy();
    });
  });

  it("accepts a pending invite after signup and navigates to /editor", async () => {
    sessionStorage.setItem("pendingInvite", "tok123");
    vi.mocked(api.postSignup).mockResolvedValue({
      ok: true, userId: "u1", email: "a@b.com", username: "alice", capabilities: [],
    });
    vi.mocked(api.postInviteAccept).mockResolvedValue({ ok: true, capabilities: ["editor"] });
    render(SignupPage);
    await fireEvent.input(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    await fireEvent.input(screen.getByLabelText(/username/i), { target: { value: "alice" } });
    await fireEvent.input(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    await fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => {
      expect(api.postInviteAccept).toHaveBeenCalledWith("tok123");
      expect(sessionStorage.getItem("pendingInvite")).toBeNull();
      expect(push).toHaveBeenCalledWith("/editor");
    });
  });

  it("has a link to the login page", () => {
    render(SignupPage);
    expect(screen.getByText(/sign in/i)).toBeTruthy();
  });
});
```

Run: `npm run test:run -- src/test/SignupPage.test.ts`
Expected: FAIL — `SignupPage.svelte` not found.

---

- [ ] **Step 2: Create `src/pages/SignupPage.css`**

```css
.signup {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
  min-height: 100vh;
  background: var(--color-background);
}

.signup__header {
  text-align: center;
  margin-bottom: 2rem;
}

.signup__eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
}

.signup__headline {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
}

.signup__form {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.signup__field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.signup__label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}

.signup__input {
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 1rem;
}

.signup__input--error {
  border-color: var(--color-error, #c0392b);
}

.signup__consent {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
}

.signup__consent-label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.25rem;
}

.signup__consent-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text);
}

.signup__error {
  color: var(--color-error, #c0392b);
  font-size: 0.875rem;
}

.signup__submit {
  padding: 0.75rem;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.signup__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.signup__footer {
  margin-top: 1.5rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  text-align: center;
}

.signup__footer a {
  color: var(--color-accent);
  text-decoration: none;
}
```

---

- [ ] **Step 3: Create `src/pages/SignupPage.svelte`**

```svelte
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
          await postInviteAccept(pendingInvite);
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
      <div class="signup__error">✕ {error}</div>
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
```

---

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- src/test/SignupPage.test.ts
```

Expected: all tests pass.

---

- [ ] **Step 5: Run full suite**

```bash
npm run test:run
```

Expected: all tests pass.

---

- [ ] **Step 6: Commit**

```bash
git add src/pages/SignupPage.svelte src/pages/SignupPage.css src/test/SignupPage.test.ts
git commit -m "feat: add SignupPage with GDPR consent checkboxes and pending invite acceptance"
```
