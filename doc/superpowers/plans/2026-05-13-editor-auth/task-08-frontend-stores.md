# Task 08: Frontend — authStore, authGuards, api.ts

**Files:**
- Modify: `src/stores/authStore.ts`
- Modify: `src/utils/authGuards.ts`
- Modify: `src/utils/api.ts`
- Modify: `src/App.svelte`
- Modify: `src/test/stores.test.ts`
- Modify: `src/test/authGuards.test.ts`
- Modify: `src/test/api.test.ts` (if it exists)

`authStore` now handles two session shapes. A `pendingInvite` mechanism stores a token in `sessionStorage` so the login page can accept it automatically after login. `requireAdmin` is renamed to `requireEditorAccess`.

---

- [ ] **Step 1: Write failing tests for authStore and guards**

Add to `src/test/stores.test.ts` (after existing auth store tests):

```typescript
describe("authStore — editor session", () => {
  it("sets editor auth state from /auth/me editor response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        ok: true, userId: "u1", email: "a@b.com", username: "alice", capabilities: ["editor"],
      })),
    );
    await authStore.init();
    const state = get(authStore);
    expect(state.activeAuth?.kind).toBe("editor");
    if (state.activeAuth?.kind === "editor") {
      expect(state.activeAuth.capabilities).toContain("editor");
    }
  });

  it("sets participant auth state from /auth/me participant response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({
        ok: true, project: "p", teamName: "t", contact: "c", isAdmin: false,
      })),
    );
    await authStore.init();
    const state = get(authStore);
    expect(state.activeAuth?.kind).toBe("participant");
  });
});
```

Add to `src/test/authGuards.test.ts` (after existing tests):

```typescript
import { requireEditorAccess } from "../utils/authGuards";

describe("requireEditorAccess", () => {
  it("returns true when user has editor capability", () => {
    authStore.setForTest({
      activeAuth: { kind: "editor", userId: "u1", email: "a@b.com", username: "alice", capabilities: ["editor"] },
      authLoading: false,
      isLoggingOut: false,
    });
    expect(requireEditorAccess()).toBe(true);
  });

  it("returns true when user has organizer capability", () => {
    authStore.setForTest({
      activeAuth: { kind: "editor", userId: "u1", email: "a@b.com", username: "alice", capabilities: ["organizer"] },
      authLoading: false,
      isLoggingOut: false,
    });
    expect(requireEditorAccess()).toBe(true);
  });

  it("redirects and returns false when no capabilities", () => {
    authStore.setForTest({
      activeAuth: { kind: "editor", userId: "u1", email: "a@b.com", username: "alice", capabilities: [] },
      authLoading: false,
      isLoggingOut: false,
    });
    expect(requireEditorAccess()).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/editor/login");
  });

  it("redirects and returns false when no auth", () => {
    authStore.setForTest({ activeAuth: null, authLoading: false, isLoggingOut: false });
    expect(requireEditorAccess()).toBe(false);
  });
});
```

Run: `npm run test:run -- src/test/authGuards.test.ts`
Expected: FAIL — `requireEditorAccess` not exported.

---

- [ ] **Step 2: Replace `src/stores/authStore.ts`**

