# Task 04: Signup, D1 Login, /auth/me Dual Shape, CSRF Helper

**Files:**
- Modify: `src/worker/routes/authRoutes.ts`
- Modify: `src/worker/utils.ts`
- Create: `src/test/worker.auth-user.test.ts`

The existing participant login path (`project + password → KV lookup`) is preserved unchanged. New D1 path: email + password → user table lookup. `/auth/me` now returns different shapes for participant vs editor sessions.

---

- [ ] **Step 1: Write failing tests**

Create `src/test/worker.auth-user.test.ts`:

```typescript
// @ts-nocheck
import { describe, it, expect, beforeEach } from "vitest";
import { handleAuthRoutes } from "../worker/routes/authRoutes";
import { hashPassword } from "../worker/db";

const SECRET = "test-secret";
const now = () => Math.floor(Date.now() / 1000);

// Minimal KV mock
function makeKv(data: Record<string, string> = {}) {
  const store = { ...data };
  return {
    get: async (k: string) => store[k] ?? null,
    put: async (k: string, v: string) => { store[k] = v; },
  };
}

// Minimal D1 mock (users + user_project_caps tables)
function makeDb(users: any[] = [], caps: any[] = [], tokens: any[] = []) {
  const u = [...users];
  const c = [...caps];
  const t = [...tokens];
  return {
    prepare: (sql: string) => {
      const args: any[] = [];
      const self = {
        bind: (...vals: any[]) => { args.push(...vals); return self; },
        first: async () => {
          if (sql.includes("FROM users WHERE email")) return u.find((x) => x.email === args[0]) ?? null;
          if (sql.includes("FROM users WHERE id")) return u.find((x) => x.id === args[0]) ?? null;
          return null;
        },
        run: async () => {
          if (sql.startsWith("INSERT INTO users")) {
            u.push({ id: args[0], email: args[1], username: args[2], password_hash: args[3], created_at: args[4] });
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        },
        all: async () => {
          if (sql.includes("FROM user_project_caps")) {
            return { results: c.filter((x) => x.user_id === args[0] && x.revoked_at === null) };
          }
          return { results: [] };
        },
      };
      return self;
    },
  };
}

function makeEnv(overrides: any = {}) {
  return {
    AUTH_STORE: makeKv({ "admin:proj": "adminpass", "auth:proj": "teampass" }),
    AUTH_SECRET: SECRET,
    AUTH_DB: makeDb(),
    ...overrides,
  };
}

function makeRequest(method: string, path: string, body?: unknown, cookie?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Origin": "https://example.com",
    "CF-Connecting-IP": "1.2.3.4",
  };
  if (cookie) headers["Cookie"] = cookie;
  return new Request(`https://example.com${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /auth/signup", () => {
  it("creates a user and sets a cookie", async () => {
    const env = makeEnv();
    const req = makeRequest("POST", "/auth/signup", {
      email: "Alice@Example.com",
      username: "alice",
      password: "password123",
      email_consent_results: true,
      email_consent_marketing: false,
    });
    const res = await handleAuthRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(200);
    const body = await res?.json();
    expect(body.ok).toBe(true);
    expect(body.email).toBe("alice@example.com"); // normalised to lowercase
    expect(res?.headers.get("Set-Cookie")).toContain("freedom_hunt_auth=");
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const env = makeEnv();
    const req = makeRequest("POST", "/auth/signup", {
      email: "b@example.com", username: "bob", password: "short",
    });
    const res = await handleAuthRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(400);
    const body = await res?.json();
    expect(body.ok).toBe(false);
  });

  it("rejects missing fields", async () => {
    const env = makeEnv();
    const req = makeRequest("POST", "/auth/signup", { email: "c@example.com" });
    const res = await handleAuthRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(400);
  });
});

