# Task 05: Bootstrap Promote Endpoint

**Files:**
- Modify: `src/worker/routes/authRoutes.ts`
- Modify: `src/test/worker.auth-user.test.ts`

`POST /auth/bootstrap/promote` is guarded by a bootstrap token (issued by the KV admin login path in Task 04). It grants `organizer` capability to a user_id for the bootstrap project, then issues a regular user token — so the maintainer is immediately logged in without a re-login.

---

- [ ] **Step 1: Write failing tests**

Add to `src/test/worker.auth-user.test.ts`:

```typescript
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
    // Issues a regular user token (not bootstrap)
    expect(res?.headers.get("Set-Cookie")).toContain("freedom_hunt_auth=");
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
```

Run: `npm run test:run -- src/test/worker.auth-user.test.ts`
Expected: FAIL — `POST /auth/bootstrap/promote` not yet handled.

---

- [ ] **Step 2: Add the bootstrap promote handler to `src/worker/routes/authRoutes.ts`**

Add this block inside `handleAuthRoutes`, after the `/auth/logout` block and before the final `return null`:

```typescript
  // -------------------------------------------------------------------------
  // POST /auth/bootstrap/promote
  // -------------------------------------------------------------------------
  if (request.method === "POST" && url.pathname === "/auth/bootstrap/promote") {
    if (!checkOrigin(request)) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    const payload = await requireAuth(request, env);
    if (!payload || !isBootstrapToken(payload)) {
      return json({ ok: false, error: "Forbidden" }, 403);
    }
    try {
      const { user_id } = (await request.json()) as { user_id?: string };
      if (!user_id) {
        return json({ ok: false, error: "Missing user_id" }, 400);
      }
      const user = await getUserById(env.AUTH_DB, user_id);
      if (!user) {
        return json({ ok: false, error: "User not found" }, 404);
      }
      const now = Math.floor(Date.now() / 1000);
      await insertCap(env.AUTH_DB, {
        user_id,
        project_id: payload.project,
        capability: "organizer",
        granted_at: now,
        granted_by_user_id: null, // bootstrapped — no parent granter
      });
      const caps = await getUserCaps(env.AUTH_DB, user_id);
      // Issue a regular user token, replacing the bootstrap token in the cookie
      const userPayload: UserTokenPayload = { user_id, exp: now + TOKEN_TTL_SECONDS };
      const token = await createToken(userPayload, env.AUTH_SECRET);
      return json(
        { ok: true, userId: user_id, email: user.email, username: user.username, capabilities: caps.map((c) => c.capability) },
        200,
        { "Set-Cookie": cookieHeader(token, TOKEN_TTL_SECONDS) },
      );
    } catch {
      return json({ ok: false, error: "Promote failed" }, 500);
    }
  }
```

Also add the missing imports at the top of the file (add to the existing db import line):

```typescript
import {
  getUserByEmail,
  getUserById,
  getUserCaps,
  insertUser,
  insertCap,
  hashPassword,
  verifyPassword,
} from "../db";
```

---

- [ ] **Step 3: Run tests**

```bash
npm run test:run -- src/test/worker.auth-user.test.ts
```

Expected: all tests pass.

---

- [ ] **Step 4: Run full suite**

```bash
npm run test:run
```

Expected: all tests pass.

---

- [ ] **Step 5: Commit**

```bash
git add src/worker/routes/authRoutes.ts src/test/worker.auth-user.test.ts
git commit -m "feat: add bootstrap promote endpoint — grants organizer cap and issues user token"
```