```typescript
import { writable, get } from "svelte/store";
import { replace } from "svelte-spa-router";
import type { AuthState, EditorAuthState, ParticipantAuthState } from "../types/auth";
import { fetchAuthMe, postLogin, postInviteAccept } from "../utils/api";

interface AuthStoreState {
  activeAuth: AuthState | null;
  authLoading: boolean;
  isLoggingOut: boolean;
}

function createAuthStore() {
  const {
    subscribe,
    set,
    update: upd,
  } = writable<AuthStoreState>({
    activeAuth: null,
    authLoading: true,
    isLoggingOut: false,
  });

  async function init() {
    try {
      const data = await fetchAuthMe();
      if (data.ok) {
        if (data.userId) {
          // Editor/user session
          const editorAuth: EditorAuthState = {
            kind: "editor",
            userId: data.userId,
            email: data.email ?? "",
            username: data.username ?? "",
            capabilities: data.capabilities ?? [],
          };
          upd((state) => ({ ...state, activeAuth: editorAuth }));
        } else if (data.project) {
          // Participant session
          const participantAuth: ParticipantAuthState = {
            kind: "participant",
            projectId: data.project,
            teamName: data.teamName ?? "",
            contact: data.contact ?? null,
            isAdmin: data.isAdmin ?? false,
          };
          upd((state) => ({ ...state, activeAuth: participantAuth }));
        }
      }
    } catch {
      /* ignore network errors on auth check */
    }
    upd((state) => ({ ...state, authLoading: false }));
  }

  function loginEditor(
    userId: string,
    email: string,
    username: string,
    capabilities: string[],
  ) {
    const editorAuth: EditorAuthState = { kind: "editor", userId, email, username, capabilities };
    upd((state) => ({ ...state, activeAuth: editorAuth }));
  }

  function loginParticipant(
    projectId: string,
    teamName: string,
    contact: string,
    isAdmin = false,
  ) {
    const participantAuth: ParticipantAuthState = { kind: "participant", projectId, teamName, contact, isAdmin };
    upd((state) => ({ ...state, activeAuth: participantAuth }));
  }

  async function logout() {
    upd((state) => ({ ...state, isLoggingOut: true }));
    try {
      await fetch("/auth/logout", { method: "POST" });
    } catch {
      /* ignore logout errors */
    }
    set({ activeAuth: null, authLoading: false, isLoggingOut: false });
    replace("/");
  }

  // Exposed for tests only
  function setForTest(state: AuthStoreState) {
    set(state);
  }

  return { subscribe, init, loginEditor, loginParticipant, logout, setForTest };
}

export const authStore = createAuthStore();
```

---

- [ ] **Step 3: Replace `src/utils/authGuards.ts`**

```typescript
import { get } from "svelte/store";
import { replace } from "svelte-spa-router";
import { authStore } from "../stores/authStore";

export function requireAuth(detail: {
  params?: Record<string, string> | null;
}): boolean {
  const { activeAuth, authLoading, isLoggingOut } = get(authStore);
  if (authLoading || isLoggingOut) return true;
  if (!activeAuth) {
    replace(`/login/${detail.params?.project ?? ""}`);
    return false;
  }
  return true;
}

export function requireEditorAccess(): boolean {
  const { activeAuth, authLoading, isLoggingOut } = get(authStore);
  if (authLoading || isLoggingOut) return true;
  if (!activeAuth || activeAuth.kind !== "editor") {
    replace("/editor/login");
    return false;
  }
  const hasAccess =
    activeAuth.capabilities.includes("editor") ||
    activeAuth.capabilities.includes("organizer");
  if (!hasAccess) {
    replace("/editor/login");
    return false;
  }
  return true;
}
```

---

- [ ] **Step 4: Add new API functions to `src/utils/api.ts`**

Add the following sections after the existing Auth section:

```typescript
// ---------------------------------------------------------------------------
// Auth — new user / invite endpoints
// ---------------------------------------------------------------------------

export interface SignupPayload {
  email: string;
  username: string;
  password: string;
  email_consent_results?: boolean;
  email_consent_marketing?: boolean;
}

export interface SignupResponse {
  ok: boolean;
  userId?: string;
  email?: string;
  username?: string;
  capabilities?: string[];
  error?: string;
}

export async function postSignup(payload: SignupPayload): Promise<SignupResponse> {
  const res = await fetch("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<SignupResponse>;
}

export interface UserLoginPayload {
  email: string;
  password: string;
}

export interface UserLoginResponse {
  ok: boolean;
  userId?: string;
  email?: string;
  username?: string;
  capabilities?: string[];
  isBootstrap?: boolean;
  project?: string;
  error?: string;
}

export async function postUserLogin(payload: UserLoginPayload): Promise<UserLoginResponse> {
  const res = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<UserLoginResponse>;
}

export interface InviteTokenInfo {
  ok: boolean;
  projectId?: string;
  capability?: string;
  expiresAt?: number;
  error?: string;
}

export async function fetchInviteToken(token: string): Promise<InviteTokenInfo> {
  const res = await fetch(`/auth/invite/${token}`);
  return res.json() as Promise<InviteTokenInfo>;
}

export interface InviteAcceptResponse {
  ok: boolean;
  projectId?: string;
  capabilities?: string[];
  error?: string;
}

export async function postInviteAccept(token: string): Promise<InviteAcceptResponse> {
  const res = await fetch("/auth/invite/accept", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return res.json() as Promise<InviteAcceptResponse>;
}

export interface InviteCreateResponse {
  ok: boolean;
  token?: string;
  inviteUrl?: string;
  error?: string;
}

export async function postInviteCreate(
  projectId: string,
  capability = "editor",
): Promise<InviteCreateResponse> {
  const res = await fetch("/auth/invite/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id: projectId, capability }),
  });
  return res.json() as Promise<InviteCreateResponse>;
}

// Also update AuthMeResponse to include editor fields:
```

