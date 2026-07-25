# Deployed Test 2 — Invite and Onboard an Editor

Prerequisite: [deployed-01-organizers.md](deployed-01-organizers.md) completed. Signed in as organizer at your `workers.dev` URL.

Replace `https://your-app.workers.dev` with your actual URL throughout.

---

## Part A — Generate the invite link

**1.** Go to `https://your-app.workers.dev/#/editor`

**2.** Click **Invite editor**

**Expected:** An invite URL appears on screen, like:
```
https://your-app.workers.dev/#/invite/abc123xyz...
```

**3.** Copy the full URL. Send it to your editor (email, WhatsApp, Slack — anything).

> The link is valid for 48 hours and is not tied to a specific email. Anyone with the link can accept it.

---

## Part B — Accept as a brand new user

The editor opens the invite URL in their browser (or use a private/incognito window to simulate a different person).

**1.** Open the invite URL.

**Expected:** Redirected to `#/editor/login`.

**2.** Click the sign-up link → fill in email, username, password → click **Create account**

**Expected:** After account creation, the invite is accepted automatically. Redirected to `#/editor` with editor access.

---

## Part B (alternative) — Accept as an existing logged-in user

**1.** Open the invite URL while logged in as a different user account.

**Expected:** A card showing the project and capability (`editor`) with an **Accept invitation** button.

**2.** Click **Accept invitation**

**Expected:** Redirected to `#/editor` with updated access.

---

## Verify in D1

```bash
npx wrangler d1 execute scavenger_hunt_auth \
  --command "SELECT u.email, upc.capability FROM users u JOIN user_project_caps upc ON u.id = upc.user_id"
```

**Expected:** Two rows — one `organizer`, one `editor`.

Check the invite was consumed:

```bash
npx wrangler d1 execute scavenger_hunt_auth \
  --command "SELECT token, used_at FROM invite_tokens"
```

**Expected:** `used_at` is set (not null).

---

## Done

Continue with [deployed-03-demo.md](deployed-03-demo.md).
