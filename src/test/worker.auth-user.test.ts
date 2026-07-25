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

// Minimal D1 mock (users + user_project_caps + participant_whitelist + participant_accounts)
function makeDb(users: any[] = [], caps: any[] = [], tokens: any[] = [], whitelist: any[] = [], participants: any[] = []) {
  const u = [...users];
  const c = [...caps];
  const t = [...tokens];
  const w = [...whitelist];
  const p = [...participants];
  return {
    prepare: (sql: string) => {
      const args: any[] = [];
      const self = {
        bind: (...vals: any[]) => { args.push(...vals); return self; },
        first: async () => {
          if (sql.includes("FROM users WHERE email")) return u.find((x) => x.email === args[0]) ?? null;
          if (sql.includes("FROM users WHERE id")) return u.find((x) => x.id === args[0]) ?? null;
          if (sql.includes("FROM participant_whitelist")) return w.find((x) => x.email === args[0] && x.project_id === args[1]) ?? null;
          if (sql.includes("FROM participant_accounts")) return p.find((x) => x.email === args[0] && x.project_id === args[1]) ?? null;
          return null;
        },
        run: async () => {
          if (sql.startsWith("INSERT INTO users")) {
            u.push({ id: args[0], email: args[1], username: args[2], password_hash: args[3], created_at: args[4] });
            return { meta: { changes: 1 } };
          }
          if (sql.startsWith("INSERT INTO user_project_caps")) {
            const exists = c.find((x) => x.user_id === args[0] && x.project_id === args[1] && x.capability === args[2]);
            if (!exists) c.push({ user_id: args[0], project_id: args[1], capability: args[2], granted_at: args[3], granted_by_user_id: args[4], revoked_at: null });
            return { meta: { changes: exists ? 0 : 1 } };
          }
          if (sql.startsWith("INSERT INTO participant_accounts")) {
            p.push({ id: args[0], email: args[1], project_id: args[2], team_name: args[3], contact: args[4], password_hash: args[5], created_at: args[6] });
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
    const env = makeEnv();
    const req = makeRequest("GET", "/auth/me", undefined, `freedom_hunt_auth=${token}`);
    const res = await handleAuthRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(200);
    const body = await res?.json();
    expect(body.ok).toBe(true);
    expect(body.project).toBe("proj");
    expect(body.userId).toBeUndefined();
  });
});

describe("POST /auth/bootstrap/promote", () => {
  it("grants organizer cap and issues a user token", async () => {
    const { createToken } = await import("../worker/auth");
    const bootstrapToken = await createToken(
      { user_id: null, isBootstrap: true, project: "proj", exp: now() + 3600 },
      SECRET,
    );
    const hash = await hashPassword("pw");
    const caps: any[] = [];
    const env = makeEnv({
      AUTH_DB: makeDb(
        [{ id: "u1", email: "maintainer@example.com", username: "maintainer", password_hash: hash, created_at: 1000 }],
        caps,
      ),
    });

    const req = makeRequest(
      "POST", "/auth/bootstrap/promote",
      { user_id: "u1" },
      `freedom_hunt_auth=${bootstrapToken}`,
    );
    const res = await handleAuthRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(200);
    const body = await res?.json();
    expect(body.ok).toBe(true);
    expect(body.capabilities).toContain("organizer");
  });

  it("rejects a non-bootstrap token", async () => {
    const { createToken } = await import("../worker/auth");
    const userToken = await createToken({ user_id: "u1", exp: now() + 3600 }, SECRET);
    const env = makeEnv();
    const req = makeRequest(
      "POST", "/auth/bootstrap/promote",
      { user_id: "u1" },
      `freedom_hunt_auth=${userToken}`,
    );
    const res = await handleAuthRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(403);
  });

  it("rejects a missing user_id in body", async () => {
    const { createToken } = await import("../worker/auth");
    const bootstrapToken = await createToken(
      { user_id: null, isBootstrap: true, project: "proj", exp: now() + 3600 },
      SECRET,
    );
    const env = makeEnv();
    const req = makeRequest(
      "POST", "/auth/bootstrap/promote",
      {},
      `freedom_hunt_auth=${bootstrapToken}`,
    );
    const res = await handleAuthRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(400);
  });

  it("rejects when the user_id does not exist in D1", async () => {
    const { createToken } = await import("../worker/auth");
    const bootstrapToken = await createToken(
      { user_id: null, isBootstrap: true, project: "proj", exp: now() + 3600 },
      SECRET,
    );
    const env = makeEnv({ AUTH_DB: makeDb() }); // empty users table
    const req = makeRequest(
      "POST", "/auth/bootstrap/promote",
      { user_id: "unknown" },
      `freedom_hunt_auth=${bootstrapToken}`,
    );
    const res = await handleAuthRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(404);
  });
});

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
    const env = makeEnv();
    const request = makeRequest("POST", "/auth/login", {
      project: "proj", teamName: "Team A", contact: "a@b.com", password: "teampass",
    });
    const response = await handleAuthRoutes(request, new URL(request.url), env);
    expect(response?.status).toBe(200);
    const data = await response!.json();
    expect(data.ok).toBe(true);
  });
});

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

  it("succeeds without teamName/contact, defaulting team_name to empty and contact to the email", async () => {
    const env = makeEnv({
      AUTH_DB: makeDb([], [], [], [{ email: "tester@example.com", project_id: "demo", added_at: now() }], []),
    });
    const request = makeRequest("POST", "/auth/participant-signup", {
      project: "demo", email: "tester@example.com", password: "password123",
    });
    const response = await handleAuthRoutes(request, new URL(request.url), env);
    expect(response?.status).toBe(200);
    const data = await response!.json();
    expect(data.ok).toBe(true);
    expect(data.teamName).toBe("");
    expect(data.contact).toBe("tester@example.com");
  });
});
