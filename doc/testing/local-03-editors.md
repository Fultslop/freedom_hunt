# Local Test 3 — Invite and Onboard an Editor

Prerequisite: [local-02-organizers.md](local-02-organizers.md) completed. You are signed in as organizer.

---

## Part A — Generate the invite link

**1.** Go to `http://localhost:8787/#/editor`

**2.** Click **Invite editor**

**Expected:** An invite URL appears on screen, like:
```
http://localhost:8787/#/invite/abc123xyz...
```

**3.** Copy the full URL.

---

## Part B — Accept as a brand new user (recommended first test)

Use a private/incognito browser window so you're not logged in.

**1.** Paste the invite URL into the incognito window and open it.

**Expected:** You are redirected to `#/editor/login` with a sign-in prompt.

**2.** Click the link to sign up → fill in a different email, username, password → click **Create account**

**Expected:** After account creation, the invite is accepted automatically. You are redirected to `#/editor`.

**3.** Check what's visible — the editor should load with content access.

---

## Part B (alternative) — Accept as an existing logged-in user

Skip this if Part B above worked.

**1.** Open the invite URL while logged in as a *different* user account.

**Expected:** A card shows the project name and capability (`editor`). An **Accept invitation** button is visible.

**2.** Click **Accept invitation**

**Expected:** Redirected to `#/editor` with updated access.

---

## Verify in the database

```bash
npx wrangler d1 execute scavenger_hunt_auth --local \
  --command "SELECT u.email, upc.capability FROM users u JOIN user_project_caps upc ON u.id = upc.user_id"
```

**Expected:** Two rows — one `organizer`, one `editor`.

Also check the invite token was consumed:

```bash
npx wrangler d1 execute scavenger_hunt_auth --local \
  --command "SELECT token, used_at FROM invite_tokens"
```

**Expected:** `used_at` is set (not null).

---

## Done

All three local flows are verified. Continue with [local-04-demo.md](local-04-demo.md).
