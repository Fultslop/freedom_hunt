# Task 02: Worker GitHub Proxy Routes

Status: Completed

> Part of [2026-05-02-location-editor.md](2026-05-02-location-editor.md)

**Goal:** Add three Worker routes used by the editor. These require admin auth (from Task 03 — implement that first, then come back and verify these routes are protected). For now the tests mock a valid admin token.

- `GET /editor/locations?project=X&city=Y` — lists location YAMLs from GitHub as parsed JSON
- `GET /editor/location?project=X&city=Y&file=001_loc_foo.yaml` — single parsed location
- `POST /editor/location` — creates a GitHub branch + commit + PR, returns `{ prUrl }`

**Files:**
- Modify: `src/worker.js` — add `import yaml`, helper functions, three route handlers
- Modify: `src/test/worker.test.js` — tests for all three routes

---

- [ ] **Step 1: Write the failing tests**

Add to `src/test/worker.test.js` (after existing test blocks). The helpers `createToken` and `TEST_SECRET` / `TEST_PAYLOAD` are already defined at the top of that file:

```js
// ── helpers ──────────────────────────────────────────────────────────────
const makeAdminEnv = () => ({
  AUTH_SECRET: TEST_SECRET,
  AUTH_STORE: { get: async () => null },
  GITHUB_PAT: 'fake-pat',
  GITHUB_REPO: 'owner/repo',
})

const makeAdminToken = () =>
  createToken({ ...TEST_PAYLOAD, isAdmin: true }, TEST_SECRET)

// ── GET /editor/locations ─────────────────────────────────────────────────
describe('GET /editor/locations', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns 401 for unauthenticated request', async () => {
    const request = new Request('https://example.com/editor/locations?project=p&city=c')
    const response = await worker.fetch(request, makeAdminEnv())
    expect(response.status).toBe(401)
  })

  it('returns parsed locations from GitHub', async () => {
    const adminToken = await makeAdminToken()
    const sampleYaml = 'locationId: 1\ntitle: Test Location\naddress: ""\n'
    const encoded = btoa(sampleYaml)

    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { name: '001_loc_test.yaml', path: 'src/data/text/en/projects/p/c/001_loc_test.yaml', type: 'file' },
        { name: 'cities.yaml', path: 'src/data/text/en/projects/p/cities.yaml', type: 'file' },
      ]), { headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: encoded + '\n', sha: 'abc123' }), {
        headers: { 'Content-Type': 'application/json' },
      }))

    const request = new Request('https://example.com/editor/locations?project=p&city=c', {
      headers: { Cookie: `freedom_hunt_auth=${adminToken}` },
    })
    const response = await worker.fetch(request, makeAdminEnv())
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.ok).toBe(true)
    expect(data.locations).toHaveLength(1)
    expect(data.locations[0].filename).toBe('001_loc_test.yaml')
    expect(data.locations[0].location.title).toBe('Test Location')
    expect(data.locations[0].sha).toBe('abc123')
  })
})

// ── GET /editor/location ──────────────────────────────────────────────────
describe('GET /editor/location', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns single parsed location', async () => {
    const adminToken = await makeAdminToken()
    const sampleYaml = 'locationId: 2\ntitle: Peace Palace\naddress: ""\n'
    const encoded = btoa(sampleYaml)

    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ content: encoded + '\n', sha: 'def456' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const request = new Request(
      'https://example.com/editor/location?project=p&city=c&file=002_loc_peace.yaml',
      { headers: { Cookie: `freedom_hunt_auth=${adminToken}` } }
    )
    const response = await worker.fetch(request, makeAdminEnv())
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.ok).toBe(true)
    expect(data.location.title).toBe('Peace Palace')
    expect(data.sha).toBe('def456')
  })
})

// ── POST /editor/location ─────────────────────────────────────────────────
describe('POST /editor/location', () => {
  afterEach(() => vi.restoreAllMocks())

  it('creates branch, commits file, opens PR and returns prUrl', async () => {
    const adminToken = await makeAdminToken()

    global.fetch = vi.fn()
      // 1. get HEAD SHA
      .mockResolvedValueOnce(new Response(JSON.stringify({ object: { sha: 'head-sha' } }), {
        headers: { 'Content-Type': 'application/json' },
      }))
      // 2. create branch
      .mockResolvedValueOnce(new Response(JSON.stringify({ ref: 'refs/heads/editor/001-123' }), {
        headers: { 'Content-Type': 'application/json' },
      }))
      // 3. get existing file SHA (404 = new file)
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
      // 4. PUT file
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: { sha: 'new-sha' } }), {
        headers: { 'Content-Type': 'application/json' },
      }))
      // 5. create PR
      .mockResolvedValueOnce(new Response(JSON.stringify({ html_url: 'https://github.com/owner/repo/pull/1', number: 1 }), {
        headers: { 'Content-Type': 'application/json' },
      }))

    const body = JSON.stringify({
      project: 'p',
      city: 'c',
      filename: '001_loc_test.yaml',
      existingSha: null,
      location: { locationId: 1, title: 'New Location', address: '' },
    })
    const request = new Request('https://example.com/editor/location', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json', Cookie: `freedom_hunt_auth=${adminToken}` },
    })
    const response = await worker.fetch(request, makeAdminEnv())
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.ok).toBe(true)
    expect(data.prUrl).toBe('https://github.com/owner/repo/pull/1')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- src/test/worker.test.js
```

