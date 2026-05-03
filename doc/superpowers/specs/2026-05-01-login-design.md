# Login & Authentication — Design Spec

**Date:** 2026-05-01  
**Status:** Approved (v2 — cookie-based, rate-limited)

---

## Overview

Add project-level access control to the Freedom Hunt app. When a participant accesses any page under a project (via the home screen or a direct deep link), they are shown a full-screen login form. They enter the project password distributed by the event organizer. One password covers the entire project — all cities and routes beneath it. On success, the Worker sets an httpOnly cookie with a signed session token valid for 30 days.

---

## Trust Model

This system provides **access control, not authentication** — similar to how Miro boards protect access with a shared link/code:

- **One shared password per project** — a single password unlocks the entire project; all participant teams use the same code
- **Team name is a self-reported identifier** — it is not verified by the server and exists only for the duration of the event (e.g. to display on a leaderboard)
- **Contact email is optional and unverified** — provided at the user's discretion for future outreach; never validated
- **The password keeps out casual browsers** — it is not protecting secrets; organizers will pick simple codes for ease of sharing at events

---

## Decisions & Constraints

- **KV-backed passwords** — stored in Cloudflare KV as plaintext, editable via the Cloudflare dashboard without redeployment. Plaintext is acceptable because: (a) the password is a shared room code, not a secret; (b) organizers need to read it back from the dashboard when they forget it
- **httpOnly cookie** — the Worker sets a signed session cookie on login. The browser sends it automatically on every request. The React app never touches the raw token, eliminating XSS exposure
- **Worker-issued signed token** — HMAC-SHA256, 30-day expiry, stored in an httpOnly cookie
- **Full-screen login page** — not a modal; no project content visible behind it
- **Both entry points protected** — home screen navigation and direct deep links both hit the auth gate
- **No `/auth/required` endpoint** — project routes always check for a valid cookie; if absent, the React app shows the login page. This eliminates a network round-trip and a maintenance surface
- **Rate limiting** — KV-backed, 5 login attempts per IP per 60 seconds. Protects simple room codes from brute force
- **Password rotation bleed-through is acceptable** — existing sessions remain valid up to 30 days after a password change; rotating `AUTH_SECRET` invalidates everything immediately
- **Session duration change requires a one-line code change + redeploy** — acceptable

---

## Architecture

### Cloudflare

| Resource                   | Detail                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| KV namespace               | `AUTH_STORE` — bound in `wrangler.jsonc`                                                           |
| KV key format              | `auth:{projectId}` → plaintext password (e.g. `auth:democrats_abroad`)                             |
| KV key format (rate limit) | `rl:{ip}` → JSON `{ count: N, windowStart: timestamp }` with 60s TTL                               |
| Worker secret              | `AUTH_SECRET` — set via `wrangler secret put AUTH_SECRET`                                          |
| New endpoint               | `POST /auth/login` — validate password, set httpOnly cookie, return user info                      |
| New endpoint               | `GET /auth/me` — return decoded token payload from cookie (for React to display team name/contact) |
| New endpoint               | `POST /auth/logout` — clear the cookie                                                             |
| Protected endpoints        | `/upload`, `/form-submit` (validate cookie)                                                        |

### Token Format

```
base64url(JSON.stringify(payload)) + "." + base64url(HMAC-SHA256(payload, AUTH_SECRET))
```

Payload shape:

```json
{
  "project": "democrats_abroad",
  "teamName": "The Founding Runners",
  "contact": "team@example.com",
  "exp": 1748000000
}
```

The payload is **not encrypted** — it is base64-encoded and readable by anyone who intercepts the token. This is acceptable because the payload contains no secrets (team name and contact are self-reported identifiers).

### Cookie

```
Set-Cookie: freedom_hunt_auth={signed-token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000
```

- `HttpOnly` — JavaScript cannot read the cookie (XSS protection)
- `Secure` — only sent over HTTPS
- `SameSite=Strict` — not sent on cross-origin requests (CSRF protection)
- `Path=/` — sent on all requests to the Worker
- `Max-Age=2592000` — 30 days in seconds

