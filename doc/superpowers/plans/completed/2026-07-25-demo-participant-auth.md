# Demo Participant Auth Implementation Plan (Whitelist Email + Password)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** `doc/superpowers/plans/2026-07-25-demo-project-content.md` should be implemented first — the manual verification step here logs into the `demo` project, which needs its content to exist to be worth visiting (the auth mechanism itself doesn't technically depend on it).
>
> **Post-implementation bug found and fixed (2026-07-25):** Tasks 5–6's `DemoLoginPage.svelte`/`DemoSignupPage.svelte` code below reads `params.project`, assuming the component receives a `params` prop the same way `LoginPage.svelte` does. That's wrong for these two routes specifically — `/login/demo` and `/signup/demo` are literal paths with no `:project` segment, so `svelte-spa-router` never populates `params` for them at all, causing a `TypeError: params is undefined` the instant either page renders. The actual fix (applied directly to the components, not reflected in the code blocks below): drop the `params` prop entirely and use a local `const project = "demo";` instead, since these routes are only ever the `demo` project by construction. Both components' tests were also updated to stop passing a `params` prop the components no longer read.
>
> **Post-implementation change (2026-07-25):** `DemoSignupPage.svelte`'s `teamName`/`contact` fields were removed at the user's request — team name is meant to be set later, when a participant actually joins a specific project/city (not built yet, out of scope for this plan), and contact was judged redundant since email is already the signup identifier. `POST /auth/participant-signup` was relaxed to accept signup without either field, defaulting `team_name` to `""` and `contact` to the account's own email. `DemoSignupPayload` dropped both fields from its type. Not reflected in the Task 6 code block below.

**Goal:** Whitelisted email+password participant accounts for the `demo` project — a sign-up page gated by a pre-approved email list, and a matching login page — while `democrats_abroad` keeps its existing shared-team-password login untouched. One login covers all of `demo`'s cities (`den_haag`, `oslo`, `paris`, `new_york`), since they're all one project.

**Architecture:** Two new D1 tables (`participant_whitelist`, `participant_accounts`). A new `POST /auth/participant-signup` endpoint, and an additive branch inside the existing `POST /auth/login` handler. Both issue the *existing* `ParticipantTokenPayload` shape, so every already-working piece of participant-facing code (ChallengeForm, `requireParticipantForProject`, upload, gallery, the frontend `requireAuth` guard) needs zero changes. Two new frontend pages (`DemoLoginPage`, `DemoSignupPage`) on two new literal routes matched before the existing `/login/:project` wildcard.

**Tech Stack:** Existing stack — Cloudflare Workers, D1, Svelte 5, Vitest. Reuses `hashPassword`/`verifyPassword` (PBKDF2) already in `src/worker/db.ts` — no new hashing dependency.

## Global Constraints

- Every new participant session, regardless of which endpoint issued it, is a `ParticipantTokenPayload` (`{ project, teamName, contact, isAdmin: false, exp }`) — identical shape to the shared-password flow.
- `democrats_abroad` login requests never include an `email` field — the existing KV admin/participant path in `/auth/login` must remain byte-for-byte behaviorally unchanged for it.
- New literal routes (`/login/demo`, `/signup/demo`) must be declared **before** the existing `/login/:project` wildcard in `App.svelte`'s routes object, per the ordering rule already documented there for the gallery route.
- `participant_whitelist` and `participant_accounts` scope `email` per-`project_id` (not globally unique) — see spec's Data Model section for why.
- No admin UI for managing the whitelist — entries are added via direct `wrangler d1 execute` (documented in Task 6), matching how KV passwords are managed today.

---

### Task 1: D1 tables and `db.ts` helpers

**Files:**
- Create: `migrations/004_participant_auth.sql`
- Modify: `src/worker/db.ts`

**Interfaces:**
- Consumes: `hashPassword`, `verifyPassword` (existing).
- Produces: `getWhitelistEntry`, `getParticipantAccountByEmail`, `insertParticipantAccount`, consumed by Tasks 2–3.

- [ ] **Step 1: Write the migration**

