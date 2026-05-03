# Task 01 — Close route test gaps

> **Index:** [worker-refactor](2026-05-02-worker-refactor.md)

**Goal:** Reach full route coverage in `src/test/worker.test.js` before touching any production code. These tests are the safety net for the rest of the refactor.

**Files:**

- Modify: `src/test/worker.test.js`

**Currently untested:**

- `GET /auth/me` — unauthenticated path
- `POST /auth/logout` — the only route with zero tests
- `POST /upload` — unauthenticated + success paths
- `GET /editor/pr-status` — just added, zero tests
- `/auth/login` — missing: missing fields (400), project not found (401), rate limited (429)

---

- [ ] **Step 1: Add `/auth/me` unauthenticated test**

Append inside the existing `describe('/auth/me — isAdmin', ...)` block in `src/test/worker.test.js`:

```js
it("returns 401 when no auth cookie is present", async () => {
  const env = {
    AUTH_SECRET: TEST_SECRET,
    AUTH_STORE: { get: async () => null },
  };
  const request = new Request("https://example.com/auth/me");
  const response = await worker.fetch(request, env);
  expect(response.status).toBe(401);
});
```

- [ ] **Step 2: Run test to verify it passes**

```
npm run test -- src/test/worker.test.js
```

Expected: all tests pass.

---

- [ ] **Step 3: Add `/auth/logout` tests**

Add after the `/auth/me` describe block:

```js
describe("/auth/logout", () => {
  it("returns 200 with ok: true", async () => {
    const env = { AUTH_SECRET: TEST_SECRET };
    const request = new Request("https://example.com/auth/logout", {
      method: "POST",
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
  });

  it("clears the auth cookie", async () => {
    const env = { AUTH_SECRET: TEST_SECRET };
    const request = new Request("https://example.com/auth/logout", {
      method: "POST",
    });
    const response = await worker.fetch(request, env);
    const cookie = response.headers.get("Set-Cookie");
    expect(cookie).toMatch(/freedom_hunt_auth=;/);
    expect(cookie).toMatch(/Max-Age=0/);
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

```
npm run test -- src/test/worker.test.js
```

Expected: all tests pass.

---

- [ ] **Step 5: Add `/upload` tests**

Add after the `/auth/logout` describe block. The test environment needs `PHOTOS` binding with a `put` mock:

```js
describe("/upload", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 when not authenticated", async () => {
    const env = {
      AUTH_SECRET: TEST_SECRET,
      AUTH_STORE: { get: async () => null },
      PHOTOS: { put: vi.fn() },
    };
    const formData = new FormData();
    formData.append(
      "photo",
      new Blob(["img"], { type: "image/jpeg" }),
      "x.jpg",
    );
    formData.append("locationId", "001");
    const request = new Request("https://example.com/upload", {
      method: "POST",
      body: formData,
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
  });

  it("stores photo in R2 and returns the key", async () => {
    const env = {
      AUTH_SECRET: TEST_SECRET,
      AUTH_STORE: { get: async () => null },
      PHOTOS: { put: vi.fn().mockResolvedValue(undefined) },
    };
    const formData = new FormData();
    formData.append(
      "photo",
      new Blob(["img"], { type: "image/jpeg" }),
      "x.jpg",
    );
    formData.append("locationId", "001");
    const request = new Request("https://example.com/upload", {
      method: "POST",
      body: formData,
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.key).toMatch(/^001_\d+\.jpg$/);
    expect(env.PHOTOS.put).toHaveBeenCalledOnce();
  });

  it("returns 500 when R2 put throws", async () => {
    const env = {
      AUTH_SECRET: TEST_SECRET,
      AUTH_STORE: { get: async () => null },
      PHOTOS: { put: vi.fn().mockRejectedValue(new Error("R2 down")) },
    };
    const formData = new FormData();
    formData.append(
      "photo",
      new Blob(["img"], { type: "image/jpeg" }),
      "x.jpg",
    );
    formData.append("locationId", "001");
    const request = new Request("https://example.com/upload", {
      method: "POST",
      body: formData,
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(500);
  });
});
```

- [ ] **Step 6: Run test to verify it passes**

```
npm run test -- src/test/worker.test.js
```

Expected: all tests pass.

---

- [ ] **Step 7: Add `/editor/pr-status` tests**

Add after the `POST /editor/location` describe block. Reuse the existing `makeAdminEnv()` and `makeAdminToken()` helpers:

```js
describe("GET /editor/pr-status", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 for unauthenticated request", async () => {
    const request = new Request(
      "https://example.com/editor/pr-status?numbers=1",
    );
    const response = await worker.fetch(request, makeAdminEnv());
    expect(response.status).toBe(401);
  });

  it("returns empty statuses when numbers param is absent", async () => {
    const adminToken = await makeAdminToken();
    const request = new Request("https://example.com/editor/pr-status", {
      headers: { Cookie: `freedom_hunt_auth=${adminToken}` },
    });
    const response = await worker.fetch(request, makeAdminEnv());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.statuses).toEqual({});
  });

  it("returns GitHub state for each PR number", async () => {
    const adminToken = await makeAdminToken();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ state: "open" }), {
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ state: "closed" }), {
          headers: { "Content-Type": "application/json" },
        }),
      );
    const request = new Request(
      "https://example.com/editor/pr-status?numbers=27,28",
      {
        headers: { Cookie: `freedom_hunt_auth=${adminToken}` },
      },
    );
    const response = await worker.fetch(request, makeAdminEnv());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(data.statuses["27"]).toBe("open");
    expect(data.statuses["28"]).toBe("closed");
  });
});
```

- [ ] **Step 8: Run test to verify it passes**

```
npm run test -- src/test/worker.test.js
```

Expected: all tests pass.

---

- [ ] **Step 9: Add `/auth/login` edge case tests**

Add inside the existing `describe('/auth/login — admin tier', ...)` block:

```js
it("returns 400 when project field is missing", async () => {
  const request = new Request("https://example.com/auth/login", {
    method: "POST",
    body: JSON.stringify({ password: "pass" }),
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "9.9.9.1",
    },
  });
  const response = await worker.fetch(request, makeAuthEnv());
  expect(response.status).toBe(400);
});

it('returns 401 with "Project not found" for unknown project', async () => {
  const env = {
    AUTH_STORE: {
      get: async () => null,
      put: async () => {},
    },
    AUTH_SECRET: TEST_SECRET,
  };
  const request = new Request("https://example.com/auth/login", {
    method: "POST",
    body: JSON.stringify({ project: "no_such_project", password: "pass" }),
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "9.9.9.2",
    },
  });
  const response = await worker.fetch(request, env);
  expect(response.status).toBe(401);
  const data = await response.json();
  expect(data.error).toBe("Project not found");
});

it("returns 429 when rate limit is exceeded", async () => {
  const env = {
    AUTH_STORE: {
      get: async (key) => {
        if (key.startsWith("rl:")) {
          return JSON.stringify({ count: 5, windowStart: Date.now() });
        }
        return null;
      },
      put: async () => {},
    },
    AUTH_SECRET: TEST_SECRET,
  };
  const request = new Request("https://example.com/auth/login", {
    method: "POST",
    body: JSON.stringify({ project: "test_project", password: "pass" }),
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "9.9.9.3",
    },
  });
  const response = await worker.fetch(request, env);
  expect(response.status).toBe(429);
});
```

- [ ] **Step 10: Run all tests to confirm full green**

```
npm run test -- src/test/worker.test.js
```

Expected: all tests pass.

- [ ] **Step 11: Commit**

```
git add src/test/worker.test.js
git commit -m "test: close route coverage gaps in worker.test.js"
```
