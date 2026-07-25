# Editor Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared admin password with individual user accounts, capability-based access, and an organizer-controlled invite flow — while leaving participant auth completely unchanged.

**Architecture:** A Cloudflare D1 SQLite database (`AUTH_DB`) stores users, capabilities, and invite tokens alongside the existing KV store (which stays for rate limiting and participant passwords). Auth tokens remain the custom `base64url(payload).base64url(hmac-sha256)` format; only the payload shape changes for editor sessions (`{ user_id, exp }` instead of `{ project, teamName, contact, isAdmin, exp }`). The server discriminates token types by key presence, not value.

**Tech Stack:** Cloudflare D1 (SQLite), Web Crypto API (PBKDF2 for password hashing — no external dependency), Svelte 5 runes, svelte-spa-router, TypeScript.

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `migrations/001_init.sql` | D1 schema + DA abroad seed row |
| `src/worker/db.ts` | D1 query helpers (users, caps, invites) |
| `src/worker/routes/inviteRoutes.ts` | Invite create / validate / accept endpoints |
| `src/pages/SignupPage.svelte` | New user registration page |
| `src/pages/SignupPage.css` | SignupPage styles |
| `src/pages/InviteAcceptPage.svelte` | Invite link landing page |
| `src/pages/InviteAcceptPage.css` | InviteAcceptPage styles |
| `src/test/worker.db.test.ts` | Tests for D1 helpers |
| `src/test/worker.auth-user.test.ts` | Tests for signup / D1 login / /auth/me / bootstrap |
| `src/test/worker.invite.test.ts` | Tests for invite endpoints |
| `src/test/SignupPage.test.ts` | SignupPage component tests |
| `src/test/InviteAcceptPage.test.ts` | InviteAcceptPage component tests |
| `doc/auth-guide.md` | User-facing documentation |

### Modified files
| File | Change |
|------|--------|
| `wrangler.jsonc` | Add `d1_databases` binding for `AUTH_DB` |
| `src/types/worker.ts` | Add `AUTH_DB: D1Database` to `Env` |
| `src/types/auth.ts` | Add `UserTokenPayload`, `BootstrapTokenPayload`, `AnyTokenPayload`, discrimination helpers, `EditorAuthState` |
| `src/worker/auth.ts` | Update `requireAuth` to return `AnyTokenPayload`; add `requireUserAuth`, `requireBootstrapAuth` |
| `src/worker/routes/authRoutes.ts` | Add signup; update login for D1 path + bootstrap token; update /auth/me for dual shape; add CSRF helper |
| `src/worker/routes/editorRoutes.ts` | Replace local `requireAdmin` with D1 capability check; add user listing + revoke endpoints |
| `src/worker.ts` | Import and wire `inviteRoutes` |
| `src/utils/api.ts` | Add new API functions for all new endpoints |
| `src/stores/authStore.ts` | Update `activeAuth` shape; handle pending invite on login |
| `src/utils/authGuards.ts` | `requireAdmin` → `requireEditorAccess` |
| `src/App.svelte` | Add `#/signup` and `#/invite/:token` routes; update `requireAdmin` → `requireEditorAccess` |
| `src/pages/editor/EditorLoginPage.svelte` | Add "Sign up" link; handle pending invite after login |
| `src/pages/editor/EditorPage.svelte` | Add "Invite editor" button |
| `src/test/worker.auth.test.ts` | Add token discrimination tests |
| `src/test/authGuards.test.ts` | Update for `requireEditorAccess` |
| `src/test/stores.test.ts` | Update authStore tests |
| `src/test/EditorLoginPage.test.ts` | Add signup link test |
| `src/test/EditorPage.test.ts` | Add invite button test |

---

## Migration note for existing tests

Task 04 changes the KV admin login path to issue a **bootstrap token** instead of a participant token with `isAdmin: true`. Existing tests in `src/test/worker.test.ts` or `src/test/worker.auth.test.ts` that:
1. Log in with the KV admin password AND
2. Expect `isAdmin: true` in the response or use the resulting token to access the editor

...will fail after Task 04. The engineer should search for `adminpass` or `isAdmin: true` in the test files and update those assertions to expect `isBootstrap: true` instead. The `requireEditorCap` fallback (participant token with `isAdmin: true`) remains for tests that construct participant tokens directly — only the login endpoint response shape changes.

---

## Tasks

| # | Task | File |
|---|------|------|
| 01 | Infrastructure: D1 binding, migrations, Env type | [task-01-prerequisites.md](task-01-prerequisites.md) |
| 02 | Token types and discrimination helpers | [task-02-token-types.md](task-02-token-types.md) |
| 03 | D1 query helpers | [task-03-db-helpers.md](task-03-db-helpers.md) |
| 04 | Signup, D1 login, /auth/me dual shape, CSRF | [task-04-signup-login.md](task-04-signup-login.md) |
| 05 | Bootstrap promote endpoint | [task-05-bootstrap.md](task-05-bootstrap.md) |
| 06 | Invite endpoints | [task-06-invites.md](task-06-invites.md) |
| 07 | Editor capability check + user management | [task-07-editor-caps.md](task-07-editor-caps.md) |
| 08 | Frontend: authStore, authGuards, api.ts | [task-08-frontend-stores.md](task-08-frontend-stores.md) |
| 09 | SignupPage | [task-09-signup-page.md](task-09-signup-page.md) |
| 10 | InviteAcceptPage | [task-10-invite-page.md](task-10-invite-page.md) |
| 11 | EditorLoginPage + EditorPage updates | [task-11-editor-updates.md](task-11-editor-updates.md) |
| 12 | User-facing documentation | [task-12-docs.md](task-12-docs.md) |
