# Task 06: Invite Endpoints

**Files:**
- Create: `src/worker/routes/inviteRoutes.ts`
- Modify: `src/worker.ts`
- Create: `src/test/worker.invite.test.ts`

Three endpoints: create an invite (organizer only), validate a token (public, used by the frontend before showing the accept UI), and accept an invite (authenticated user). Acceptance is atomic — a second call with the same token returns 409.

---

- [ ] **Step 1: Write failing tests**

Create `src/test/worker.invite.test.ts`:

```typescript
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
          if (sql.startsWith("UPDATE invite_tokens SET used_at")) {
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
```

Run: `npm run test:run -- src/test/worker.invite.test.ts`
Expected: FAIL — `../worker/routes/inviteRoutes` not found.

---

- [ ] **Step 2: Create `src/worker/routes/inviteRoutes.ts`**

```typescript
import type { Env } from "../../types/worker";
import { isUserToken } from "../../types/auth";
import { requireAuth, createToken, COOKIE_NAME, TOKEN_TTL_SECONDS, AUTH_COOKIE_ATTRS } from "../auth";
import {
  getUserCaps,
  getUserById,
  insertCap,
  insertInviteToken,
  getInviteToken,
  acceptInviteToken,
} from "../db";
import { json, checkOrigin } from "../utils";

const INVITE_TTL_SECONDS = 48 * 60 * 60;
const VALID_CAPABILITIES = new Set(["user", "editor", "organizer"]);

function cookieHeader(token: string, ttl: number): string {
  return `${COOKIE_NAME}=${token}; ${AUTH_COOKIE_ATTRS}; Max-Age=${ttl}`;
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function handleInviteRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {

  // -------------------------------------------------------------------------
  // POST /auth/invite/create
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/invite/create") {
    if (!checkOrigin(request)) return json({ ok: false, error: "Forbidden" }, 403);

    const payload = await requireAuth(request, env);
    if (!payload || !isUserToken(payload)) {
      return json({ ok: false, error: "Not authenticated" }, 401);
    }

    try {
      const { project_id, capability = "editor" } = (await request.json()) as {
        project_id?: string;
        capability?: string;
      };

      if (!project_id) return json({ ok: false, error: "Missing project_id" }, 400);
      if (!VALID_CAPABILITIES.has(capability)) {
        return json({ ok: false, error: "Invalid capability" }, 400);
      }

      // Only organizers can create invites
      const caps = await getUserCaps(env.AUTH_DB, payload.user_id);
      const isOrganizer = caps.some(
        (c) => c.project_id === project_id && c.capability === "organizer",
      );
      if (!isOrganizer) return json({ ok: false, error: "Forbidden" }, 403);

      const now = Math.floor(Date.now() / 1000);
      const token = generateToken();
      await insertInviteToken(env.AUTH_DB, {
        token,
        project_id,
        capability,
        created_at: now,
        expires_at: now + INVITE_TTL_SECONDS,
        used_at: null,
        revoked_at: null,
        invited_by_user_id: payload.user_id,
      });

      const origin = new URL(request.url).origin;
      return json({ ok: true, token, inviteUrl: `${origin}/#/invite/${token}` });
    } catch {
      return json({ ok: false, error: "Failed to create invite" }, 500);
    }
  }

  // -------------------------------------------------------------------------
  // GET /auth/invite/:token
  // -------------------------------------------------------------------------
  const inviteMatch = url.pathname.match(/^\/auth\/invite\/([^/]+)$/);
  if (request.method === "GET" && inviteMatch) {
    const token = inviteMatch[1];
    try {
      const inv = await getInviteToken(env.AUTH_DB, token);
      if (!inv) return json({ ok: false, error: "Invite not found" }, 404);

      const now = Math.floor(Date.now() / 1000);
      if (inv.revoked_at !== null) return json({ ok: false, error: "Invite revoked" }, 410);
      if (inv.expires_at <= now) return json({ ok: false, error: "Invite expired" }, 410);
      if (inv.used_at !== null) return json({ ok: false, error: "Invite already used" }, 410);

      return json({
        ok: true,
        projectId: inv.project_id,
        capability: inv.capability,
        expiresAt: inv.expires_at,
      });
    } catch {
      return json({ ok: false, error: "Failed to validate invite" }, 500);
    }
  }

  // -------------------------------------------------------------------------
  // POST /auth/invite/accept
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/invite/accept") {
    if (!checkOrigin(request)) return json({ ok: false, error: "Forbidden" }, 403);

    const payload = await requireAuth(request, env);
    if (!payload || !isUserToken(payload)) {
      return json({ ok: false, error: "Not authenticated" }, 401);
    }

    try {
      const { token } = (await request.json()) as { token?: string };
      if (!token) return json({ ok: false, error: "Missing token" }, 400);

      const inv = await getInviteToken(env.AUTH_DB, token);
      if (!inv) return json({ ok: false, error: "Invite not found" }, 404);

      const accepted = await acceptInviteToken(env.AUTH_DB, token);
      if (!accepted) return json({ ok: false, error: "Invite already used or expired" }, 409);

      const now = Math.floor(Date.now() / 1000);
      await insertCap(env.AUTH_DB, {
        user_id: payload.user_id,
        project_id: inv.project_id,
        capability: inv.capability,
        granted_at: now,
        granted_by_user_id: inv.invited_by_user_id,
      });

      const caps = await getUserCaps(env.AUTH_DB, payload.user_id);
      const user = await getUserById(env.AUTH_DB, payload.user_id);

      // Re-issue token so capabilities are fresh (though /auth/me is the source of truth)
      const newToken = await createToken(
        { user_id: payload.user_id, exp: now + TOKEN_TTL_SECONDS },
        env.AUTH_SECRET,
      );

      return json(
        {
          ok: true,
          projectId: inv.project_id,
          capabilities: caps.map((c) => c.capability),
          userId: payload.user_id,
          email: user?.email ?? "",
          username: user?.username ?? "",
        },
        200,
        { "Set-Cookie": cookieHeader(newToken, TOKEN_TTL_SECONDS) },
      );
    } catch {
      return json({ ok: false, error: "Failed to accept invite" }, 500);
    }
  }

  return null;
}
```

---

- [ ] **Step 3: Wire the invite routes in `src/worker.ts`**

```typescript
import type { Env } from "./types/worker";
import { handleAuthRoutes } from "./worker/routes/authRoutes";
import { handleInviteRoutes } from "./worker/routes/inviteRoutes";
import { handleUploadRoute } from "./worker/routes/uploadRoute";
import { handleFormSubmitRoute } from "./worker/routes/formSubmitRoute";
import { handleEditorRoutes } from "./worker/routes/editorRoutes";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    return (
      (await handleAuthRoutes(request, url, env)) ??
      (await handleInviteRoutes(request, url, env)) ??
      (await handleUploadRoute(request, url, env)) ??
      (await handleFormSubmitRoute(request, url, env)) ??
      (await handleEditorRoutes(request, url, env)) ??
      (env.ASSETS
        ? env.ASSETS.fetch(request)
        : new Response("Not found", { status: 404 }))
    );
  },
};
```

---

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- src/test/worker.invite.test.ts
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
git add src/worker/routes/inviteRoutes.ts src/worker.ts src/test/worker.invite.test.ts
git commit -m "feat: add invite create / validate / accept endpoints"
```
