# Task 04 — Worker: /auth/me, /auth/logout, and protect /upload + /form-submit

**Files:**
- Modify: `src/worker.js`

---

- [ ] **Step 1: Add the /auth/me endpoint inside the fetch handler**

In `src/worker.js`, add this block immediately after the `/auth/login` block (before the `/upload` handler):

```javascript
    if (request.method === 'GET' && url.pathname === '/auth/me') {
      const payload = await requireAuth(request, env)
      if (!payload) return json({ ok: false, error: 'Not authenticated' }, 401)
      return json({ ok: true, project: payload.project, teamName: payload.teamName, contact: payload.contact })
    }
```

- [ ] **Step 2: Add the /auth/logout endpoint inside the fetch handler**

Add this block immediately after the `/auth/me` block:

```javascript
    if (request.method === 'POST' && url.pathname === '/auth/logout') {
      return json(
        { ok: true },
        200,
        { 'Set-Cookie': 'freedom_hunt_auth=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' }
      )
    }
```

- [ ] **Step 3: Add auth check to the /upload handler**

At the very top of the `/upload` handler body (first line inside the `if` block, before `try`):

```javascript
    if (request.method === 'POST' && url.pathname === '/upload') {
      const authPayload = await requireAuth(request, env)
      if (!authPayload) return json({ ok: false, error: 'Unauthorized' }, 401)
      try {
        // ... rest of handler unchanged
```

- [ ] **Step 4: Add auth check to the /form-submit handler**

Same pattern — first line inside the `/form-submit` `if` block:

```javascript
    if (request.method === 'POST' && url.pathname === '/form-submit') {
      const authPayload = await requireAuth(request, env)
      if (!authPayload) return json({ ok: false, error: 'Unauthorized' }, 401)
      try {
        // ... rest of handler unchanged
```

- [ ] **Step 5: Build to verify no syntax errors**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 6: Manually verify endpoints**

```bash
npm run preview
```

```bash
# /auth/me without cookie → 401
curl http://localhost:8787/auth/me
# Expected: {"ok":false,"error":"Not authenticated"}

# /auth/me with valid cookie → user info
# First login to get a cookie, then:
curl -v -b "freedom_hunt_auth=<TOKEN_FROM_LOGIN>" http://localhost:8787/auth/me
# Expected: {"ok":true,"project":"test_project","teamName":"Team A","contact":"a@b.com"}

# /auth/logout → clears cookie
curl -v -X POST http://localhost:8787/auth/logout
# Expected: Set-Cookie: freedom_hunt_auth=; HttpOnly; ... Max-Age=0

# /upload without cookie → 401
curl -X POST http://localhost:8787/upload
# Expected: {"ok":false,"error":"Unauthorized"}

# /form-submit without cookie → 401
curl -X POST http://localhost:8787/form-submit
# Expected: {"ok":false,"error":"Unauthorized"}
```

- [ ] **Step 7: Commit**

```bash
git add src/worker.js
git commit -m "feat: add /auth/me, /auth/logout, and cookie auth on /upload + /form-submit"
```