`migrations/004_participant_auth.sql`:
```sql
CREATE TABLE IF NOT EXISTS participant_whitelist (
  email        TEXT NOT NULL,
  project_id   TEXT NOT NULL,
  added_at     INTEGER NOT NULL,
  PRIMARY KEY (email, project_id)
);

CREATE TABLE IF NOT EXISTS participant_accounts (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL,
  project_id     TEXT NOT NULL,
  team_name      TEXT NOT NULL,
  contact        TEXT,
  password_hash  TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  UNIQUE (email, project_id)
);
```

- [ ] **Step 2: Add types and helpers to `db.ts`**

Append to `src/worker/db.ts`:
```ts
// ---------------------------------------------------------------------------
// Participant whitelist / individual account queries
// ---------------------------------------------------------------------------

export interface DbParticipantAccount {
  id: string;
  email: string;
  project_id: string;
  team_name: string;
  contact: string | null;
  password_hash: string;
  created_at: number;
}

export async function getWhitelistEntry(
  database: D1Database,
  email: string,
  projectId: string,
): Promise<{ email: string; project_id: string } | null> {
  return database
    .prepare("SELECT * FROM participant_whitelist WHERE email = ? AND project_id = ?")
    .bind(email, projectId)
    .first();
}

export async function getParticipantAccountByEmail(
  database: D1Database,
  email: string,
  projectId: string,
): Promise<DbParticipantAccount | null> {
  return database
    .prepare("SELECT * FROM participant_accounts WHERE email = ? AND project_id = ?")
    .bind(email, projectId)
    .first<DbParticipantAccount>();
}

export async function insertParticipantAccount(
  database: D1Database,
  account: DbParticipantAccount,
): Promise<void> {
  await database
    .prepare(
      `INSERT INTO participant_accounts
       (id, email, project_id, team_name, contact, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      account.id, account.email, account.project_id, account.team_name,
      account.contact ?? null, account.password_hash, account.created_at,
    )
    .run();
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add migrations/004_participant_auth.sql src/worker/db.ts
git commit -m "feat: add participant_whitelist and participant_accounts D1 tables"
```

---

### Task 2: `POST /auth/participant-signup`

**Files:**
- Modify: `src/worker/routes/authRoutes.ts`
- Test: `src/test/worker.auth-user.test.ts` (extend — it already has the `makeKv`/`makeDb`/`makeEnv`/`makeRequest` helpers this needs; extend `makeDb` to also back `participant_whitelist`/`participant_accounts`)

**Interfaces:**
- Consumes: `getWhitelistEntry`, `getParticipantAccountByEmail`, `insertParticipantAccount`, `hashPassword` (Task 1); `checkOrigin`, `createToken`, `cookieHeader`, `TOKEN_TTL_SECONDS` (existing).
- Produces: no new exports — route handler, wired into the existing `handleAuthRoutes` chain.

- [ ] **Step 1: Extend the test file's `makeDb` to back the two new tables**

In `src/test/worker.auth-user.test.ts`, extend `makeDb` (or add a second helper, matching the existing file's style) to accept `whitelist: any[] = []` and `participants: any[] = []`, and route `sql.includes("FROM participant_whitelist")`, `sql.includes("FROM participant_accounts")`, `sql.startsWith("INSERT INTO participant_accounts")` the same way the existing `users`/`user_project_caps` branches work.

- [ ] **Step 2: Write the failing tests**

Add a new `describe` block:

```ts
describe("POST /auth/participant-signup", () => {
  it("creates an account and returns a session for a whitelisted email", async () => {
    const env = makeEnv({
      AUTH_DB: makeDb([], [], [], [{ email: "tester@example.com", project_id: "demo", added_at: now() }], []),
    });
    const request = makeRequest("POST", "/auth/participant-signup", {
      project: "demo", email: "tester@example.com", teamName: "Team Test",
      contact: "tester@example.com", password: "password123",
    });
    const response = await handleAuthRoutes(request, new URL(request.url), env);
    expect(response?.status).toBe(200);
    const data = await response!.json();
    expect(data.ok).toBe(true);
    expect(data.teamName).toBe("Team Test");
    expect(response!.headers.get("Set-Cookie")).toContain("freedom_hunt_auth=");
  });

  it("returns 403 for a non-whitelisted email", async () => {
    const env = makeEnv({ AUTH_DB: makeDb([], [], [], [], []) });
    const request = makeRequest("POST", "/auth/participant-signup", {
      project: "demo", email: "nobody@example.com", teamName: "Team X", password: "password123",
    });
    const response = await handleAuthRoutes(request, new URL(request.url), env);
    expect(response?.status).toBe(403);
  });

  it("returns 409 when already registered", async () => {
    const env = makeEnv({
      AUTH_DB: makeDb([], [], [],
        [{ email: "tester@example.com", project_id: "demo", added_at: now() }],
        [{ id: "p1", email: "tester@example.com", project_id: "demo", team_name: "Team Test", contact: null, password_hash: "x", created_at: now() }],
      ),
    });
    const request = makeRequest("POST", "/auth/participant-signup", {
      project: "demo", email: "tester@example.com", teamName: "Team Test", password: "password123",
    });
    const response = await handleAuthRoutes(request, new URL(request.url), env);
    expect(response?.status).toBe(409);
  });

  it("returns 400 for a short password", async () => {
    const env = makeEnv({
      AUTH_DB: makeDb([], [], [], [{ email: "tester@example.com", project_id: "demo", added_at: now() }], []),
    });
    const request = makeRequest("POST", "/auth/participant-signup", {
      project: "demo", email: "tester@example.com", teamName: "Team Test", password: "short",
    });
    const response = await handleAuthRoutes(request, new URL(request.url), env);
    expect(response?.status).toBe(400);
  });
});
```

(Adjust the `makeDb(...)` argument order/shape to whatever Step 1 actually produces — the above assumes positional `(users, caps, tokens, whitelist, participants)`; match the real signature.)

- [ ] **Step 3: Run to verify these fail**

Run: `npx vitest run src/test/worker.auth-user.test.ts -t "participant-signup"`
Expected: FAIL — route doesn't exist yet (404/null response).

- [ ] **Step 4: Implement the endpoint**

Add to `src/worker/routes/authRoutes.ts`, inside `handleAuthRoutes`, after the existing `POST /auth/signup` block:

```ts
  // -------------------------------------------------------------------------
  // POST /auth/participant-signup
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/participant-signup") {
    if (!checkOrigin(request)) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    try {
      const { project, email, teamName, contact, password } = (await request.json()) as {
        project?: string;
        email?: string;
        teamName?: string;
        contact?: string;
        password?: string;
      };

      if (!project || !email || !teamName || !password) {
        return json({ ok: false, error: "Missing required fields" }, 400);
      }
      if (password.length < 8) {
        return json({ ok: false, error: "Password must be at least 8 characters" }, 400);
      }

      const normalEmail = email.toLowerCase();
      const whitelisted = await getWhitelistEntry(env.AUTH_DB, normalEmail, project);
      if (!whitelisted) {
        return json(
          { ok: false, error: "This email hasn't been approved for this project yet. Contact the organizer." },
          403,
        );
      }

      const existing = await getParticipantAccountByEmail(env.AUTH_DB, normalEmail, project);
      if (existing) {
        return json({ ok: false, error: "Already registered — log in instead." }, 409);
      }

      const now = Math.floor(Date.now() / 1000);
      await insertParticipantAccount(env.AUTH_DB, {
        id: generateId(),
        email: normalEmail,
        project_id: project,
        team_name: teamName,
        contact: contact || null,
        password_hash: await hashPassword(password),
        created_at: now,
      });

      const payload: ParticipantTokenPayload = {
        project, teamName, contact: contact || "", isAdmin: false, exp: now + TOKEN_TTL_SECONDS,
      };
      const token = await createToken(payload, env.AUTH_SECRET);
      return json(
        { ok: true, teamName, contact: contact || "", isAdmin: false },
        200,
        { "Set-Cookie": cookieHeader(token, TOKEN_TTL_SECONDS) },
      );
    } catch {
      return json({ ok: false, error: "Signup failed" }, 500);
    }
  }
