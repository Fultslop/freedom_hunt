# Task 02 — Worker: token utilities + rate limiting

**Files:**
- Modify: `src/worker.js`

No automated tests for worker code (Cloudflare Workers runtime APIs are not available in Vitest). Manual verification in Step 5.

---

- [ ] **Step 1: Add a `json` helper, token utilities, and rate limiter at the top of src/worker.js**

Insert the following block immediately before the `export function buildR2Key` line:

```javascript
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlDecode(str) {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'))
}

export async function createToken(payload, secret) {
  const encoded = b64urlEncode(JSON.stringify(payload))
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(encoded))
  const sigB64 = b64urlEncode(String.fromCharCode(...new Uint8Array(sig)))
  return `${encoded}.${sigB64}`
}

export async function verifyToken(token, secret) {
  try {
    const dot = token.lastIndexOf('.')
    if (dot === -1) return null
    const encoded = token.slice(0, dot)
    const sigB64 = token.slice(dot + 1)
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['verify']
    )
    const sigBytes = Uint8Array.from(b64urlDecode(sigB64), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(encoded))
    if (!valid) return null
    const payload = JSON.parse(b64urlDecode(encoded))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

async function checkRateLimit(ip, env) {
  const key = `rl:${ip}`
  const raw = await env.AUTH_STORE.get(key)
  const now = Date.now()
  let record = raw ? JSON.parse(raw) : { count: 0, windowStart: now }
  if (now - record.windowStart > 60000) {
    record = { count: 0, windowStart: now }
  }
  record.count++
  await env.AUTH_STORE.put(key, JSON.stringify(record), { expirationTtl: 60 })
  return record.count > 5
}

async function requireAuth(request, env) {
  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(/(?:^|;\s*)freedom_hunt_auth=([^;]+)/)
  if (!match) return null
  return verifyToken(match[1], env.AUTH_SECRET)
}
```

- [ ] **Step 2: Replace bare `new Response(JSON.stringify(...))` calls with the json() helper**

The existing `/upload` and `/form-submit` handlers use `new Response(JSON.stringify(...), { headers: ... })`. Replace each with `json(...)` for consistency:

In the `/upload` success return:
```javascript
        return json({ ok: true, key })
```

In the `/upload` catch return:
```javascript
        return json({ ok: false, error: 'Upload failed' }, 500)
```

In the `/form-submit` success return:
```javascript
        return json({ ok: scriptData.ok ?? true })
```

In the `/form-submit` catch return:
```javascript
        return json({ ok: false, error: 'Submission failed' }, 500)
```

- [ ] **Step 3: Build to verify no syntax errors**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/worker.js
git commit -m "feat: add token utilities, rate limiter, and cookie auth helper to worker"
```

In the `/form-submit` catch return:
```javascript
        return json({ ok: false, error: 'Submission failed' }, 500)
```

- [ ] **Step 4: Build the project to verify no syntax errors**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 5: Manually verify /auth/required with wrangler dev**

```bash
npm run preview
```

In another terminal:
```bash
# Project with no KV entry → required: false
curl "http://localhost:8787/auth/required?project=test_project"
# Expected: {"required":false}
```

To test `required: true`, add a KV entry via `wrangler kv key put --namespace-id=<id> "auth:test_project" "testpass"` and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/worker.js
git commit -m "feat: add token utilities and /auth/required Worker endpoint"
```