The cookie's `project` field is checked against the URL on every request to ensure the token matches the requested project.

### React

| Item                          | Detail                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/auth/AuthContext.jsx`    | New — calls `GET /auth/me` on mount; exposes `{ activeAuth, login, logout }`                                               |
| `src/auth/ProtectedRoute.jsx` | New — reads `projectId` from URL params, checks auth for that project, renders `LoginPage` if unauthenticated              |
| `src/pages/LoginPage.jsx`     | New — full-screen themed login form                                                                                        |
| `src/App.jsx`                 | Add `AuthProvider`; wrap `/:project`, `/:project/:city`, `/:project/:city/:route` with `ProtectedRoute`                    |
| `src/components/TitleBar.jsx` | Drill-down menu replaces flat theme list                                                                                   |
| `src/worker.js`               | Add `/auth/login`, `/auth/me`, `/auth/logout` handlers; add rate limiting; validate cookie on `/upload` and `/form-submit` |

---

## Worker: POST /auth/login

**Request body:**

```json
{
  "project": "democrats_abroad",
  "teamName": "The Founding Runners",
  "contact": "team@example.com",
  "password": "hunter2"
}
```

**Flow:**

1. **Rate limit check** — look up `rl:{clientIP}` in KV. If count ≥ 5 and windowStart is within 60 seconds → 429 `{ ok: false, error: 'Too many attempts. Please wait a moment.' }`
2. Look up `AUTH_STORE.get('auth:' + project)`
3. If not found → increment rate limit counter → 401 `{ ok: false, error: 'Project not found' }`
4. Compare password (case-sensitive exact match)
5. If mismatch → increment rate limit counter → 401 `{ ok: false, error: 'Incorrect password' }`
6. Build payload `{ project, teamName, contact, exp: now + 30 * 24 * 60 * 60 }`
7. Sign with HMAC-SHA256 using `AUTH_SECRET`
8. Return 200 with `Set-Cookie` header and body `{ ok: true, teamName, contact }`

**Rate limit implementation:**

```javascript
async function checkRateLimit(ip, env) {
  const key = `rl:${ip}`;
  const raw = await env.AUTH_STORE.get(key);
  const now = Date.now();
  let record = raw ? JSON.parse(raw) : { count: 0, windowStart: now };
  if (now - record.windowStart > 60000) {
    record = { count: 0, windowStart: now };
  }
  record.count++;
  await env.AUTH_STORE.put(key, JSON.stringify(record), { expirationTtl: 60 });
  return record.count > 5;
}
```

---

## Worker: GET /auth/me

**Flow:**

1. Read `freedom_hunt_auth` cookie from request
2. If absent → 401 `{ ok: false, error: 'Not authenticated' }`
3. Verify token signature and expiry
4. Return 200 `{ ok: true, project, teamName, contact }`

---

## Worker: POST /auth/logout

**Flow:**

1. Return 200 with `Set-Cookie: freedom_hunt_auth=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0` (clears the cookie)
2. Return `{ ok: true }`

---

## Worker: Cookie validation helper

Used by `/upload`, `/form-submit`, and `/auth/me`:

```javascript
async function requireAuth(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)freedom_hunt_auth=([^;]+)/);
  if (!match) return null;
  return verifyToken(match[1], env.AUTH_SECRET);
}
```

**`/upload` and `/form-submit`:** If `requireAuth` returns null → 401 `{ ok: false, error: 'Unauthorized' }`.

---

## React: AuthContext

```
AuthProvider
  - on mount: call GET /auth/me; if 200, set activeAuth to { projectId, teamName, contact }
  - activeAuth: { projectId, teamName, contact } | null
  - login(projectId, teamName, contact): called after successful POST /auth/login;
              sets activeAuth directly (no token handling — cookie is set by Worker)
  - logout(): call POST /auth/logout; clear activeAuth
