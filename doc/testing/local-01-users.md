# Local Test 1 — Create a User Account

Prerequisite: [local-00-setup.md](local-00-setup.md) completed and `npm run preview` is running.

---

## Steps

**1. Open the app**

Go to `http://localhost:8787`

---

**2. Navigate to signup**

Add `#/signup` to the URL: `http://localhost:8787/#/signup`

---

**3. Fill in the form**

- Email: anything (e.g. `test@example.com`)
- Username: anything (e.g. `testuser`)
- Password: at least 8 characters

Check or uncheck the email preference boxes — doesn't matter for testing.

---

**4. Click Create account**

**Expected:** You are redirected to `#/editor`. The editor page loads. Your username appears in the title bar.

> No editor content will be visible yet — that requires organizer or editor access. That's fine for this test.

---

## Verify in the database

```bash
npx wrangler d1 execute scavenger_hunt_auth --local \
  --command "SELECT id, email, username FROM users"
```

**Expected:** One row with your email and username. Copy the `id` value — you'll need it in the next guide.

---

## Done

Continue with [local-02-organizers.md](local-02-organizers.md).
