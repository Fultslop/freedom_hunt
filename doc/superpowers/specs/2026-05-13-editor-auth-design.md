# Editor Auth Design

**Date:** 2026-05-13
**Scope:** Individual editor accounts with organizer-controlled invite flow. Hunt-level auth modes (open/limited/restricted) per project. Does NOT include the organizer dashboard UI — that is a future spec.

---

## Background

The current system uses a single shared admin password per project stored in Cloudflare KV. Anyone who knows the password gets full editor access. The goal is to replace this with individual user accounts, a capability-based access model, and an invite flow that organizers control.

The design is intentionally staged:
- **Now:** editor auth (this spec)
- **Future:** organizer dashboard UI, hunt-level restricted access, fine-grained capabilities (per-city, per-action)

---

## Architecture

### What changes

| Layer | Now | After |
|-------|-----|-------|
| User identity | None (shared passwords) | D1 `users` table |
| Auth data | Cloudflare KV | D1 for accounts, capabilities, invites; KV stays for rate limiting |
| Sessions | Custom HMAC token cookie with `isAdmin` flag | Custom HMAC token cookie with `user_id`; capabilities fetched from D1 on `/auth/me` |
| Editor access | Shared admin password | Users with `editor` or `organizer` capability for that project |
| Participant access | Separate code path (shared team password → token with `teamName`, `contact`, `project`) | **Unchanged** — participant tokens remain a fully separate code path |
| Bootstrap | `admin:<project>` in KV | KV admin password remains as the one-time bootstrap to grant the first organizer into D1 |

### Token format

The existing token format is preserved: `base64url(JSON(payload)).base64url(hmac-sha256-signature)`. This is a custom format — not a standard JWT. No migration to standard JWT is planned.

There are three payload shapes. Discrimination is by field presence (not value), so the server must check for key existence, not truthiness — `"user_id" in payload` not `payload.user_id`:

| Shape | Key fields | Used for |
|-------|-----------|----------|
| Participant | `project`, `teamName`, `contact`, `isAdmin`, `exp` | Existing hunt participant/admin sessions — unchanged |
| Editor/user | `user_id` (non-null string), `exp` | Normal editor sessions |
| Bootstrap | `user_id: null`, `isBootstrap: true`, `project`, `exp` | One-time bootstrap only; 1h TTL |

The bootstrap shape uses `user_id: null` (key present, value null) to distinguish it from the editor shape (`user_id` is a non-null string) and the participant shape (`user_id` key absent). Verification code must treat a bootstrap token as invalid for any endpoint except `POST /auth/bootstrap/promote`.

### Session design

The auth token carries only `user_id` and `exp`. `/auth/me` queries D1 and returns the user's current active capabilities. Revocation takes effect on the next page load, with no TTL lag.

**Token TTL:** 30 days for editor/user sessions (matching current participant TTL). 1 hour for bootstrap tokens (see Bootstrap section).

### Participant auth (unchanged)

The participant login flow (`POST /auth/login` with `teamName`, `contact`, `project`, `password` against KV prefix `auth:`) is not modified by this spec. The `/auth/me` endpoint continues to serve both payload shapes. The `requireAuth` guard continues to work for participant sessions.

The existing `admin:<project>` KV path is not removed. It remains as a privileged bootstrap mechanism and long-term maintainer fallback.

---

## Prerequisites

Before implementation can begin:
- **D1 database** must be created and bound in `wrangler.jsonc` as `AUTH_DB`
- **wrangler.jsonc** must add a `d1_databases` binding: `{ binding: "AUTH_DB", database_name: "freedom_hunt_auth", database_id: "<id>" }`
- The `Env` type in `src/types/worker.ts` must gain `AUTH_DB: D1Database`
- The D1 schema (see below) must be applied via `wrangler d1 execute freedom_hunt_auth --file=migrations/001_init.sql`

---

## Data Model (D1)

Schema lives in `migrations/001_init.sql` and is applied via `wrangler d1 execute`.

