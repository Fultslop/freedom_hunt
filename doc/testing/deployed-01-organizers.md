# Deployed Test 1 — Bootstrap First Organizer

Prerequisite: [deployed-00-setup.md](deployed-00-setup.md) completed. App is live at your `workers.dev` URL.

Replace `https://your-app.workers.dev` with your actual URL throughout.

---

## Steps

**1. Create a user account**

Go to `https://your-app.workers.dev/#/signup` in your browser.

Fill in email, username, password (min 8 chars) → click **Create account**.

**Expected:** Redirected to `#/editor`. No content access yet — that's correct.

---

**2. Find your user_id in D1**

```bash
npx wrangler d1 execute scavenger_hunt_auth \
  --command "SELECT id, email FROM users WHERE email = 'your@email.com'"
```

Copy the `id` value.

---

**3. Get a bootstrap token**

```bash
curl -c cookies.txt -X POST https://your-app.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"project":"democrats_abroad","password":"your_strong_bootstrap_password"}'
```

PowerShell:
```powershell
curl.exe -c cookies.txt -X POST https://your-app.workers.dev/auth/login -H "Content-Type: application/json" -d '{"project":"democrats_abroad","password":"your_strong_bootstrap_password"}'
```

**Expected response:** `{"ok":true}`

Do the next step immediately — the bootstrap token is short-lived.

---

**4. Promote to organizer**

Replace `<YOUR_USER_ID>`:

```bash
curl -b cookies.txt -X POST https://your-app.workers.dev/auth/bootstrap/promote \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<YOUR_USER_ID>"}'
```

PowerShell:
```powershell
curl.exe -b cookies.txt -X POST https://your-app.workers.dev/auth/bootstrap/promote -H "Content-Type: application/json" -d '{"user_id":"<YOUR_USER_ID>"}'
```

**Expected response:** `{"ok":true}`

---

**5. Sign in via the UI**

Go to `https://your-app.workers.dev/#/editor/login` and sign in with your email and password.

**Expected:** Redirected to `#/editor`. The **Invite editor** button is visible.

---

## Verify in D1

```bash
npx wrangler d1 execute scavenger_hunt_auth \
  --command "SELECT * FROM user_project_caps"
```

**Expected:** A row with `capability = 'organizer'` for your user.

---

## Done

Continue with [deployed-02-editors.md](deployed-02-editors.md).
