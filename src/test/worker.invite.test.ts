// @ts-nocheck
import { describe, it, expect, beforeEach } from "vitest";
import { handleInviteRoutes } from "../worker/routes/inviteRoutes";
import { createToken } from "../worker/auth";
import { hashPassword } from "../worker/db";

const SECRET = "test-secret";
const now = () => Math.floor(Date.now() / 1000);

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
          if (sql.includes("FROM invite_tokens WHERE token")) {
            return t.find((x) => x.token === args[0]) ?? null;
          }
          if (sql.includes("FROM users WHERE id")) {
            return u.find((x) => x.id === args[0]) ?? null;
          }
          return null;
        },
        run: async () => {
          if (sql.startsWith("INSERT INTO invite_tokens")) {
            t.push({ token: args[0], project_id: args[1], capability: args[2], created_at: args[3], expires_at: args[4], used_at: null, revoked_at: null, invited_by_user_id: args[5] });
            return { meta: { changes: 1 } };
          }
          if (sql.includes("UPDATE invite_tokens") && sql.includes("SET used_at")) {
            const inv = t.find((x) => x.token === args[1] && x.used_at === null && x.revoked_at === null && x.expires_at > args[2]);
            if (inv) { inv.used_at = args[0]; return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
          }
          if (sql.startsWith("INSERT INTO user_project_caps")) {
            const exists = c.find((x) => x.user_id === args[0] && x.project_id === args[1] && x.capability === args[2]);
            if (!exists) c.push({ user_id: args[0], project_id: args[1], capability: args[2], granted_at: args[3], granted_by_user_id: args[4], revoked_at: null });
            return { meta: { changes: exists ? 0 : 1 } };
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

function makeEnv(dbOverride?: any) {
  return {
    AUTH_STORE: { get: async () => null, put: async () => {} },
    AUTH_SECRET: SECRET,
    AUTH_DB: dbOverride ?? makeDb(),
  };
}

function makeRequest(method: string, path: string, body?: unknown, cookie?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Origin": "https://example.com",
  };
  if (cookie) headers["Cookie"] = cookie;
  return new Request(`https://example.com${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /auth/invite/create", () => {
  it("creates an invite token for an organizer", async () => {
    const organizerToken = await createToken({ user_id: "org1", exp: now() + 3600 }, SECRET);
    const db = makeDb(
      [{ id: "org1", email: "org@ex.com", username: "org", password_hash: "h", created_at: 1 }],
      [{ user_id: "org1", project_id: "proj", capability: "organizer", granted_at: 1, revoked_at: null }],
    );
    const env = makeEnv(db);
    const req = makeRequest("POST", "/auth/invite/create", { project_id: "proj", capability: "editor" }, `freedom_hunt_auth=${organizerToken}`);
    const res = await handleInviteRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(200);
    const body = await res?.json();
    expect(body.ok).toBe(true);
    expect(body.inviteUrl).toContain("/invite/");
  });

  it("rejects a non-organizer user", async () => {
    const editorToken = await createToken({ user_id: "ed1", exp: now() + 3600 }, SECRET);
    const db = makeDb(
      [{ id: "ed1", email: "ed@ex.com", username: "ed", password_hash: "h", created_at: 1 }],
      [{ user_id: "ed1", project_id: "proj", capability: "editor", granted_at: 1, revoked_at: null }],
    );
    const env = makeEnv(db);
    const req = makeRequest("POST", "/auth/invite/create", { project_id: "proj", capability: "editor" }, `freedom_hunt_auth=${editorToken}`);
    const res = await handleInviteRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(403);
  });
});

describe("GET /auth/invite/:token", () => {
  it("returns token info for a valid token", async () => {
    const db = makeDb([], [], [{
      token: "valid-tok", project_id: "proj", capability: "editor",
      created_at: now(), expires_at: now() + 3600,
      used_at: null, revoked_at: null, invited_by_user_id: null,
    }]);
    const env = makeEnv(db);
    const req = makeRequest("GET", "/auth/invite/valid-tok");
    const res = await handleInviteRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(200);
    const body = await res?.json();
    expect(body.ok).toBe(true);
    expect(body.projectId).toBe("proj");
    expect(body.capability).toBe("editor");
  });

  it("returns 404 for an unknown token", async () => {
    const env = makeEnv();
    const req = makeRequest("GET", "/auth/invite/no-such-token");
    const res = await handleInviteRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(404);
  });

  it("returns 410 for an expired token", async () => {
    const db = makeDb([], [], [{
      token: "expired-tok", project_id: "proj", capability: "editor",
      created_at: now() - 7200, expires_at: now() - 3600,
      used_at: null, revoked_at: null, invited_by_user_id: null,
    }]);
    const env = makeEnv(db);
    const req = makeRequest("GET", "/auth/invite/expired-tok");
    const res = await handleInviteRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(410);
  });
});

describe("POST /auth/invite/accept", () => {
  it("accepts a valid invite and grants capability", async () => {
    const userToken = await createToken({ user_id: "u1", exp: now() + 3600 }, SECRET);
    const hash = await hashPassword("pw");
    const db = makeDb(
      [{ id: "u1", email: "u@ex.com", username: "u", password_hash: hash, created_at: 1 }],
      [],
      [{ token: "tok1", project_id: "proj", capability: "editor", created_at: now(), expires_at: now() + 3600, used_at: null, revoked_at: null, invited_by_user_id: null }],
    );
    const env = makeEnv(db);
    const req = makeRequest("POST", "/auth/invite/accept", { token: "tok1" }, `freedom_hunt_auth=${userToken}`);
    const res = await handleInviteRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(200);
    const body = await res?.json();
    expect(body.ok).toBe(true);
    expect(body.capabilities).toContain("editor");
  });

  it("returns 409 on second accept of the same token", async () => {
    const userToken = await createToken({ user_id: "u1", exp: now() + 3600 }, SECRET);
    const hash = await hashPassword("pw");
    const db = makeDb(
      [{ id: "u1", email: "u@ex.com", username: "u", password_hash: hash, created_at: 1 }],
      [],
      [{ token: "tok2", project_id: "proj", capability: "editor", created_at: now(), expires_at: now() + 3600, used_at: null, revoked_at: null, invited_by_user_id: null }],
    );
    const env = makeEnv(db);
    const req1 = makeRequest("POST", "/auth/invite/accept", { token: "tok2" }, `freedom_hunt_auth=${userToken}`);
    await handleInviteRoutes(req1, new URL(req1.url), env);
    const req2 = makeRequest("POST", "/auth/invite/accept", { token: "tok2" }, `freedom_hunt_auth=${userToken}`);
    const res2 = await handleInviteRoutes(req2, new URL(req2.url), env);
    expect(res2?.status).toBe(409);
  });

  it("returns 401 for an unauthenticated request", async () => {
    const env = makeEnv();
    const req = makeRequest("POST", "/auth/invite/accept", { token: "tok3" });
    const res = await handleInviteRoutes(req, new URL(req.url), env);
    expect(res?.status).toBe(401);
  });
});