```sql
CREATE TABLE projects (
  id           TEXT PRIMARY KEY,  -- matches projectId from YAML (e.g. 'democrats_abroad')
  hunt_mode    TEXT NOT NULL DEFAULT 'open',        -- 'open' | 'limited' | 'restricted'
  editor_mode  TEXT NOT NULL DEFAULT 'restricted',
  created_at   INTEGER NOT NULL
);

CREATE TABLE users (
  id                      TEXT PRIMARY KEY,  -- UUID v4
  email                   TEXT UNIQUE NOT NULL,  -- stored lowercase
  username                TEXT UNIQUE NOT NULL,  -- display name shown in organizer dashboard
  password_hash           TEXT NOT NULL,         -- bcrypt (salt embedded); min 8 char input
  created_at              INTEGER NOT NULL,       -- Unix timestamp
  email_consent_results   INTEGER,               -- 1 = consented, NULL = not given
  email_consent_marketing INTEGER,               -- 1 = consented, NULL = not given
  email_consent_at        INTEGER                -- timestamp of consent at signup
);
-- email_consent_* covers hunt result notifications and product updates respectively.
-- If consent categories multiply across projects in the future, migrate to a user_consents table.

CREATE TABLE user_project_caps (
  user_id             TEXT NOT NULL REFERENCES users(id),
  project_id          TEXT NOT NULL,
  capability          TEXT NOT NULL,  -- 'user' | 'editor' | 'organizer'
  granted_at          INTEGER NOT NULL,
  granted_by_user_id  TEXT REFERENCES users(id),  -- NULL if bootstrapped via KV admin
  revoked_at          INTEGER,                     -- NULL = active
  PRIMARY KEY (user_id, project_id, capability)
);

CREATE INDEX idx_caps_user ON user_project_caps(user_id, revoked_at);

CREATE TABLE invite_tokens (
  token               TEXT PRIMARY KEY,  -- crypto random, URL-safe
  project_id          TEXT NOT NULL,
  capability          TEXT NOT NULL,
  created_at          INTEGER NOT NULL,
  expires_at          INTEGER NOT NULL,  -- 48h TTL
  used_at             INTEGER,
  revoked_at          INTEGER,
  invited_by_user_id  TEXT REFERENCES users(id)
);
```

**Notes:**
- `email` is normalised to lowercase on insert; the UNIQUE constraint is case-sensitive in SQLite so normalisation is required to prevent duplicate accounts
- `username` is a display name for the organizer dashboard; it is not used for login
- Password minimum length: 8 characters, enforced at the API layer
- `user_project_caps` composite PK prevents duplicate rows; `ON CONFLICT DO NOTHING` on insert
- `user_project_caps` has no `city_id` — future fine-grained capability path; adding it is a non-breaking schema change
- `capability` is a plain string — new values require no schema change, only new enforcement logic
- `granted_by_user_id` is nullable for the KV-bootstrap case
- DA abroad initial seed: `INSERT INTO projects VALUES ('democrats_abroad', 'limited', 'restricted', unixepoch())` — run as part of the initial migration

---

## Auth Flows

### Sign-up

1. User visits `#/signup`, enters email, username, password (min 8 chars), and consent choices
2. `POST /auth/signup` → normalises email to lowercase, bcrypt-hashes password, inserts `users` row, sets auth token cookie with `{ user_id, exp: now + 30d }`
3. User is authenticated but has no project capabilities — cannot access the editor yet

### Invite flow (getting editor access)

1. Organizer logs into the editor, clicks "Invite editor"
2. `POST /auth/invite/create` → inserts invite token with `capability: 'editor'`, 48h TTL; returns the full invite URL
3. Organizer copies the link (`#/invite/<token>`) and sends it via any channel — the link is not email-specific; the organizer controls distribution
4. Editor clicks link → if not logged in, redirected to `#/editor/login` or `#/signup` with token preserved as a query parameter (e.g. `?invite=<token>`)
5. After login/signup, `POST /auth/invite/accept` atomically marks the token used and inserts capability:
   ```sql
   UPDATE invite_tokens
   SET used_at = unixepoch()
   WHERE token = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > unixepoch()
   ```
   If 0 rows affected, the token is invalid/expired/already used — return 409. Otherwise insert into `user_project_caps ... ON CONFLICT DO NOTHING`.
6. Editor is redirected to the editor for that project

### Login

1. User visits `#/editor/login`, enters email + password
2. `POST /auth/login` → normalises email to lowercase, queries D1 by email, bcrypt-compares password, sets auth token cookie with `{ user_id, exp }`
3. Server checks KV admin path first (bootstrap compatibility — if `project` field present in request body, treat as participant/admin login), then D1 user path
4. `/auth/me` returns user + active capabilities (`revoked_at IS NULL`); participant sessions return the existing shape unchanged

### Revoking access