Expected: FAIL — the three new route groups all fail (routes don't exist yet).

- [ ] **Step 3: Add `import yaml` and GitHub helper functions to `src/worker.js`**

Add at the very top of `src/worker.js`, before the existing `function json(...)`:

```js
import yaml from 'js-yaml'

async function githubRequest(path, options = {}, env) {
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${env.GITHUB_PAT}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'freedom-hunt-editor',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub ${res.status}: ${err}`)
  }
  return res.json()
}

function decodeGitHubContent(base64) {
  const raw = atob(base64.replace(/\s/g, ''))
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function encodeGitHubContent(str) {
  const bytes = new TextEncoder().encode(str)
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('')
  return btoa(binary)
}

async function createLocationPR(project, city, filename, yamlContent, existingSha, prTitle, env) {
  const ref = await githubRequest('/git/ref/heads/main', {}, env)
  const headSha = ref.object.sha

  const branchName = `editor/${filename.replace('.yaml', '')}-${Date.now()}`
  await githubRequest('/git/refs', {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: headSha }),
  }, env)

  const filePath = `src/data/text/en/projects/${project}/${city}/${filename}`
  let currentSha = existingSha
  if (!currentSha) {
    try {
      const existing = await githubRequest(`/contents/${filePath}`, {}, env)
      currentSha = existing.sha
    } catch {}
  }

  const putBody = {
    message: prTitle,
    content: encodeGitHubContent(yamlContent),
    branch: branchName,
  }
  if (currentSha) putBody.sha = currentSha
  await githubRequest(`/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify(putBody),
  }, env)

  const pr = await githubRequest('/pulls', {
    method: 'POST',
    body: JSON.stringify({
      title: prTitle,
      body: `Auto-generated by the Freedom Hunt location editor.\n\nFile: \`${filePath}\``,
      head: branchName,
      base: 'main',
    }),
  }, env)

  return { prUrl: pr.html_url, prNumber: pr.number, branchName }
}
```

- [ ] **Step 4: Add the three route handlers to `src/worker.js`**

Insert the following three blocks **before** the `if (!env.ASSETS)` fallback at the bottom of the `fetch` handler. Paste all three together:

```js
if (request.method === 'GET' && url.pathname === '/editor/locations') {
  const authPayload = await requireAuth(request, env)
  if (!authPayload?.isAdmin) return json({ ok: false, error: 'Forbidden' }, authPayload ? 403 : 401)
  const project = url.searchParams.get('project')
  const city = url.searchParams.get('city')
  if (!project || !city) return json({ ok: false, error: 'Missing project or city' }, 400)
  try {
    const dirPath = `src/data/text/en/projects/${project}/${city}`
    const files = await githubRequest(`/contents/${dirPath}`, {}, env)
    const locFiles = files.filter(f => f.type === 'file' && /^\d+_loc_.*\.yaml$/.test(f.name))
    const locations = await Promise.all(locFiles.map(async f => {
      const fileData = await githubRequest(`/contents/${f.path}`, {}, env)
      const content = decodeGitHubContent(fileData.content)
      const location = yaml.load(content)
      return { filename: f.name, sha: fileData.sha, location }
    }))
    return json({ ok: true, locations })
  } catch (err) {
    return json({ ok: false, error: err.message }, 502)
  }
}

if (request.method === 'GET' && url.pathname === '/editor/location') {
  const authPayload = await requireAuth(request, env)
  if (!authPayload?.isAdmin) return json({ ok: false, error: 'Forbidden' }, authPayload ? 403 : 401)
  const project = url.searchParams.get('project')
  const city = url.searchParams.get('city')
  const file = url.searchParams.get('file')
  if (!project || !city || !file) return json({ ok: false, error: 'Missing params' }, 400)
  try {
    const filePath = `src/data/text/en/projects/${project}/${city}/${file}`
    const fileData = await githubRequest(`/contents/${filePath}`, {}, env)
    const content = decodeGitHubContent(fileData.content)
    const location = yaml.load(content)
    return json({ ok: true, filename: file, sha: fileData.sha, location })
  } catch (err) {
    return json({ ok: false, error: err.message }, 502)
  }
}

if (request.method === 'POST' && url.pathname === '/editor/location') {
  const authPayload = await requireAuth(request, env)
  if (!authPayload?.isAdmin) return json({ ok: false, error: 'Forbidden' }, authPayload ? 403 : 401)
  try {
    const { project, city, filename, existingSha, location } = await request.json()
    if (!project || !city || !filename || !location) {
      return json({ ok: false, error: 'Missing fields' }, 400)
    }
    const yamlContent = yaml.dump(location, { lineWidth: -1, noRefs: true, indent: 2 })
    const action = location.hidden ? 'Hide' : (existingSha ? 'Edit' : 'Add')
    const prTitle = `${action} location: ${location.title || filename}`
    const result = await createLocationPR(project, city, filename, yamlContent, existingSha, prTitle, env)
    return json({ ok: true, ...result })
  } catch (err) {
    return json({ ok: false, error: err.message }, 502)
  }
}
```

- [ ] **Step 5: Run all worker tests — confirm they pass**

```
npm test -- src/test/worker.test.js
```

Expected: All tests pass including the new editor route tests.

- [ ] **Step 6: Commit**

```
git add src/worker.js src/test/worker.test.js
git commit -m "feat: add Worker GitHub proxy routes for location editor"
```
