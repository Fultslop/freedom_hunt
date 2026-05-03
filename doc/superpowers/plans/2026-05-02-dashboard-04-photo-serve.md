# Task 04: Worker Photo Serve Route

> Part of [2026-05-02-dashboard.md](2026-05-02-dashboard.md)

**Goal:** Add a `GET /photo/:key` route to the Worker so the React app can load R2 photos by key. Any authenticated user can access this endpoint (not admin-only, so participants can also use it for photo preview in future).

**Key validation:** Reject any key containing `..` or `/` to prevent path traversal.

**Files:**

- Modify: `src/worker.js` — add `GET /photo/:key` handler before the `ASSETS` fallback
- Modify: `src/test/worker.test.js` — tests for the new route

---

- [ ] **Step 1: Write the failing tests**

Add to `src/test/worker.test.js`:

```js
describe("GET /photo/:key", () => {
  it("returns 401 when not authenticated", async () => {
    const env = {
      AUTH_SECRET: TEST_SECRET,
      AUTH_STORE: { get: async () => null },
      PHOTOS: { get: async () => null },
    };
    const request = new Request(
      "https://example.com/photo/team_a--r1--001--123.jpg",
    );
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
  });

  it("returns 400 for a key containing ..", async () => {
    const env = {
      AUTH_SECRET: TEST_SECRET,
      AUTH_STORE: { get: async () => null },
      PHOTOS: { get: async () => null },
    };
    const request = new Request("https://example.com/photo/../secret", {
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(400);
  });

  it("returns 404 when key not found in R2", async () => {
    const env = {
      AUTH_SECRET: TEST_SECRET,
      AUTH_STORE: { get: async () => null },
      PHOTOS: { get: async () => null },
    };
    const request = new Request(
      "https://example.com/photo/team_a--r1--001--123.jpg",
      {
        headers: { Cookie: `freedom_hunt_auth=${authToken}` },
      },
    );
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(404);
  });

  it("streams the R2 object when found", async () => {
    const fakeBody = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([0xff, 0xd8]));
        controller.close();
      },
    });
    const fakeObject = {
      body: fakeBody,
      httpEtag: '"abc123"',
      writeHttpMetadata: (headers) => {
        headers.set("Content-Type", "image/jpeg");
      },
    };
    const env = {
      AUTH_SECRET: TEST_SECRET,
      AUTH_STORE: { get: async () => null },
      PHOTOS: {
        get: async (key) =>
          key === "team_a--r1--001--123.jpg" ? fakeObject : null,
      },
    };
    const request = new Request(
      "https://example.com/photo/team_a--r1--001--123.jpg",
      {
        headers: { Cookie: `freedom_hunt_auth=${authToken}` },
      },
    );
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- src/test/worker.test.js
```

Expected: FAIL — the new `/photo/` tests all fail (route doesn't exist yet).

- [ ] **Step 3: Add the `GET /photo/:key` handler to `src/worker.js`**

Insert this block **before** the `if (!env.ASSETS)` fallback at the bottom of the `fetch` handler:

```js
if (request.method === "GET" && url.pathname.startsWith("/photo/")) {
  const authPayload = await requireAuth(request, env);
  if (!authPayload) return json({ ok: false, error: "Unauthorized" }, 401);
  const key = url.pathname.slice("/photo/".length);
  if (!key || key.includes("..") || key.includes("/")) {
    return json({ ok: false, error: "Invalid key" }, 400);
  }
  const object = await env.PHOTOS.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```
npm test -- src/test/worker.test.js
```

Expected: All tests pass including the new photo serve tests.

- [ ] **Step 5: Commit**

```
git add src/worker.js src/test/worker.test.js
git commit -m "feat: add GET /photo/:key Worker route to serve R2 photos"
```