describe("POST /auth/login — D1 user path", () => {
  it("logs in a D1 user with correct password", async () => {
    const hash = await hashPassword("mypassword");
    const env = makeEnv({
      AUTH_DB: makeDb([{ id: "u1", email: "alice@example.com", username: "alice", password_hash: hash, created_at: 1000 }]),
    });
    const req = makeRequest("POST", "/auth/login", {
      email: "Alice@Example.com", // case-insensitive
      password: "mypassword",
    });
    const res = await handleAuthRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(200);
    const body = await res?.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBe("u1");
    expect(res?.headers.get("Set-Cookie")).toContain("freedom_hunt_auth=");
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("mypassword");
    const env = makeEnv({
      AUTH_DB: makeDb([{ id: "u1", email: "alice@example.com", username: "alice", password_hash: hash, created_at: 1000 }]),
    });
    const req = makeRequest("POST", "/auth/login", {
      email: "alice@example.com", password: "wrongpassword",
    });
    const res = await handleAuthRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(401);
  });

  it("participant login still works unchanged", async () => {
    const env = makeEnv();
    const req = makeRequest("POST", "/auth/login", {
      project: "proj", teamName: "t", contact: "c", password: "teampass",
    });
    const res = await handleAuthRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(200);
    const body = await res?.json();
    expect(body.ok).toBe(true);
    expect(body.isAdmin).toBe(false);
  });

  it("KV admin login still works and issues bootstrap token", async () => {
    const env = makeEnv();
    const req = makeRequest("POST", "/auth/login", {
      project: "proj", password: "adminpass",
    });
    const res = await handleAuthRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(200);
    const body = await res?.json();
    expect(body.ok).toBe(true);
    expect(body.isBootstrap).toBe(true);
  });
});

describe("GET /auth/me", () => {
  it("returns editor shape for a user token", async () => {
    const { createToken } = await import("../worker/auth");
    const token = await createToken({ user_id: "u1", exp: now() + 3600 }, SECRET);
    const hash = await hashPassword("pw");
    const env = makeEnv({
      AUTH_DB: makeDb(
        [{ id: "u1", email: "alice@example.com", username: "alice", password_hash: hash, created_at: 1000 }],
        [{ user_id: "u1", project_id: "proj", capability: "editor", granted_at: 1, revoked_at: null }],
      ),
    });
    const req = makeRequest("GET", "/auth/me", undefined, `freedom_hunt_auth=${token}`);
    const res = await handleAuthRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(200);
    const body = await res?.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBe("u1");
    expect(body.capabilities).toContain("editor");
  });

  it("returns participant shape for a participant token", async () => {
    const { createToken } = await import("../worker/auth");
    const token = await createToken(
      { project: "proj", teamName: "t", contact: "c", isAdmin: false, exp: now() + 3600 },
      SECRET,
    );
    const req = makeRequest("GET", "/auth/me", undefined, `freedom_hunt_auth=${token}`);
    const res = await handleAuthRoutes(req, new URL(req.url), env: makeEnv());
    expect(res?.status).toBe(200);
    const body = await res?.json();
    expect(body.ok).toBe(true);
    expect(body.project).toBe("proj");
    expect(body.userId).toBeUndefined();
  });
});
```

Run: `npm run test:run -- src/test/worker.auth-user.test.ts`
Expected: FAIL — signup/D1-login endpoints don't exist yet.

---

- [ ] **Step 2: Add `checkOrigin` helper to `src/worker/utils.ts`**

```typescript
export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/**
 * Returns true when the request Origin matches the app's own origin.
 * Returns true when Origin is absent (non-browser request — not a CSRF risk).
 * Returns false when Origin is present but doesn't match — reject with 403.
 */