Replace the existing `AuthMeResponse` interface:

```typescript
export interface AuthMeResponse {
  ok: boolean;
  // Editor/user session
  userId?: string;
  email?: string;
  username?: string;
  capabilities?: string[];
  // Participant session (unchanged)
  project?: string;
  teamName?: string;
  contact?: string;
  isAdmin?: boolean;
  error?: string;
}
```

---

- [ ] **Step 5: Update `src/App.svelte` — rename guard, add new routes**

Change the module script export and import:

```typescript
// In the <script lang="ts" module> block:
export { requireAuth, requireEditorAccess } from "./utils/authGuards";
```

Change the import in the main script:

```typescript
import { requireAuth, requireEditorAccess } from "./utils/authGuards";
import SignupPage from "./pages/SignupPage.svelte";
import InviteAcceptPage from "./pages/InviteAcceptPage.svelte";
```

Update the routes object — replace `requireAdmin` with `requireEditorAccess` and add new routes:

```typescript
const routes = {
  "/": asRoute(AppPage),
  "/login/:project": asRoute(LoginPage),
  "/signup": asRoute(SignupPage),
  "/invite/:token": asRoute(InviteAcceptPage),
  "/editor/login": asRoute(EditorLoginPage),
  "/editor": wrap({
    component: asRoute(EditorPage),
    conditions: [requireEditorAccess],
  }),
  "/editor/locations/:project/:city": wrap({
    component: asRoute(EditorLocationList),
    conditions: [requireEditorAccess],
  }),
  "/editor/locations/:project/:city/new/:newId": wrap({
    component: asRoute(EditorLocationForm),
    conditions: [requireEditorAccess],
  }),
  "/editor/locations/:project/:city/edit/:filename": wrap({
    component: asRoute(EditorLocationForm),
    conditions: [requireEditorAccess],
  }),
  "/:project": wrap({
    component: asRoute(ProjectPage),
    conditions: [requireAuth],
  }),
  "/:project/:city": wrap({
    component: asRoute(CityPage),
    conditions: [requireAuth],
  }),
  "/:project/:city/:route": wrap({
    component: asRoute(RoutePage),
    conditions: [requireAuth],
  }),
};
```

> Note: `SignupPage` and `InviteAcceptPage` don't exist yet — they are created in Tasks 09 and 10. TypeScript will error until then. If needed, temporarily comment out those two import lines and routes until those tasks are done.

---

- [ ] **Step 6: Run tests**

```bash
npm run test:run -- src/test/stores.test.ts src/test/authGuards.test.ts
```

Expected: new tests pass; existing tests adjusted for renamed API (`loginEditor` / `loginParticipant` instead of `login`).

> **Note:** Existing tests that call `authStore.login(...)` will need to be updated to `authStore.loginEditor(...)` or `authStore.loginParticipant(...)`. Search for `authStore.login(` in the test files and update each call.

---

- [ ] **Step 7: Run full suite**

```bash
npm run test:run
```

Expected: all tests pass.

---

- [ ] **Step 8: Commit**

```bash
git add src/stores/authStore.ts src/utils/authGuards.ts src/utils/api.ts src/App.svelte src/test/stores.test.ts src/test/authGuards.test.ts
git commit -m "feat: update authStore for dual session shapes, rename requireAdmin to requireEditorAccess, add new API functions"
```
