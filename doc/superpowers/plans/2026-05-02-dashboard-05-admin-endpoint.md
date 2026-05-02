# Task 05: Worker Admin Submissions Endpoint

> Part of [2026-05-02-dashboard.md](2026-05-02-dashboard.md)

**Goal:** Add `GET /admin/submissions` to the Worker. It lists all R2 photo keys and reads all Google Sheet rows (via `doGet` on `FORM_SCRIPT_URL`), returning them as a single JSON payload for the dashboard.

**Access:** Admin auth required (`isAdmin: true` in token). Returns 403 for non-admin authenticated users and 401 for unauthenticated.

**Sheet rows contract:** The Apps Script `doGet` (added in Task 02) returns `{ ok: true, rows: [...] }` where each row is an object with keys `timestamp, routeId, locationId, teamName, email, fields`. If the sheet GET fails, `submissions` is an empty array (dashboard still works with photos only).

**R2 pagination note:** `env.PHOTOS.list()` returns up to 1000 keys by default. For the expected scale of a hunt (tens of photos) this is fine. No pagination needed for v1.

**Files:**
- Modify: `src/worker.js` — add `GET /admin/submissions` handler
- Modify: `src/test/worker.test.js` — tests for the new route

---

- [ ] **Step 1: Write the failing tests**

Add to `src/test/worker.test.js`:

```js
describe('GET /admin/submissions', () => {
  const makeAdminToken = async () => {
    const payload = { ...TEST_PAYLOAD, isAdmin: true }
    return createToken(payload, TEST_SECRET)
  }

  it('returns 401 when not authenticated', async () => {
    const env = {
      AUTH_SECRET: TEST_SECRET,
      AUTH_STORE: { get: async () => null },
      PHOTOS: { list: async () => ({ objects: [] }) },
      FORM_SCRIPT_URL: 'https://script.google.com/fake',
    }
    const request = new Request('https://example.com/admin/submissions')
    const response = await worker.fetch(request, env)
    expect(response.status).toBe(401)
  })

  it('returns 403 when authenticated but not admin', async () => {
    const env = {
      AUTH_SECRET: TEST_SECRET,
      AUTH_STORE: { get: async () => null },
      PHOTOS: { list: async () => ({ objects: [] }) },
      FORM_SCRIPT_URL: 'https://script.google.com/fake',
    }
    const request = new Request('https://example.com/admin/submissions', {
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    })
    const response = await worker.fetch(request, env)
    expect(response.status).toBe(403)
  })

  it('returns photos and submissions for admin', async () => {
    const adminToken = await makeAdminToken()
    const fakeRows = [{ timestamp: '2026-01-01', routeId: 'r1', locationId: '001', teamName: 'Team A', email: '', fields: '{}' }]
    global.fetch = vi.fn(() => Promise.resolve(
      new Response(JSON.stringify({ ok: true, rows: fakeRows }), {
        headers: { 'Content-Type': 'application/json' },
      })
    ))
    const env = {
      AUTH_SECRET: TEST_SECRET,
      AUTH_STORE: { get: async () => null },
      PHOTOS: { list: async () => ({ objects: [{ key: 'team_a--r1--001--123.jpg' }] }) },
      FORM_SCRIPT_URL: 'https://script.google.com/fake',
    }
    const request = new Request('https://example.com/admin/submissions', {
      headers: { Cookie: `freedom_hunt_auth=${adminToken}` },
    })
    const response = await worker.fetch(request, env)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.ok).toBe(true)
    expect(data.photos).toEqual(['team_a--r1--001--123.jpg'])
    expect(data.submissions).toEqual(fakeRows)
  })

  it('returns empty submissions array when sheet GET fails', async () => {
    const adminToken = await makeAdminToken()
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))
    const env = {
      AUTH_SECRET: TEST_SECRET,
      AUTH_STORE: { get: async () => null },
      PHOTOS: { list: async () => ({ objects: [{ key: 'team_a--r1--001--456.jpg' }] }) },
      FORM_SCRIPT_URL: 'https://script.google.com/fake',
    }
    const request = new Request('https://example.com/admin/submissions', {
      headers: { Cookie: `freedom_hunt_auth=${adminToken}` },
    })
    const response = await worker.fetch(request, env)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.ok).toBe(true)
    expect(data.submissions).toEqual([])
    expect(data.photos).toEqual(['team_a--r1--001--456.jpg'])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- src/test/worker.test.js
```

Expected: FAIL — route doesn't exist yet.

- [ ] **Step 3: Add the `GET /admin/submissions` handler to `src/worker.js`**

Insert before the `GET /photo/:key` block (or before the `ASSETS` fallback — order doesn't matter as long as it's before the fallback):

```js
if (request.method === 'GET' && url.pathname === '/admin/submissions') {
  const authPayload = await requireAuth(request, env)
  if (!authPayload) return json({ ok: false, error: 'Unauthorized' }, 401)
  if (!authPayload.isAdmin) return json({ ok: false, error: 'Forbidden' }, 403)

  const listed = await env.PHOTOS.list()
  const photos = listed.objects.map(o => o.key)

  let submissions = []
  try {
    const res = await fetch(env.FORM_SCRIPT_URL, { method: 'GET' })
    const data = await res.json()
    submissions = data.rows ?? []
  } catch {}

  return json({ ok: true, photos, submissions })
}
```

- [ ] **Step 4: Run all worker tests — confirm they pass**

```
npm test -- src/test/worker.test.js
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```
git add src/worker.js src/test/worker.test.js
git commit -m "feat: add GET /admin/submissions endpoint for organiser dashboard"
```
