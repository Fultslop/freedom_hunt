# Demo Participant Auth Design (Whitelist Email + Password)

**Date:** 2026-07-25
**Scope:** A new participant auth mode — email whitelist, individual email+password accounts, a sign-up page — used by the `demo` project only, covering all four of its cities (`den_haag`, `oslo`, `paris`, `new_york` — it's one project, one login). `democrats_abroad` keeps its existing shared-team-password login, completely unchanged. Does NOT touch editor/organizer auth, does NOT add an admin UI for managing the whitelist (manual D1 inserts for now) — see Out of Scope.

---

## Background

This is sub-project 4 of the [dev/test environment roadmap](2026-07-25-dev-test-environment-roadmap.md), and the last of the four. It depends on [sub-project 3](2026-07-25-demo-project-content-design.md) (the `demo` project's content must exist for there to be anything to log into), but not directly on sub-project 2 — since `den_haag`/`oslo` are just more cities inside the same `demo` project, this auth mode covers them automatically once both exist, with no `demo`-vs-`den_haag` distinction anywhere in the auth layer.

Today there are two participant-adjacent auth models in this codebase:
1. **Shared team password** (`democrats_abroad` only) — one password per project, stored in KV, entered alongside a free-text team name at every login. No individual identity.
2. **Individual D1 accounts** (`users` table) — but this is exclusively for editors/organizers, authenticated by `email`+`password`, holding project-scoped capabilities (`editor`, `organizer`) via `user_project_caps`.

Neither fits "whitelisted individual participant accounts." This spec adds a third, narrower model: an email must be pre-approved (whitelisted) for a specific project before an account can be created for it, and the resulting account is still fundamentally a *participant* — it produces the exact same `ParticipantTokenPayload` shape (`{ project, teamName, contact, isAdmin, exp }`) the shared-password flow already produces, so every piece of existing participant-facing code (`ChallengeForm`, `requireParticipantForProject`, `uploadRoute`, `galleryRoutes`, the frontend `requireAuth` guard) works completely unchanged. The new model isn't a rewrite of participant auth — it's a second way to *obtain* the same kind of token, gated differently.

## Architecture

### What changes

| Layer | Now | After |
|---|---|---|
| D1 | No whitelist or individual-participant tables | Adds `participant_whitelist` and `participant_accounts` |
| `POST /auth/login` | `project` field present → checks KV admin/participant passwords only | If `project` **and** `email` are both present → checks `participant_accounts` (new path). If `project` present without `email` → existing KV path, unchanged. |
| Worker routes | No participant signup endpoint | New `POST /auth/participant-signup` |
| Frontend routes | `/login/:project` → generic `LoginPage` for everyone | Adds literal `/login/demo` → new `DemoLoginPage`, matched before the `/login/:project` wildcard (same ordering rule already used for the gallery route); `democrats_abroad` keeps hitting the wildcard → unchanged `LoginPage`. This one route covers all four of `demo`'s cities — there's no per-city login. |
| Frontend pages | No participant sign-up page | New `/signup/demo` → `DemoSignupPage` |
| `authStore` | — | **No changes** — both new pages call the existing `authStore.loginParticipant(project, teamName, contact, isAdmin)`, identical to what `LoginPage` already does |
| `/auth/me`, `/auth/logout` | — | **No changes** — token shape is identical regardless of which path issued it |

### Why not extend the existing `users` table instead

The `users` table's token (`UserTokenPayload = { user_id, exp }`) is deliberately *not* a participant token — `isParticipantToken()` is defined as "does NOT have a `user_id` key," and every participant-facing route (`ChallengeForm`, `requireParticipantForProject`, `uploadRoute`, `galleryRoutes`) is written against `ParticipantTokenPayload`'s shape (`project`, `teamName`, `contact`). Reusing `users` would mean either dual-supporting two token shapes through all of that code, or migrating it all to a capability-based model — large, invasive, and unnecessary for what's actually being asked for. A dedicated `participant_accounts` table that issues the *existing* participant token shape is a much smaller change with zero risk to already-working code.

## Data Model (D1)

New migration, applied to the existing `AUTH_DB` — same pattern as `002_photos.sql` and `003_form_submissions.sql`:

```sql
CREATE TABLE IF NOT EXISTS participant_whitelist (
  email        TEXT NOT NULL,
  project_id   TEXT NOT NULL,
  added_at     INTEGER NOT NULL,
  PRIMARY KEY (email, project_id)
);

CREATE TABLE IF NOT EXISTS participant_accounts (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL,
  project_id     TEXT NOT NULL,
  team_name      TEXT NOT NULL,
  contact        TEXT,
  password_hash  TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  UNIQUE (email, project_id)
);
```

`email` is scoped per-project (not globally unique) deliberately — the same email could plausibly be whitelisted for `demo` and, in principle, some future third whitelist-auth project, as two separate accounts. `password_hash` uses the existing PBKDF2 helpers (`hashPassword`/`verifyPassword` in `src/worker/db.ts`) — no new hashing scheme.

## API Layer

### `POST /auth/participant-signup` (new)

Request: `{ project: string, email: string, teamName: string, contact?: string, password: string }`

1. `checkOrigin` (same as `/auth/signup`).
2. Reject if `password.length < 8` (same rule as editor signup).
3. Look up `participant_whitelist` for `(email.toLowerCase(), project)`. Not found → `403 { ok: false, error: "This email hasn't been approved for this project yet. Contact the organizer." }`.
4. Look up `participant_accounts` for the same `(email, project)`. Found → `409 { ok: false, error: "Already registered — log in instead." }`.
5. Hash the password, insert the row, mint a `ParticipantTokenPayload` (`{ project, teamName, contact: contact || "", isAdmin: false, exp }`), set the auth cookie — identical response shape to the existing participant login response: `{ ok: true, teamName, contact, isAdmin: false }`.

### `POST /auth/login` (extended)

Inside the existing `if (body.project)` branch, before the current admin/participant KV checks: if `body.email` is also present, this is an individual-account login attempt —

1. Look up `participant_accounts` for `(email.toLowerCase(), project)`. Not found, or `verifyPassword` fails → `401 { ok: false, error: "Incorrect email or password" }`.
2. On success, mint the same `ParticipantTokenPayload` shape as above, using the account's stored `teamName`/`contact` (not re-submitted at login — same principle as the editor login flow, which doesn't ask for username again either).

The existing KV admin/participant path is unchanged and only runs when `body.email` is absent — `democrats_abroad`'s login requests never include an `email` field (`LoginPage.svelte` doesn't collect one), so this is fully additive.

