# Task 10: InviteAcceptPage

**Files:**
- Create: `src/pages/InviteAcceptPage.svelte`
- Create: `src/pages/InviteAcceptPage.css`
- Create: `src/test/InviteAcceptPage.test.ts`

The invite accept page is the landing page for `#/invite/:token` links. It validates the token on mount, shows what project and capability the invite grants, and offers an Accept button. If the user is not logged in, it saves the token to `sessionStorage` and redirects to `#/editor/login`. If logged in, clicking Accept calls the invite accept endpoint directly.

---

- [ ] **Step 1: Write failing tests**

Create `src/test/InviteAcceptPage.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import InviteAcceptPage from "../pages/InviteAcceptPage.svelte";
import * as api from "../utils/api";
import { get } from "svelte/store";
import { authStore } from "../stores/authStore";

vi.mock("../utils/api");
vi.mock("svelte-spa-router", () => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("../stores/titleBarStore", () => ({
  titleBarStore: { set: vi.fn() },
}));

const { push, replace } = await import("svelte-spa-router");

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  authStore.setForTest({ activeAuth: null, authLoading: false, isLoggingOut: false });
});

describe("InviteAcceptPage — unauthenticated", () => {
  it("stores token in sessionStorage and redirects to /editor/login when not logged in", async () => {
    vi.mocked(api.fetchInviteToken).mockResolvedValue({
      ok: true, projectId: "proj", capability: "editor", expiresAt: 9999999999,
    });
    render(InviteAcceptPage, { params: { token: "tok123" } });
    await waitFor(() => {
      expect(sessionStorage.getItem("pendingInvite")).toBe("tok123");
      expect(replace).toHaveBeenCalledWith("/editor/login");
    });
  });
});

describe("InviteAcceptPage — authenticated", () => {
  beforeEach(() => {
    authStore.setForTest({
      activeAuth: { kind: "editor", userId: "u1", email: "a@b.com", username: "alice", capabilities: [] },
      authLoading: false,
      isLoggingOut: false,
    });
  });

  it("shows project and capability from a valid token", async () => {
    vi.mocked(api.fetchInviteToken).mockResolvedValue({
      ok: true, projectId: "democrats_abroad", capability: "editor", expiresAt: 9999999999,
    });
    render(InviteAcceptPage, { params: { token: "tok123" } });
    await waitFor(() => {
      expect(screen.getByText(/democrats_abroad/i)).toBeTruthy();
      expect(screen.getByText(/editor/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /accept/i })).toBeTruthy();
    });
  });

  it("calls postInviteAccept and navigates to /editor on accept", async () => {
    vi.mocked(api.fetchInviteToken).mockResolvedValue({
      ok: true, projectId: "proj", capability: "editor", expiresAt: 9999999999,
    });
    vi.mocked(api.postInviteAccept).mockResolvedValue({
      ok: true, capabilities: ["editor"], projectId: "proj",
    });
    render(InviteAcceptPage, { params: { token: "tok123" } });
    await waitFor(() => screen.getByRole("button", { name: /accept/i }));
    await fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    await waitFor(() => {
      expect(api.postInviteAccept).toHaveBeenCalledWith("tok123");
      expect(push).toHaveBeenCalledWith("/editor");
    });
  });

  it("shows an error message for an expired/invalid token", async () => {
    vi.mocked(api.fetchInviteToken).mockResolvedValue({
      ok: false, error: "Invite expired",
    });
    render(InviteAcceptPage, { params: { token: "badtok" } });
    await waitFor(() => {
      expect(screen.getByText(/invite expired/i)).toBeTruthy();
    });
  });
});
```

Run: `npm run test:run -- src/test/InviteAcceptPage.test.ts`
Expected: FAIL — `InviteAcceptPage.svelte` not found.

---

- [ ] **Step 2: Create `src/pages/InviteAcceptPage.css`**

```css
.invite {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
  min-height: 100vh;
  background: var(--color-background);
}

.invite__header {
  text-align: center;
  margin-bottom: 2rem;
}

.invite__eyebrow {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
}

.invite__headline {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
}

.invite__card {
  width: 100%;
  max-width: 360px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.invite__row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.invite__row-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.invite__row-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.invite__error {
  color: var(--color-error, #c0392b);
  font-size: 0.875rem;
  text-align: center;
}

.invite__loading {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  text-align: center;
}

.invite__accept {
  padding: 0.75rem;
  background: var(--color-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
}

.invite__accept:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

---

- [ ] **Step 3: Create `src/pages/InviteAcceptPage.svelte`**

```svelte
<script lang="ts">
  import { push, replace } from "svelte-spa-router";
  import { get } from "svelte/store";
  import { authStore } from "../stores/authStore";
  import { titleBarStore } from "../stores/titleBarStore";
  import { fetchInviteToken, postInviteAccept } from "../utils/api";
  import "./InviteAcceptPage.css";

  interface Props {
    params: { token: string };
  }
  const { params }: Props = $props();

  let loading = $state(true);
  let error = $state<string | null>(null);
  let projectId = $state<string | null>(null);
  let capability = $state<string | null>(null);
  let accepting = $state(false);

  titleBarStore.set({ title: "Join project", progress: null, backPath: null });

  $effect(() => {
    void validateToken();
  });

  async function validateToken() {
    loading = true;
    error = null;
    try {
      const data = await fetchInviteToken(params.token);
      if (!data.ok) {
        error = data.error ?? "Invalid invite link.";
        loading = false;
        return;
      }
      projectId = data.projectId ?? null;
      capability = data.capability ?? null;

      // If not logged in, save token and redirect to login
      const { activeAuth, authLoading } = get(authStore);
      if (!authLoading && !activeAuth) {
        sessionStorage.setItem("pendingInvite", params.token);
        replace("/editor/login");
        return;
      }
    } catch {
      error = "Connection error. Please try again.";
    }
    loading = false;
  }

  async function handleAccept() {
    accepting = true;
    error = null;
    try {
      const data = await postInviteAccept(params.token);
      if (data.ok) {
        push("/editor");
      } else {
        error = data.error ?? "Could not accept invite.";
      }
    } catch {
      error = "Connection error. Please try again.";
    } finally {
      accepting = false;
    }
  }
</script>

<div class="invite">
  <div class="invite__header">
    <div class="invite__eyebrow">Organiser tools</div>
    <div class="invite__headline">You've been invited</div>
  </div>

  {#if loading}
    <p class="invite__loading">Validating invite…</p>
  {:else if error}
    <p class="invite__error">✕ {error}</p>
  {:else}
    <div class="invite__card">
      <div class="invite__row">
        <div class="invite__row-label">Project</div>
        <div class="invite__row-value">{projectId}</div>
      </div>
      <div class="invite__row">
        <div class="invite__row-label">Access level</div>
        <div class="invite__row-value">{capability}</div>
      </div>
      <button
        class="invite__accept"
        disabled={accepting}
        onclick={handleAccept}
      >
        {accepting ? "Accepting…" : "Accept invitation"}
      </button>
    </div>
  {/if}
</div>
```

---

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- src/test/InviteAcceptPage.test.ts
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
git add src/pages/InviteAcceptPage.svelte src/pages/InviteAcceptPage.css src/test/InviteAcceptPage.test.ts
git commit -m "feat: add InviteAcceptPage — validates token, accepts invite, redirects unauthenticated users to login"
```
