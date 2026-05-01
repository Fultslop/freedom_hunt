# Task 1 — Worker /form-submit route

**Files:**
- Modify: `src/worker.js`
- Modify: `src/test/worker.test.js`

---

- [ ] **Step 1: Write failing tests for /form-submit**

`src/test/worker.test.js` currently starts with:
```js
import { describe, it, expect } from 'vitest'
import { buildR2Key } from '../worker.js'
```

Make two changes:
1. Update the vitest import to add `vi` and `afterEach`
2. Add the default `worker` import alongside the named `buildR2Key` import
3. Append the new describe block after the existing one

The file should look like this after editing:

```js
import { describe, it, expect, vi, afterEach } from 'vitest'
import worker, { buildR2Key } from '../worker.js'

describe('buildR2Key', () => {
  it('uses jpg extension for jpeg mime type', () => {
    expect(buildR2Key('001', 'image/jpeg', 1000000)).toBe('001_1000000.jpg')
  })

  it('uses png extension for png mime type', () => {
    expect(buildR2Key('001', 'image/png', 1000000)).toBe('001_1000000.png')
  })

  it('falls back to jpg for unknown mime type', () => {
    expect(buildR2Key('001', 'image/webp', 1000000)).toBe('001_1000000.jpg')
  })
})

describe('/form-submit', () => {
  afterEach(() => vi.restoreAllMocks())

  it('forwards payload to FORM_SCRIPT_URL and returns ok', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('ok')))
    const env = { FORM_SCRIPT_URL: 'https://script.google.com/fake' }
    const body = JSON.stringify({ locationId: '001', timestamp: '2026-01-01T00:00:00Z', submitterId: 'Alice', fields: {} })
    const request = new Request('https://example.com/form-submit', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
    })

    const response = await worker.fetch(request, env)

    expect(global.fetch).toHaveBeenCalledWith(
      'https://script.google.com/fake',
      expect.objectContaining({ method: 'POST', body })
    )
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.ok).toBe(true)
  })

  it('returns 500 when fetch throws', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')))
    const env = { FORM_SCRIPT_URL: 'https://script.google.com/fake' }
    const request = new Request('https://example.com/form-submit', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const response = await worker.fetch(request, env)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm run test:run -- src/test/worker.test.js
```

Expected: the 3 existing `buildR2Key` tests still PASS; the 2 new `/form-submit` tests FAIL because the route doesn't exist yet.

- [ ] **Step 3: Implement the /form-submit route in worker.js**

Add the new route block **before** the `if (!env.ASSETS)` fallthrough in `src/worker.js`:

```js
if (request.method === 'POST' && url.pathname === '/form-submit') {
  try {
    const body = await request.text()
    await fetch(env.FORM_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Submission failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
```

Full `src/worker.js` after the edit:

```js
export function buildR2Key(locationId, mimeType, timestamp) {
  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  return `${locationId}_${timestamp}.${ext}`
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'POST' && url.pathname === '/upload') {
      try {
        const formData = await request.formData()
        const photo = formData.get('photo')
        const locationId = formData.get('locationId') || 'unknown'
        const key = buildR2Key(locationId, photo.type, Date.now())
        await env.PHOTOS.put(key, photo.stream(), {
          httpMetadata: { contentType: photo.type },
        })
        return new Response(JSON.stringify({ ok: true, key }), {
          headers: { 'Content-Type': 'application/json' },
        })
      } catch {
        return new Response(JSON.stringify({ ok: false, error: 'Upload failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    if (request.method === 'POST' && url.pathname === '/form-submit') {
      try {
        const body = await request.text()
        await fetch(env.FORM_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      } catch {
        return new Response(JSON.stringify({ ok: false, error: 'Submission failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    if (!env.ASSETS) {
      return new Response('Not found', { status: 404 })
    }
    return env.ASSETS.fetch(request)
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm run test:run -- src/test/worker.test.js
```

Expected: all tests PASS (3 existing + 2 new).

- [ ] **Step 5: Commit**

```
git add src/worker.js src/test/worker.test.js
git commit -m "feat: add POST /form-submit route to Worker"
```