## Frontend

### `DemoLoginPage.svelte` (new, route `/login/demo`)

Email + password fields (no team name field — `teamName` is fixed at signup time and stored server-side). On success, calls `authStore.loginParticipant(project, data.teamName, data.contact, false)` then `push("/demo")`. Links to `/signup/demo` for new users ("New here? Create an account").

### `DemoSignupPage.svelte` (new, route `/signup/demo`)

Email, team name, contact (optional), password fields. On success (`postDemoSignup`), calls `authStore.loginParticipant` the same way and redirects into `/demo`. On the whitelist-rejection 403, shows the server's error message directly (it's already written for a participant audience — see API Layer above). No GDPR consent checkboxes (unlike editor signup) — this is internal test data collection, not a real participant-facing product; if `demo` content ever needs to leave "test" status this would need revisiting, but that's out of scope here.

### Routing (`App.svelte`)

```ts
"/login/demo": asRoute(DemoLoginPage),
"/signup/demo": asRoute(DemoSignupPage),
"/login/:project": asRoute(LoginPage),   // existing — now only reached for non-demo projects
```

The literal routes must be declared before the `:project` wildcard, per the existing ordering comment already in `App.svelte` (the same rule that governs the gallery route vs. the `:route` wildcard).

### `src/utils/api.ts`

```ts
export interface DemoSignupPayload {
  project: string;
  email: string;
  teamName: string;
  contact?: string;
  password: string;
}

export async function postDemoSignup(payload: DemoSignupPayload): Promise<LoginResponse> {
  const res = await fetch("/auth/participant-signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<LoginResponse>;
}
```

`LoginPayload` gains an optional `email?: string` field so the existing `postLogin`/`LoginResponse` types serve both `DemoLoginPage` and `LoginPage` without a second login function.

## Out of Scope

- Any UI for organizers to manage the whitelist — entries are added via a direct D1 insert, documented as a manual step (same pattern as KV password entries in `doc/setup.md`):
  ```
  wrangler d1 execute scavenger_hunt_auth --command "INSERT INTO participant_whitelist (email, project_id, added_at) VALUES ('tester@example.com', 'demo', strftime('%s','now'))"
  ```
- Email verification (confirming the submitted email is actually reachable) — the whitelist check is the only gate; no confirmation email is sent.
- Password reset — out of scope, same as the existing editor account flow doesn't have one either.
- Extending the whitelist model to `democrats_abroad` — it keeps the shared-password model permanently, unless a future decision says otherwise.
- GDPR consent capture for demo signups — this is test data collection, not production participant data.

## Testing / Verification

Following existing worker test patterns (`src/test/worker.auth.test.ts`, `worker.auth-user.test.ts`):

1. `POST /auth/participant-signup` — whitelisted email succeeds and returns a working session; non-whitelisted email → 403; already-registered email → 409; short password → 400; missing origin header mismatch → 403 (mirrors `/auth/signup`).
2. `POST /auth/login` with `project` + `email` — correct password succeeds and returns the stored `teamName`/`contact`; wrong password → 401; unknown email for that project → 401; confirm the existing KV-path tests (no `email` field) still pass unchanged.
3. Frontend: `DemoSignupPage.test.ts`, `DemoLoginPage.test.ts` — mirror the existing `SignupPage.test.ts`/`LoginPage.test.ts` structure (render, submit, success redirects, error displays).
4. `App.routing.test.ts` (already exists for the gallery-vs-wildcard ordering) — add a case confirming `/login/demo` resolves to `DemoLoginPage`, not the wildcard `LoginPage`.
5. Manual: whitelist an email via the `wrangler d1 execute ... --local` command above, sign up through `/signup/demo`, confirm landing in the `demo` project's city picker (four cities if sub-project 2 has also shipped, two if only sub-project 3 has); log out, log back in via `/login/demo` with the same credentials.