```

`AuthProvider` wraps the entire app in `App.jsx`. It does not read or manage tokens — the browser handles the cookie automatically.

TitleBar reads `activeAuth` to populate the Profile sub-view (team name and contact).

---

## React: ProtectedRoute

```jsx
function ProtectedRoute({ children }) {
  const { project } = useParams();
  const { activeAuth } = useAuth();
  if (!activeAuth || activeAuth.projectId !== project) return <LoginPage />;
  return children;
}
```

No network call needed — `AuthContext` already knows the auth state from `GET /auth/me`. If the user is not authenticated for this project, show the login page.

---

## LoginPage

- Full-screen, themed (uses `useTheme()`)
- Injects `<style>` reset tag per project convention
- Fields: **Team name** (required), **Contact email** (optional), **Password** (required)
- Submit button: "Join the Hunt"
- On submit: `POST /auth/login` → on success call `login(projectId, teamName, contact)` (AuthContext) → ProtectedRoute re-renders the actual page
- Error state: red border on password field, message "Incorrect password. Please try again."
- Rate limit state: message "Too many attempts. Please wait a moment."
- Loading state: button disabled with "Joining…" text while request is in flight

---

## TitleBar Menu Redesign

**Current:** flat dropdown listing theme names.

**New:** drill-down pattern.

```
☰ opens panel
  ├── Profile  ›
  └── Themes   ›

Profile sub-view:
  ‹ Profile
  ─────────────
  Team:    The Founding Runners
  Contact: team@example.com
  [Sign out]

Themes sub-view:
  ‹ Themes
  ─────────────
  ● GWC       ✓
    app
    wireframe
```

- Back arrow (`‹`) returns to the top-level list
- Menu state: `null` (closed) | `'root'` (top level) | `'profile'` | `'themes'`
- Profile sub-view reads `teamName` and `contact` from `activeAuth` in `AuthContext`
- Sign out: calls `logout()` from `AuthContext`, closes menu
- Scales to future menu items by adding rows to the root list

---

## Session Lifecycle

| Event                    | Behaviour                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| First visit / deep link  | `ProtectedRoute` checks auth → no `activeAuth` → `LoginPage`                                     |
| Successful login         | Worker sets httpOnly cookie, React stores `activeAuth` → `ProtectedRoute` re-renders actual page |
| Returning within 30 days | Cookie sent automatically, `GET /auth/me` populates `activeAuth` → skips login                   |
| Token expired            | `GET /auth/me` returns 401 → `activeAuth` is null → `LoginPage`                                  |
| Sign out                 | `POST /auth/logout` clears cookie, React clears `activeAuth` → `LoginPage`                       |
| Password rotated         | Existing cookies remain valid up to 30 days                                                      |
| `AUTH_SECRET` rotated    | All cookies immediately invalid (signature check fails)                                          |
| Too many login attempts  | 429 response → rate limit message shown                                                          |

---

## One-time Developer Setup

1. Create `AUTH_STORE` KV namespace: `wrangler kv namespace create AUTH_STORE`
2. Add binding to `wrangler.jsonc` (copy the ID from step 1 output)
3. Set signing secret: `openssl rand -base64 48 | wrangler secret put AUTH_SECRET`
4. Deploy: `npm run deploy`
5. Add a project password: `wrangler kv key put --namespace-id=<ID> "auth:democrats_abroad" "your_room_code"`

---

## Unprotected Projects

Some projects may need to be accessible without a password (e.g. for testing or public events). The system supports this without code changes.

**How it works:** A new Worker endpoint `GET /auth/required?project={projectId}` returns `{ required: true }` if a KV entry exists for that project, `{ required: false }` if not. `ProtectedRoute` calls this on mount before deciding whether to show the login form.

```
ProtectedRoute on mount:
  GET /auth/required?project=democrats_abroad
  → { required: false } → render children immediately
  → { required: true }  → check for valid local token
                              valid  → render children
                              none   → show LoginPage
```

To make a project unprotected: simply do not add a `auth:{projectId}` entry to the KV store (or delete the existing one). No redeployment needed.

The `GET /auth/required` endpoint is in scope for this implementation — `ProtectedRoute` depends on it.

---

## Out of Scope

- Editing team name or contact after login
- Per-user credentials (this is a shared team password)
- Admin UI for managing passwords
- Server-side session storage or revocation list
