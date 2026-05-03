# Task 03: Admin Auth

Status: Completed

> Part of [2026-05-02-location-editor.md](2026-05-02-location-editor.md)

**SKIP THIS TASK** if `2026-05-02-dashboard-03-admin-auth.md` has already been implemented. All the changes below are identical to that task.

**Goal:** Add an admin tier to the auth system. `admin:{project}` in KV holds the admin password. Logging in with it sets `isAdmin: true` in the token. React stores it in `activeAuth` and `AdminRoute` uses it to guard the editor.

**Files:**

- Modify: `src/worker.js` — login handler + `/auth/me` response
- Modify: `src/auth/AuthContext.jsx` — `isAdmin` in `activeAuth`, updated `login()`
- Create: `src/auth/AdminRoute.jsx`
- Modify: `src/pages/LoginPage.jsx` — pass `isAdmin` to `login()`, redirect admin to `/editor`
- Modify: `src/test/worker.test.js` — admin login + `/auth/me` tests

---

- [ ] **Step 1: Write the failing tests**

Add to `src/test/worker.test.js`:

```js
describe("/auth/login — admin tier", () => {
  const makeAuthEnv = () => ({
    AUTH_STORE: {
      get: async (key) => {
        if (key === "admin:test_project") return "adminpass";
        if (key === "auth:test_project") return "userpass";
        if (key.startsWith("rl:")) return null;
        return null;
      },
      put: async () => {},
    },
    AUTH_SECRET: TEST_SECRET,
  });

  it("sets isAdmin true when admin password used", async () => {
    const request = new Request("https://example.com/auth/login", {
      method: "POST",
      body: JSON.stringify({
        project: "test_project",
        teamName: "Org",
        contact: "",
        password: "adminpass",
      }),
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "1.2.3.4",
      },
    });
    const response = await worker.fetch(request, makeAuthEnv());
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.isAdmin).toBe(true);
  });

  it("sets isAdmin false for participant password", async () => {
    const request = new Request("https://example.com/auth/login", {
      method: "POST",
      body: JSON.stringify({
        project: "test_project",
        teamName: "Team A",
        contact: "",
        password: "userpass",
      }),
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "1.2.3.5",
      },
    });
    const response = await worker.fetch(request, makeAuthEnv());
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.isAdmin).toBe(false);
  });

  it("returns 401 for wrong password", async () => {
    const request = new Request("https://example.com/auth/login", {
      method: "POST",
      body: JSON.stringify({
        project: "test_project",
        teamName: "",
        contact: "",
        password: "wrong",
      }),
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "1.2.3.6",
      },
    });
    const response = await worker.fetch(request, makeAuthEnv());
    expect(response.status).toBe(401);
  });
});

describe("/auth/me — isAdmin", () => {
  it("includes isAdmin in response", async () => {
    const adminToken = await createToken(
      { ...TEST_PAYLOAD, isAdmin: true },
      TEST_SECRET,
    );
    const env = {
      AUTH_SECRET: TEST_SECRET,
      AUTH_STORE: { get: async () => null },
    };
    const request = new Request("https://example.com/auth/me", {
      headers: { Cookie: `freedom_hunt_auth=${adminToken}` },
    });
    const response = await worker.fetch(request, env);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.isAdmin).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- src/test/worker.test.js
```

Expected: FAIL — admin login tests fail.

- [ ] **Step 3: Replace the `/auth/login` handler in `src/worker.js`**

Find the block starting with `if (request.method === 'POST' && url.pathname === '/auth/login')` and replace the whole block:

```js
if (request.method === "POST" && url.pathname === "/auth/login") {
  try {
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    const rateLimited = await checkRateLimit(clientIP, env);
    if (rateLimited) {
      return json(
        { ok: false, error: "Too many attempts. Please wait a moment." },
        429,
      );
    }
    const { project, teamName, contact, password } = await request.json();
    if (!project || !password) {
      return json({ ok: false, error: "Missing required fields" }, 400);
    }
    const adminPw = await env.AUTH_STORE.get(`admin:${project}`);
    const participantPw = await env.AUTH_STORE.get(`auth:${project}`);
    if (adminPw === null && participantPw === null) {
      return json({ ok: false, error: "Project not found" }, 401);
    }
    let isAdmin = false;
    if (adminPw !== null && password === adminPw) {
      isAdmin = true;
    } else if (participantPw === null || password !== participantPw) {
      return json({ ok: false, error: "Incorrect password" }, 401);
    }
    const payload = {
      project,
      teamName: teamName || "",
      contact: contact || "",
      isAdmin,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    };
    const token = await createToken(payload, env.AUTH_SECRET);
    return json(
      {
        ok: true,
        teamName: payload.teamName,
        contact: payload.contact,
        isAdmin,
      },
      200,
      {
        "Set-Cookie": `freedom_hunt_auth=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`,
      },
    );
  } catch {
    return json({ ok: false, error: "Login failed" }, 500);
  }
}
```

- [ ] **Step 4: Update the `/auth/me` handler in `src/worker.js`**

Find and replace the `/auth/me` block:

```js
if (request.method === "GET" && url.pathname === "/auth/me") {
  const payload = await requireAuth(request, env);
  if (!payload) return json({ ok: false, error: "Not authenticated" }, 401);
  return json({
    ok: true,
    project: payload.project,
    teamName: payload.teamName,
    contact: payload.contact,
    isAdmin: payload.isAdmin ?? false,
  });
}
```

- [ ] **Step 5: Run worker tests — confirm they pass**

```
npm test -- src/test/worker.test.js
```

Expected: All tests pass.

- [ ] **Step 6: Update `src/auth/AuthContext.jsx`**

Replace the `useEffect` that calls `/auth/me` and the `login` function with:

```js
useEffect(() => {
  fetch("/auth/me")
    .then((r) => r.json())
    .then((data) => {
      if (data.ok) {
        setActiveAuth({
          projectId: data.project,
          teamName: data.teamName,
          contact: data.contact,
          isAdmin: data.isAdmin ?? false,
        });
      }
    })
    .catch(() => {})
    .finally(() => setAuthLoading(false));
}, []);

function login(projectId, teamName, contact, isAdmin = false) {
  setActiveAuth({ projectId, teamName, contact, isAdmin });
}
```

- [ ] **Step 7: Update `src/pages/LoginPage.jsx`**

In `handleSubmit`, find the success branch (line ~32):

```js
login(project, data.teamName, data.contact);
navigate(`/${project}`);
```

Replace with:

```js
login(project, data.teamName, data.contact, data.isAdmin ?? false);
navigate(data.isAdmin ? "/editor" : `/${project}`);
```

- [ ] **Step 8: Create `src/auth/AdminRoute.jsx`**

```jsx
import { useAuth } from "./AuthContext";
import { Navigate } from "react-router-dom";

export default function AdminRoute({ children }) {
  const { activeAuth, authLoading, isLoggingOut } = useAuth();
  if (authLoading || isLoggingOut) return null;
  if (!activeAuth?.isAdmin) return <Navigate to="/" replace />;
  return children;
}
```

- [ ] **Step 9: Commit**

```
git add src/worker.js src/auth/AuthContext.jsx src/auth/AdminRoute.jsx src/pages/LoginPage.jsx src/test/worker.test.js
git commit -m "feat: add admin auth tier with isAdmin token flag and AdminRoute guard"
```