```

Add the new imports at the top of the file: `getWhitelistEntry`, `getParticipantAccountByEmail`, `insertParticipantAccount` from `../db`, and `ParticipantTokenPayload` from `../../types/auth` (type-only import).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/test/worker.auth-user.test.ts -t "participant-signup"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/worker/routes/authRoutes.ts src/test/worker.auth-user.test.ts
git commit -m "feat: add POST /auth/participant-signup for whitelisted email accounts"
```

---

### Task 3: Extend `POST /auth/login` for email+password participant accounts

**Files:**
- Modify: `src/worker/routes/authRoutes.ts`
- Test: `src/test/worker.auth-user.test.ts`

**Interfaces:**
- Consumes: `getParticipantAccountByEmail`, `verifyPassword` (existing/Task 1).
- Produces: no interface change — same `POST /auth/login` endpoint, additive branch.

- [ ] **Step 1: Write the failing tests**

```ts
describe("POST /auth/login with project + email (individual participant account)", () => {
  it("logs in with correct email + password", async () => {
    const passwordHash = await hashPassword("password123");
    const env = makeEnv({
      AUTH_DB: makeDb([], [], [], [],
        [{ id: "p1", email: "tester@example.com", project_id: "demo", team_name: "Team Test", contact: "tester@example.com", password_hash: passwordHash, created_at: now() }],
      ),
    });
    const request = makeRequest("POST", "/auth/login", {
      project: "demo", email: "tester@example.com", password: "password123",
    });
    const response = await handleAuthRoutes(request, new URL(request.url), env);
    expect(response?.status).toBe(200);
    const data = await response!.json();
    expect(data.ok).toBe(true);
    expect(data.teamName).toBe("Team Test");
  });

  it("returns 401 for wrong password", async () => {
    const passwordHash = await hashPassword("password123");
    const env = makeEnv({
      AUTH_DB: makeDb([], [], [], [],
        [{ id: "p1", email: "tester@example.com", project_id: "demo", team_name: "Team Test", contact: null, password_hash: passwordHash, created_at: now() }],
      ),
    });
    const request = makeRequest("POST", "/auth/login", {
      project: "demo", email: "tester@example.com", password: "wrong-password",
    });
    const response = await handleAuthRoutes(request, new URL(request.url), env);
    expect(response?.status).toBe(401);
  });

  it("returns 401 for an unregistered email", async () => {
    const env = makeEnv({ AUTH_DB: makeDb([], [], [], [], []) });
    const request = makeRequest("POST", "/auth/login", {
      project: "demo", email: "nobody@example.com", password: "password123",
    });
    const response = await handleAuthRoutes(request, new URL(request.url), env);
    expect(response?.status).toBe(401);
  });

  it("does not affect the existing KV shared-password login (no email field)", async () => {
    const env = makeEnv(); // AUTH_STORE already seeded with "auth:proj": "teampass" in makeEnv's default
    const request = makeRequest("POST", "/auth/login", {
      project: "proj", teamName: "Team A", contact: "a@b.com", password: "teampass",
    });
    const response = await handleAuthRoutes(request, new URL(request.url), env);
    expect(response?.status).toBe(200);
    const data = await response!.json();
    expect(data.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify the new ones fail**

Run: `npx vitest run src/test/worker.auth-user.test.ts -t "individual participant account"`
Expected: FAIL — `/auth/login` doesn't check `participant_accounts` yet (falls through to "Project not found" since no KV entry exists for `demo`).

- [ ] **Step 3: Implement**

In `src/worker/routes/authRoutes.ts`, inside the existing `if (body.project)` block of the `/auth/login` handler, add a new branch **before** the existing `adminPw`/`participantPw` KV lookups:

```ts
      if (body.project) {
        const { project, teamName = "", contact = "", password = "", email } = body;
        if (!password) {return json({ ok: false, error: "Missing password" }, 400);}

        if (email) {
          const account = await getParticipantAccountByEmail(env.AUTH_DB, email.toLowerCase(), project);
          if (!account || !(await verifyPassword(password, account.password_hash))) {
            return json({ ok: false, error: "Incorrect email or password" }, 401);
          }
          const now = Math.floor(Date.now() / 1000);
          const payload: ParticipantTokenPayload = {
            project, teamName: account.team_name, contact: account.contact || "",
            isAdmin: false, exp: now + TOKEN_TTL_SECONDS,
          };
          const token = await createToken(payload, env.AUTH_SECRET);
          return json(
            { ok: true, teamName: account.team_name, contact: account.contact || "", isAdmin: false },
            200,
            { "Set-Cookie": cookieHeader(token, TOKEN_TTL_SECONDS) },
          );
        }

        // ----- existing KV admin/participant path, unchanged below -----
        const adminPw = await env.AUTH_STORE.get(`${KV_PREFIX_ADMIN}${project}`);
        ...
```

Everything from `const adminPw = ...` onward stays exactly as it is today — this is a pure insertion above it, not a rewrite. Also update the destructured `body` type annotation earlier in the function to include `email?: string`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/test/worker.auth-user.test.ts -t "individual participant account"`
Expected: PASS, including the "does not affect the existing KV shared-password login" regression case.

- [ ] **Step 5: Run the full worker test suite**

Run: `npm run test:run`
Expected: PASS — confirms nothing in the DA/mirror shared-password path regressed.

- [ ] **Step 6: Commit**

```bash
git add src/worker/routes/authRoutes.ts src/test/worker.auth-user.test.ts
git commit -m "feat: support email+password login for individual participant accounts"
```

---

### Task 4: Frontend API additions

**Files:**
- Modify: `src/utils/api.ts`
- Test: `src/test/api.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `postDemoSignup(payload: DemoSignupPayload): Promise<LoginResponse>`, `LoginPayload.email?: string`, consumed by Tasks 5–6.

- [ ] **Step 1: Write the failing test**

Add to `src/test/api.test.ts` (match its existing `fetch` mock style — check the file for how `postLogin`/`postSignup` are tested and mirror it):

```ts
describe("postDemoSignup", () => {
  it("posts to /auth/participant-signup and returns the response", async () => {
    const mockResponse = { ok: true, teamName: "Team Test", contact: "t@test.com", isAdmin: false };
    globalThis.fetch = vi.fn().mockResolvedValue({ json: async () => mockResponse });
    const result = await postDemoSignup({
      project: "demo", email: "t@test.com", teamName: "Team Test", password: "password123",
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/auth/participant-signup",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result).toEqual(mockResponse);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/test/api.test.ts -t "postDemoSignup"`
Expected: FAIL — not exported yet.

- [ ] **Step 3: Implement**

In `src/utils/api.ts`, extend the existing `LoginPayload` interface and add the new function near `postSignup`:

```ts
export interface LoginPayload {
  project: string;
  teamName: string;
  contact: string;
  password: string;
  email?: string;
}

export interface DemoSignupPayload {
  project: string;
  email: string;
  teamName: string;
  contact?: string;
  password: string;
}

export async function postDemoSignup(payload: DemoSignupPayload): Promise<LoginResponse> {
  const res = await fetch("/auth/participant-signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<LoginResponse>;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/api.test.ts`
Expected: PASS, all tests including the new one.

- [ ] **Step 5: Commit**

```bash
git add src/utils/api.ts src/test/api.test.ts
git commit -m "feat: add postDemoSignup API client function"
```

---

### Task 5: `DemoLoginPage.svelte`

**Files:**
- Create: `src/pages/DemoLoginPage.svelte`
- Create: `src/pages/DemoLoginPage.css`
- Modify: `src/App.svelte`
- Test: `src/test/DemoLoginPage.test.ts`

**Interfaces:**
- Consumes: `postLogin` (existing, now accepts optional `email`), `authStore.loginParticipant` (existing).
- Produces: route `/login/demo`.

- [ ] **Step 1: Write the failing test**

`src/test/DemoLoginPage.test.ts`, mirroring `src/test/LoginPage.test.ts`'s structure:

```ts
import { render, screen } from "@testing-library/svelte/svelte5";
import DemoLoginPage from "../pages/DemoLoginPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
});

test("renders email + password login form with a link to sign up", () => {
  render(DemoLoginPage, { props: { params: { project: "demo" } } });
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /create an account/i })).toHaveAttribute("href", "#/signup/demo");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/test/DemoLoginPage.test.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement**

`src/pages/DemoLoginPage.svelte`:

```svelte
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
```

`src/pages/DemoLoginPage.css` — follow the existing `LoginPage.css` BEM-style token-driven pattern (co-locate, use `var(--color-*)` tokens, class prefix `demo-login__`); copy `LoginPage.css`'s structure and rename the class prefix rather than writing new styles from scratch.

- [ ] **Step 4: Wire the route in `App.svelte`**

In `src/App.svelte`, import `DemoLoginPage` and add it **before** the existing `/login/:project` entry:

```ts
import DemoLoginPage from "./pages/DemoLoginPage.svelte";
...
const routes = {
  "/": asRoute(AppPage),
  "/login/demo": asRoute(DemoLoginPage),
  "/login/:project": asRoute(LoginPage),
  ...
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/test/DemoLoginPage.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/DemoLoginPage.svelte src/pages/DemoLoginPage.css src/App.svelte src/test/DemoLoginPage.test.ts
git commit -m "feat: add DemoLoginPage at /login/demo"
```

---

### Task 6: `DemoSignupPage.svelte`

**Files:**
- Create: `src/pages/DemoSignupPage.svelte`
- Create: `src/pages/DemoSignupPage.css`
- Modify: `src/App.svelte`
- Modify: `doc/setup.md`
- Test: `src/test/DemoSignupPage.test.ts`

**Interfaces:**
- Consumes: `postDemoSignup` (Task 4), `authStore.loginParticipant` (existing).
- Produces: route `/signup/demo`.

- [ ] **Step 1: Write the failing test**

`src/test/DemoSignupPage.test.ts`, mirroring `src/test/SignupPage.test.ts`:

```ts
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import DemoSignupPage from "../pages/DemoSignupPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";
import * as api from "../utils/api";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  vi.restoreAllMocks();
});

test("renders signup form with email, team name, and password fields", () => {
  render(DemoSignupPage, { props: { params: { project: "demo" } } });
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/team name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
});

test("shows the server's whitelist error message on 403", async () => {
  vi.spyOn(api, "postDemoSignup").mockResolvedValue({
    ok: false, error: "This email hasn't been approved for this project yet. Contact the organizer.",
  });
  render(DemoSignupPage, { props: { params: { project: "demo" } } });
  await fireEvent.input(screen.getByLabelText(/email/i), { target: { value: "nobody@example.com" } });
  await fireEvent.input(screen.getByLabelText(/team name/i), { target: { value: "Team X" } });
  await fireEvent.input(screen.getByLabelText(/^password/i), { target: { value: "password123" } });
  await fireEvent.click(screen.getByRole("button", { name: /create account/i }));
  await waitFor(() =>
    expect(screen.getByText(/hasn't been approved/i)).toBeInTheDocument(),
  );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/test/DemoSignupPage.test.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement**

`src/pages/DemoSignupPage.svelte`:

```svelte
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
```

`src/pages/DemoSignupPage.css` — copy `SignupPage.css`'s structure, rename the class prefix to `demo-signup__`.

- [ ] **Step 4: Wire the route and document whitelist management**

In `src/App.svelte`, add above `/signup`:
```ts
import DemoSignupPage from "./pages/DemoSignupPage.svelte";
...
"/signup/demo": asRoute(DemoSignupPage),
"/signup": asRoute(SignupPage),
```

In `doc/setup.md`, add a new section (after whatever the current last section is — check the file's actual end, since Tasks from sub-projects 1–3's plans may have already appended sections):

```markdown

---

## Part 8: Demo Participant Whitelist

`demo` uses individual email+password accounts instead of a shared password. Before someone can sign up at `/signup/demo`, their email must be added to the whitelist:

```
wrangler d1 execute scavenger_hunt_auth --command "INSERT INTO participant_whitelist (email, project_id, added_at) VALUES ('tester@example.com', 'demo', strftime('%s','now'))"
```

For local development:
```
wrangler d1 execute scavenger_hunt_auth --local --command "INSERT INTO participant_whitelist (email, project_id, added_at) VALUES ('tester@example.com', 'demo', strftime('%s','now'))"
```

There is currently no admin UI for this — whitelisting is a manual, one-off action per tester.
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/test/DemoSignupPage.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/DemoSignupPage.svelte src/pages/DemoSignupPage.css src/App.svelte doc/setup.md src/test/DemoSignupPage.test.ts
git commit -m "feat: add DemoSignupPage at /signup/demo and document whitelist management"
```

---

### Task 7: Route-ordering regression test

**Files:**
- Modify: `src/test/App.routing.test.ts`

**Interfaces:** none — test-only.

- [ ] **Step 1: Write the failing test**

Following the exact pattern already in the file (marker components, hash-based navigation, `waitFor`), add:

```ts
test("a literal /login/demo route wins over the /login/:project wildcard", async () => {
  window.location.hash = "#/login/demo";
  render(Router, {
    props: {
      routes: {
        "/login/demo": DemoLoginRouteMarker,
        "/login/:project": WildcardLoginRouteMarker,
      },
    },
  });
  await waitFor(() => expect(screen.getByText("demo-login-route-marker")).toBeInTheDocument());
  expect(screen.queryByText("wildcard-login-route-marker")).not.toBeInTheDocument();
});
```

Create two more minimal fixture components in `src/test/fixtures/` (`DemoLoginRouteMarker.svelte`, `WildcardLoginRouteMarker.svelte`), following the exact shape of the existing `GalleryRouteMarker.svelte`/`WildcardRouteMarker.svelte` fixtures (a single element rendering fixed text, nothing else).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/test/App.routing.test.ts`
Expected: FAIL — fixtures/route don't exist yet.

- [ ] **Step 3: Create the fixtures**

`src/test/fixtures/DemoLoginRouteMarker.svelte`:
```svelte
<div>demo-login-route-marker</div>
```

`src/test/fixtures/WildcardLoginRouteMarker.svelte`:
```svelte
<div>wildcard-login-route-marker</div>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/test/App.routing.test.ts`
Expected: PASS — all cases, including the pre-existing gallery-ordering tests (unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/test/App.routing.test.ts src/test/fixtures/DemoLoginRouteMarker.svelte src/test/fixtures/WildcardLoginRouteMarker.svelte
git commit -m "test: verify /login/demo wins over the /login/:project wildcard"
```

---

### Task 8: Lint, typecheck, full suite, and architecture docs

**Files:**
- Modify: `doc/architecture.md`

**Interfaces:** none — verification and documentation only.

- [ ] **Step 1: Full verification**

Run: `npm run lint && npm run typecheck && npm run test:run`
Expected: all clean/passing.

- [ ] **Step 2: Update `doc/architecture.md`**

Add a new subsection after the `photos`/`form_submissions` D1 table documentation:

```markdown
### `participant_whitelist` / `participant_accounts` tables (D1, `AUTH_DB`)

Used only by the `demo` project's participant auth. `participant_whitelist` gates who may sign up (`email`, `project_id`, `added_at` — managed manually via `wrangler d1 execute`, no admin UI). `participant_accounts` holds individual email+password participant accounts (`id`, `email`, `project_id`, `team_name`, `contact`, `password_hash`, `created_at`), scoped per-project. Login/signup both issue the same `ParticipantTokenPayload` shape as the shared-team-password flow used by every other project — the rest of the app (forms, uploads, gallery, route guards) can't tell the two auth modes apart.
```

Also add a row to the Routing table:
```markdown
| `/login/demo`            | `DemoLoginPage`  | Email+password login for the `demo` project only — matched before the `/login/:project` wildcard |
```

- [ ] **Step 3: Commit**

```bash
git add doc/architecture.md
git commit -m "docs: document participant whitelist auth tables and demo login route"
```
