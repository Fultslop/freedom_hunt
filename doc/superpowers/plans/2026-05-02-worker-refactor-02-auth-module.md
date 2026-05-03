# Task 02 — Extract auth utilities module

> **Index:** [worker-refactor](2026-05-02-worker-refactor.md) | **Depends on:** Task 01

**Goal:** Move all authentication and token logic out of `src/worker.js` into `src/worker/auth.js`, replacing magic values with named constants. Add direct unit tests for `createToken`, `verifyToken`, and `checkRateLimit`.

**Files:**
- Create: `src/worker/auth.js`
- Create: `src/test/worker.auth.test.js`
- Modify: `src/worker.js`

---

- [ ] **Step 1: Write the unit tests (they will fail — auth.js doesn't exist yet)**

Create `src/test/worker.auth.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { createToken, verifyToken, checkRateLimit } from '../worker/auth.js'

const SECRET = 'test-secret'
const now = () => Math.floor(Date.now() / 1000)

describe('createToken / verifyToken', () => {
  it('round-trips a payload', async () => {
    const payload = { project: 'p', exp: now() + 3600 }
    const token = await createToken(payload, SECRET)
    const result = await verifyToken(token, SECRET)
    expect(result.project).toBe('p')
  })

  it('returns null for an expired token', async () => {
    const payload = { project: 'p', exp: now() - 1 }
    const token = await createToken(payload, SECRET)
    expect(await verifyToken(token, SECRET)).toBeNull()
  })

  it('returns null for a tampered token', async () => {
    const payload = { project: 'p', exp: now() + 3600 }
    const token = await createToken(payload, SECRET)
    const tampered = token.slice(0, -4) + 'xxxx'
    expect(await verifyToken(tampered, SECRET)).toBeNull()
  })

  it('returns null when signed with the wrong secret', async () => {
    const payload = { project: 'p', exp: now() + 3600 }
    const token = await createToken(payload, SECRET)
    expect(await verifyToken(token, 'wrong-secret')).toBeNull()
  })

  it('returns null for a token without a dot separator', async () => {
    expect(await verifyToken('nodot', SECRET)).toBeNull()
  })
})

describe('checkRateLimit', () => {
  const makeStore = () => {
    const data = {}
    return {
      get: async (k) => data[k] ?? null,
      put: async (k, v) => { data[k] = v },
    }
  }

  it('allows the first 5 requests within the window', async () => {
    const env = { AUTH_STORE: makeStore() }
    for (let i = 0; i < 5; i++) {
      expect(await checkRateLimit('10.0.0.1', env)).toBe(false)
    }
  })

  it('blocks the 6th request within the window', async () => {
    const env = { AUTH_STORE: makeStore() }
    for (let i = 0; i < 5; i++) await checkRateLimit('10.0.0.2', env)
    expect(await checkRateLimit('10.0.0.2', env)).toBe(true)
  })

  it('resets the counter after the 60-second window expires', async () => {
    const store = makeStore()
    await store.put('rl:10.0.0.3', JSON.stringify({ count: 5, windowStart: Date.now() - 61_000 }))
    const env = { AUTH_STORE: store }
    expect(await checkRateLimit('10.0.0.3', env)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail (module not found)**

```
npm run test -- src/test/worker.auth.test.js
```

Expected: FAIL — `Cannot find module '../worker/auth.js'`

---

- [ ] **Step 3: Create `src/worker/auth.js`**

This is the extracted module. The logic is identical to what is currently in `worker.js`; only the constants are new:

```js
export const COOKIE_NAME = 'freedom_hunt_auth'
export const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
export const AUTH_COOKIE_ATTRS = 'HttpOnly; Secure; SameSite=Strict; Path=/'

const AUTH_ALGO = { name: 'HMAC', hash: 'SHA-256' }
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_TTL_SECONDS = 60

function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlDecode(str) {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'))
}

export async function createToken(payload, secret) {
  const encoded = b64urlEncode(JSON.stringify(payload))
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), AUTH_ALGO, false, ['sign'])
  const sig = await crypto.subtle.sign(AUTH_ALGO.name, key, enc.encode(encoded))
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
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), AUTH_ALGO, false, ['verify'])
    const sigBytes = Uint8Array.from(b64urlDecode(sigB64), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify(AUTH_ALGO.name, key, sigBytes, enc.encode(encoded))
    if (!valid) return null
    const payload = JSON.parse(b64urlDecode(encoded))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// Tracks requests per IP in a 60-second sliding window. Returns true when over limit.
export async function checkRateLimit(ip, env) {
  const key = `rl:${ip}`
  const raw = await env.AUTH_STORE.get(key)
  const now = Date.now()
  let record = raw ? JSON.parse(raw) : { count: 0, windowStart: now }
  if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    record = { count: 0, windowStart: now }
  }
  record.count++
  await env.AUTH_STORE.put(key, JSON.stringify(record), { expirationTtl: RATE_LIMIT_TTL_SECONDS })
  return record.count > RATE_LIMIT_MAX
}

export async function requireAuth(request, env) {
  const cookie = request.headers.get('Cookie') || ''
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))
  if (!match) return null
  return verifyToken(match[1], env.AUTH_SECRET)
}
```

- [ ] **Step 4: Run unit tests to verify they pass**

```
npm run test -- src/test/worker.auth.test.js
```

Expected: all tests pass.

---

- [ ] **Step 5: Update `src/worker.js` to import from the new module**

Replace the top of `src/worker.js`. Remove the inline definitions of `b64urlEncode`, `b64urlDecode`, `createToken`, `verifyToken`, `checkRateLimit`, `requireAuth`, and the `TOKEN_TTL_SECONDS` constant. Replace them with imports:

```js
import yaml from 'js-yaml'
import { createToken, verifyToken, checkRateLimit, requireAuth, TOKEN_TTL_SECONDS, COOKIE_NAME, AUTH_COOKIE_ATTRS } from './worker/auth.js'
```

Update the two cookie strings in the `fetch` handler to use the imported constants:

Login success cookie (was):
```js
{ 'Set-Cookie': `freedom_hunt_auth=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000` }
```
Login success cookie (becomes):
```js
{ 'Set-Cookie': `${COOKIE_NAME}=${token}; ${AUTH_COOKIE_ATTRS}; Max-Age=2592000` }
```

Logout cookie (was):
```js
{ 'Set-Cookie': 'freedom_hunt_auth=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' }
```
Logout cookie (becomes):
```js
{ 'Set-Cookie': `${COOKIE_NAME}=; ${AUTH_COOKIE_ATTRS}; Max-Age=0` }
```

The `requireAuth` call in each route (`const authPayload = await requireAuth(request, env)`) remains unchanged — it now uses the imported function.

Keep `export async function createToken` and `export async function verifyToken` as re-exports so that `src/test/worker.test.js` can still import them directly from `worker.js`:
```js
export { createToken, verifyToken } from './worker/auth.js'
```

> **Note:** These re-exports will be removed in Task 04 when the test file is updated to import from `auth.js` directly.

- [ ] **Step 6: Run the full test suite to confirm nothing broke**

```
npm run test
```

Expected: all existing tests still pass, and the new auth unit tests pass.

- [ ] **Step 7: Commit**

```
git add src/worker/auth.js src/test/worker.auth.test.js src/worker.js
git commit -m "refactor: extract auth utilities to src/worker/auth.js"
```
