# Scavenger Hunt Code Login Flow — Design Spec

**Date:** 2026-07-27
**Status:** Approved

## Overview

Replace project selection by browsing a card list with a single "scavenger hunt code" field. The landing page (`AppPage`) gets a "Start Hunting" button (leaving room for future links — docs, about, etc., out of scope here) instead of the current project-card list. The code the participant types either resolves to a shared-password project (currently `democrats_abroad`) and continues to a team-name screen, or is the literal keyword `demo`, which routes to the existing, unchanged `demo` email/password login. Contact email is dropped from the shared-password flow entirely (it was optional and unused beyond attribution, which degrades gracefully everywhere it's read).

**Scope:** Frontend routing/pages + one new stateless backend endpoint for code→project resolution. No changes to session/token structure, to the `demo` project's own auth, to `ProjectPage`/`CityPage`/`RoutePage`, or to the DB schema.

---

## Flow

```
/                    AppPage: hero + "Start Hunting" button (project cards removed)
  → /start           CodeEntryPage: single "scavenger hunt code" field
        code == "demo" (case-insensitive)  → /login/demo (unchanged)
        code matches a project's shared password → /join/:project
        no match                                 → inline "Invalid code" error, stays on /start
  → /join/:project   JoinTeamPage: single "team name" field, prefilled from
                     localStorage if returning, explanatory copy on naming.
                     Submits real login (project + teamName + password), then →
  → /:project        existing ProjectPage (city picker) — unchanged

/login/:project      Deep-link / expired-session recovery (requireAuth redirect target,
                     or JoinTeamPage's fallback if it lost the stashed password).
                     Single combined password + team-name screen — unchanged shape,
                     minus the contact field, plus the same localStorage prefill.

/login/demo,
/signup/demo         Unchanged.
```

Two screens for a fresh participant (code, then team name); effectively one confirm-tap for a returning one (code, then a prefilled name they just accept); one screen for anyone bounced back mid-hunt by an expired session.

---

## Random team name suggestion

If `localStorage['teamName:' + project]` has no saved value, the team-name field is prefilled with a randomly generated two-word name instead of being left empty — e.g. "Funny Pyjama" — so a new team never faces a blank required field with no example of the expected shape. A dice button next to the field regenerates a new random suggestion on demand (available whenever the field is shown, not just for first-timers — a returning team can re-roll too if they want a different suggested name; it only ever overwrites the *displayed* value, nothing is saved until they submit).

`src/utils/teamNameGenerator.ts` (new):

```ts
export const TEAM_NAME_ADJECTIVES = [ /* 32 words, see below */ ];
export const TEAM_NAME_NOUNS = [ /* 32 words, see below */ ];

export function generateTeamName(): string {
  const adjective = TEAM_NAME_ADJECTIVES[Math.floor(Math.random() * TEAM_NAME_ADJECTIVES.length)];
  const noun = TEAM_NAME_NOUNS[Math.floor(Math.random() * TEAM_NAME_NOUNS.length)];
  return `${adjective} ${noun}`;
}
```

Word lists (32 each, family-friendly, scavenger-hunt-flavored, no proper nouns/brands):

```
Adjectives: Red, Funny, Clear, Bold, Swift, Clever, Jolly, Sneaky, Bright, Curious,
Daring, Eager, Fuzzy, Giant, Happy, Icy, Jumpy, Kind, Lucky, Mighty, Nifty, Orange,
Plucky, Quick, Rowdy, Silly, Tiny, Upbeat, Vivid, Wacky, Zesty, Golden

Nouns: Pyjama, Car, Clown, Team, Falcon, Pretzel, Wizard, Penguin, Rocket, Ninja,
Taco, Panther, Unicorn, Otter, Compass, Dragon, Marmot, Biscuit, Voyager, Comet,
Lantern, Wombat, Trailblazer, Puzzle, Kangaroo, Cactus, Sailor, Sparrow, Tornado,
Walrus, Yeti, Detective
```

Applied on both team-name fields — `JoinTeamPage` (primary flow) and `LoginPage` (recovery flow) — since both share the same prefill-from-`localStorage` logic; leaving the dice off one would be an inconsistent, unexplained gap between two screens doing the same job. Each page keeps its own `<input>` + dice `<button>` markup (matching the existing convention of small per-page duplication over shared components, e.g. the eye-icon toggle already duplicated across `LoginPage`/`DemoLoginPage`), both calling the shared `generateTeamName()` util.

---

## Backend: `POST /auth/verify-code`

New, stateless — no cookie is set, no session is created.

```ts
// Request:  { code: string }
// Response: { ok: true, mode: "demo" }
//         | { ok: true, mode: "project", project: string }
//         | { ok: false }
```

Logic:
1. Rate-limited the same way as `/auth/login` (`checkRateLimit` by client IP).
2. Trim the code. If it case-insensitively equals `"demo"`, return `{ ok: true, mode: "demo" }` immediately — no real project's shared password may ever be `"demo"` (document this constraint in `doc/setup.md`).
3. Otherwise, `env.AUTH_STORE.list({ prefix: KV_PREFIX_PARTICIPANT })`, fetch each key's value, and compare (case-sensitive `===`) against the trimmed code. First match returns `{ ok: true, mode: "project", project }`.
4. No match → `{ ok: false }`.

This requires no new data model: any project with a `auth:<project>` KV entry (set today via `wrangler kv key put`) is automatically eligible for code resolution, and `demo` is automatically excluded since it authenticates via D1 `participant_accounts`, never via a KV shared password.

**Why a separate endpoint instead of extending `/auth/login`:** verifying a code shouldn't create a session before the participant's team name is known — that would leave an authenticated cookie with an empty team name if they abandon the flow partway. `/auth/login` remains the single place a real session (and its `teamName`) is created, exactly as today; `JoinTeamPage` calls it once the team name is collected, just like `LoginPage` always has.

**Collision rule (operational, not enforced in code):** if two live projects happen to share the same password, code resolution returns whichever `list()` happens to return first. Organizers must pick non-colliding codes — call this out in `doc/setup.md` alongside the existing KV setup instructions.

---

## Frontend changes

| File | Change |
|---|---|
| `src/pages/AppPage.svelte` | Remove the `projectsText.items` card loop. Keep hero image/title/tagline. Add a single "Start Hunting" button (`push('/start')`). Layout leaves visual room below for future links (not built now). |
| `src/pages/CodeEntryPage.svelte` (new) | Single "Scavenger hunt code" input + submit. Calls `postVerifyCode(code)`. Branches per response `mode`. On project match, stashes `{ project, password: code }` (JSON) under `sessionStorage['pendingHuntAuth']` before navigating. Same visual shell as the landing page per the request. |
| `src/pages/JoinTeamPage.svelte` (new) | Single "Team name" input (required) + dice regenerate button + short explanatory copy on the recommended naming format. Prefills from `localStorage['teamName:' + project]` if present, else from `generateTeamName()`. Reads `sessionStorage['pendingHuntAuth']`; if absent or its `project` doesn't match the route param, redirects to `/login/:project` instead of failing. On submit, calls existing `postLogin({ project, teamName, password })` (no `contact`), then `authStore.loginParticipant(...)`, `localStorage.setItem('teamName:' + project, teamName)`, `sessionStorage.removeItem('pendingHuntAuth')`, and `push('/' + project)`. |
| `src/pages/LoginPage.svelte` | Remove the `contact` field and its state/markup. Add the same `localStorage['teamName:' + project]` prefill (falling back to `generateTeamName()`) plus dice button on mount. Otherwise unchanged — still one combined password + team-name form, still the `requireAuth` redirect target. |
| `src/utils/teamNameGenerator.ts` (new) | `TEAM_NAME_ADJECTIVES`, `TEAM_NAME_NOUNS` (32 each), `generateTeamName()` — see below. |
| `src/utils/api.ts` | Add `postVerifyCode(code: string)` → `POST /auth/verify-code`. Make `LoginPayload.contact` optional. |
| `src/App.svelte` | Add `/start` → `CodeEntryPage` and `/join/:project` → `JoinTeamPage` routes (both public, no `requireAuth` — neither is inside an authenticated area yet). |

`src/worker/routes/authRoutes.ts` gets the new `POST /auth/verify-code` handler, sharing the existing `checkRateLimit` helper. `/auth/login` itself is otherwise unchanged.

**Why `sessionStorage` for the stashed password, not an in-memory store:** it survives an accidental refresh on the team-name screen (a real risk now that this is two screens instead of one), self-clears when the tab closes, and mirrors the existing `pendingInvite` pattern already used in `SignupPage.svelte`. The value is a shared team password (an event access code shared with an entire team), not an individual secret, so the brief `sessionStorage` window is an acceptable tradeoff for removing the failure mode.

---

## Edge cases

- **Refresh/direct-nav to `/join/:project` with no stashed password** → redirect to `/login/:project`, which re-asks the password. No dead end.
- **`demo` collides with a real project's password** — structurally impossible; the literal check runs first and always wins.
- **Two projects share a password by coincidence** — operational rule (organizers pick non-colliding codes), documented in `doc/setup.md`, not code-enforced.
- **Team name format** — copy-only guidance, not validated; matches current behavior (required text input, no pattern enforcement).
- **Brute-forcing codes** — same IP rate limit as `/auth/login` today.
- **`projects/projects.yaml`'s `page.title` / `page.subtitle`** become unused now that `AppPage` no longer renders project cards from it. Left in place — harmless, not a bug.
- **Contact email removal** — already optional everywhere it's read (`TitleBar` falls back to "—", D1 columns are nullable); `demo`'s own signup flow is untouched and still sources contact from the account email.

---

## Out of scope

- The future public/no-login treasure hunt — this design doesn't preclude it (a project with no KV password and no code requirement can be wired in later without touching this flow), but no work toward it happens here.
- Admin/organizer bootstrap login (`isBootstrap` token path) — untouched; it still flows through `/login/:project`'s password submission exactly as today.
- Any change to `/editor/login`, `/signup`, `/invite/:token`.