export function checkOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try {
    const appOrigin = new URL(request.url).origin;
    return origin === appOrigin;
  } catch {
    return false;
  }
}
```

---

- [ ] **Step 3: Replace `src/worker/routes/authRoutes.ts`**

```typescript
import type { Env } from "../../types/worker";
import type { AnyTokenPayload, UserTokenPayload, BootstrapTokenPayload } from "../../types/auth";
import { isUserToken, isBootstrapToken, isParticipantToken } from "../../types/auth";
import {
  checkRateLimit,
  createToken,
  requireAuth,
  COOKIE_NAME,
  TOKEN_TTL_SECONDS,
  BOOTSTRAP_TTL_SECONDS,
  AUTH_COOKIE_ATTRS,
  KV_PREFIX_ADMIN,
  KV_PREFIX_PARTICIPANT,
} from "../auth";
import {
  getUserByEmail,
  getUserById,
  getUserCaps,
  insertUser,
  hashPassword,
  verifyPassword,
} from "../db";
import { json, checkOrigin } from "../utils";

function cookieHeader(token: string, ttl: number): string {
  return `${COOKIE_NAME}=${token}; ${AUTH_COOKIE_ATTRS}; Max-Age=${ttl}`;
}

function generateId(): string {
  return crypto.randomUUID();
}

