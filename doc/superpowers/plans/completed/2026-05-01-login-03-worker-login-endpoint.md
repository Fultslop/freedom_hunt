# Task 03 — Worker: /auth/login endpoint (httpOnly cookie)

**Files:**
- Modify: `src/worker.js`

---

- [ ] **Step 1: Add the /auth/login handler inside the fetch handler**

In `src/worker.js`, add this block immediately before the `/upload` handler:

```javascript
    if (request.method === 'POST' && url.pathname === '/auth/login') {
      try {
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown'
        const rateLimited = await checkRateLimit(clientIP, env)
        if (rateLimited) {
          return json({ ok: false, error: 'Too many attempts. Please wait a moment.' }, 429)
        }
        const { project, teamName, contact, password } = await request.json()
        if (!project || !password) {
          return json({ ok: false, error: 'Missing required fields' }, 400)
        }
        const stored = await env.AUTH_STORE.get(`auth:${project}`)
        if (stored === null) {
          return json({ ok: false, error: 'Project not found' }, 401)
        }
        if (password !== stored) {
          return json({ ok: false, error: 'Incorrect password' }, 401)
        }
        const payload = {
          project,
          teamName: teamName || '',
          contact: contact || '',
          exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
        }
        const token = await createToken(payload, env.AUTH_SECRET)
        return json(
          { ok: true, teamName: payload.teamName, contact: payload.contact },
          200,
          { 'Set-Cookie': `freedom_hunt_auth=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000` }
        )
      } catch {
        return json({ ok: false, error: 'Login failed' }, 500)
      }
    }
```

- [ ] **Step 2: Build to verify no syntax errors**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 3: Manually verify /auth/login with wrangler dev**

```bash
npm run preview
```

In another terminal, first add a test password to KV:
```bash
npx wrangler kv key put --namespace-id=<YOUR_KV_ID> "auth:test_project" "secret123"
```

Then test:
```bash
# Wrong password → 401
curl -v -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"project":"test_project","teamName":"Team A","contact":"a@b.com","password":"wrong"}'
# Expected: {"ok":false,"error":"Incorrect password"}

# Correct password → Set-Cookie header + user info
curl -v -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"project":"test_project","teamName":"Team A","contact":"a@b.com","password":"secret123"}'
# Expected: Set-Cookie: freedom_hunt_auth=<token>; HttpOnly; Secure; ...
# Body: {"ok":true,"teamName":"Team A","contact":"a@b.com"}

# Unknown project → 401
curl -v -X POST http://localhost:8787/auth/login \
  -H "Content-Type: application/json" \
  -d '{"project":"no_such_project","teamName":"X","contact":"","password":"x"}'
# Expected: {"ok":false,"error":"Project not found"}

# Rate limit — 6 rapid attempts → 429
for i in $(seq 1 6); do
  curl -s -X POST http://localhost:8787/auth/login \
    -H "Content-Type: application/json" \
    -d '{"project":"test_project","teamName":"X","contact":"","password":"wrong"}'
done
# Expected: 6th attempt returns {"ok":false,"error":"Too many attempts. Please wait a moment."}
```

- [ ] **Step 4: Commit**

```bash
git add src/worker.js
git commit -m "feat: add /auth/login Worker endpoint with httpOnly cookie and rate limiting"
```