1. Organizer clicks Revoke on a user in their user list
2. `POST /editor/:project/users/:userId/revoke` → sets `revoked_at = unixepoch()` on the matching capability row
3. Effective on next `/auth/me` call (next page load for that user)

### Bootstrap (first organizer on a new project)

The bootstrap flow solves the chicken-and-egg problem: the invite flow requires an existing organizer, but there is none on a new project.

1. Maintainer sends `POST /auth/login` with the KV admin credentials (`{ project, password }` — no `user_id` in body)
2. Server recognises KV admin path (password matches `admin:<project>` in KV), issues a **bootstrap token**: `{ user_id: null, project, isBootstrap: true, exp: now + 1h }`
3. Maintainer uses that token to call `POST /auth/bootstrap/promote` with `{ user_id }` (their own account ID)
4. Server verifies the bootstrap token (`isBootstrap: true`, not expired, `project` matches), inserts `user_project_caps` row with `capability: 'organizer'`, `granted_by_user_id: null`, then **issues a regular editor token** (`{ user_id, exp: now + 30d }`) in the response cookie, replacing the bootstrap token
5. Maintainer is now logged in as a normal user with organizer capability and can immediately use the editor and the normal invite flow for all subsequent editors
6. KV admin password remains in place as a long-term maintainer fallback — no removal required

---

## API

### CSRF mitigation

All state-changing endpoints validate the `Origin` header against the app's own origin. `SameSite=Strict` is already set on the auth cookie (`AUTH_COOKIE_ATTRS`), providing a first layer. Origin validation is the second layer.

### Endpoints

| Method | Path | Auth required | Description |
|--------|------|---------------|-------------|
| `POST` | `/auth/signup` | None | Create account; accepts consent flags; normalises email; min 8 char password |
| `POST` | `/auth/login` | None | Email + password → auth token cookie; KV admin/participant path checked first |
| `GET` | `/auth/me` | Token | Returns user + active capabilities (editor path) or existing participant shape (participant path) |
| `POST` | `/auth/logout` | Token | Clears cookie (unchanged) |
| `POST` | `/auth/bootstrap/promote` | Bootstrap token | Grants `organizer` capability to a user_id for the bootstrap project |
| `POST` | `/auth/invite/create` | Organizer | Creates invite token for a project + capability; returns invite URL |
| `GET` | `/auth/invite/:token` | None | Validates token; returns project + capability |
| `POST` | `/auth/invite/accept` | Authenticated | Atomically accepts invite; inserts `user_project_caps` row |
| `GET` | `/editor/:project/users` | Organizer | Lists users with active capabilities for the project |
| `POST` | `/editor/:project/users/:userId/revoke` | Organizer | Sets `revoked_at` on a capability row |

### `/auth/me` response shapes

**Editor/user session** (token has `user_id`):
```json
{ "ok": true, "userId": "...", "email": "...", "username": "...", "capabilities": ["editor"] }
```

**Participant session** (token has `project`, no `user_id`) — unchanged:
```json
{ "ok": true, "project": "...", "teamName": "...", "contact": "...", "isAdmin": false }
```

---

## Frontend

### New pages

| Route | Component | Notes |
|-------|-----------|-------|
| `#/signup` | `SignupPage.svelte` | Email, username, password (min 8 chars), two consent checkboxes (hunt results / product updates) |
| `#/invite/:token` | `InviteAcceptPage.svelte` | Calls `GET /auth/invite/:token`; shows project + capability; Accept button; redirects to `#/editor/login` or `#/signup` with `?invite=<token>` if not authenticated |

### Changed pages

| Component | Change |
|-----------|--------|
| `EditorLoginPage.svelte` | Add "Don't have an account? Sign up" link |
| `EditorPage.svelte` | Add "Invite editor" action → calls `POST /auth/invite/create`, shows copyable link |

### Changed stores and guards

| File | Change |
|------|--------|
| `authStore.ts` | `activeAuth` gains `email`, `username`, `capabilities: string[]`; `isAdmin` boolean removed for editor sessions; participant session shape unchanged |
| `authGuards.ts` | `requireAdmin` → `requireEditorAccess`: checks `capabilities` contains `'editor'` or `'organizer'` |
| `api.ts` | New functions for all new endpoints |

---

## Out of scope

- Organizer dashboard UI (user list, revoke UI) — future spec
- Hunt-level restricted access enforcement — future spec
- Fine-grained capabilities (per-city, per-action) — future spec
- Email sending (magic links, notifications) — future spec
- Password reset flow — future spec