export async function handleAuthRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {

  // -------------------------------------------------------------------------
  // POST /auth/signup
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/signup") {
    if (!checkOrigin(request)) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    try {
      const { email, username, password, email_consent_results, email_consent_marketing } =
        (await request.json()) as {
          email?: string;
          username?: string;
          password?: string;
          email_consent_results?: boolean;
          email_consent_marketing?: boolean;
        };

      if (!email || !username || !password) {
        return json({ ok: false, error: "Missing required fields" }, 400);
      }
      if (password.length < 8) {
        return json({ ok: false, error: "Password must be at least 8 characters" }, 400);
      }

      const normalEmail = email.toLowerCase();
      const existing = await getUserByEmail(env.AUTH_DB, normalEmail);
      if (existing) {
        return json({ ok: false, error: "Email already registered" }, 409);
      }

      const now = Math.floor(Date.now() / 1000);
      const consentAt = (email_consent_results || email_consent_marketing) ? now : null;
      const user = {
        id: generateId(),
        email: normalEmail,
        username,
        password_hash: await hashPassword(password),
        created_at: now,
        email_consent_results: email_consent_results ? 1 : null,
        email_consent_marketing: email_consent_marketing ? 1 : null,
        email_consent_at: consentAt,
      };
      await insertUser(env.AUTH_DB, user);

      const payload: UserTokenPayload = { user_id: user.id, exp: now + TOKEN_TTL_SECONDS };
      const token = await createToken(payload, env.AUTH_SECRET);
      return json(
        { ok: true, userId: user.id, email: normalEmail, username, capabilities: [] },
        200,
        { "Set-Cookie": cookieHeader(token, TOKEN_TTL_SECONDS) },
      );
    } catch {
      return json({ ok: false, error: "Signup failed" }, 500);
    }
  }

  // -------------------------------------------------------------------------
  // POST /auth/login
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/login") {
    if (!checkOrigin(request)) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    try {
      const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
      if (await checkRateLimit(clientIP, env)) {
        return json({ ok: false, error: "Too many attempts. Please wait a moment." }, 429);
      }

      const body = (await request.json()) as {
        project?: string;
        teamName?: string;
        contact?: string;
        password?: string;
        email?: string;
      };

      // ----- Participant / KV-admin path (project field present) -----
      if (body.project) {
        const { project, teamName = "", contact = "", password = "" } = body;
        if (!password) return json({ ok: false, error: "Missing password" }, 400);

        const adminPw = await env.AUTH_STORE.get(`${KV_PREFIX_ADMIN}${project}`);
        const participantPw = await env.AUTH_STORE.get(`${KV_PREFIX_PARTICIPANT}${project}`);

        if (adminPw === null && participantPw === null) {
          return json({ ok: false, error: "Project not found" }, 401);
        }

        const now = Math.floor(Date.now() / 1000);

        if (adminPw !== null && password === adminPw) {
          // Issue bootstrap token — valid only for /auth/bootstrap/promote
          const payload: BootstrapTokenPayload = {
            user_id: null,
            isBootstrap: true,
            project,
            exp: now + BOOTSTRAP_TTL_SECONDS,
          };
          const token = await createToken(payload, env.AUTH_SECRET);
          return json(
            { ok: true, isBootstrap: true, project },
            200,
            { "Set-Cookie": cookieHeader(token, BOOTSTRAP_TTL_SECONDS) },
          );
        }

        if (participantPw === null || password !== participantPw) {
          return json({ ok: false, error: "Incorrect password" }, 401);
        }

        const participantPayload = {
          project,
          teamName,
          contact,
          isAdmin: false,
          exp: now + TOKEN_TTL_SECONDS,
        };
        const token = await createToken(participantPayload, env.AUTH_SECRET);
        return json(
          { ok: true, teamName, contact, isAdmin: false },
          200,
          { "Set-Cookie": cookieHeader(token, TOKEN_TTL_SECONDS) },
        );
      }

      // ----- D1 user path (email + password) -----
      const { email, password = "" } = body;
      if (!email || !password) {
        return json({ ok: false, error: "Missing email or password" }, 400);
      }

      const user = await getUserByEmail(env.AUTH_DB, email.toLowerCase());
      if (!user || !(await verifyPassword(password, user.password_hash))) {
        return json({ ok: false, error: "Incorrect email or password" }, 401);
      }

      const caps = await getUserCaps(env.AUTH_DB, user.id);
      const capabilities = caps.map((c) => c.capability);
      const now = Math.floor(Date.now() / 1000);
      const payload: UserTokenPayload = { user_id: user.id, exp: now + TOKEN_TTL_SECONDS };
      const token = await createToken(payload, env.AUTH_SECRET);
      return json(
        { ok: true, userId: user.id, email: user.email, username: user.username, capabilities },
        200,
        { "Set-Cookie": cookieHeader(token, TOKEN_TTL_SECONDS) },
      );
    } catch {
      return json({ ok: false, error: "Login failed" }, 500);
    }
  }

  // -------------------------------------------------------------------------
  // GET /auth/me
  // -------------------------------------------------------------------------
  if (request.method === "GET" && url.pathname === "/auth/me") {
    const payload = await requireAuth(request, env);
    if (!payload) return json({ ok: false, error: "Not authenticated" }, 401);

    if (isBootstrapToken(payload)) {
      // Bootstrap tokens are not valid for /auth/me
      return json({ ok: false, error: "Not authenticated" }, 401);
    }

    if (isUserToken(payload)) {
      const user = await getUserById(env.AUTH_DB, payload.user_id);
      if (!user) return json({ ok: false, error: "User not found" }, 401);
      const caps = await getUserCaps(env.AUTH_DB, payload.user_id);
      return json({
        ok: true,
        userId: user.id,
        email: user.email,
        username: user.username,
        capabilities: caps.map((c) => c.capability),
      });
    }

    // Participant shape — unchanged
    return json({
      ok: true,
      project: payload.project,
      teamName: payload.teamName,
      contact: payload.contact,
      isAdmin: payload.isAdmin ?? false,
    });
  }

  // -------------------------------------------------------------------------
  // POST /auth/logout (unchanged)
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/logout") {
    return json({ ok: true }, 200, {
      "Set-Cookie": `${COOKIE_NAME}=; ${AUTH_COOKIE_ATTRS}; Max-Age=0`,
    });
  }

  return null;
}
```

---

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- src/test/worker.auth-user.test.ts
```

Expected: all tests pass.

---

- [ ] **Step 5: Run full suite**

```bash
npm run test:run
```

Expected: all existing tests pass (participant auth unchanged).

---

- [ ] **Step 6: Commit**

```bash
git add src/worker/routes/authRoutes.ts src/worker/utils.ts src/test/worker.auth-user.test.ts
git commit -m "feat: add signup endpoint, D1 login path, dual-shape /auth/me, CSRF origin check"
```
