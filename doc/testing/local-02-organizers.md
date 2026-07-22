# Local Test 2 — Bootstrap First Organizer

Prerequisite: [local-01-users.md](local-01-users.md) completed. You have a user account and their `id` from the DB query.

For local testing, skip the HTTP bootstrap flow — write the organizer capability directly into D1. The API bootstrap flow exists for production where you don't have direct DB access (covered in `deployed-01-organizers.md`).

---

## Steps

**1. Find your user_id** (if you don't have it already)

```bash
npx wrangler d1 execute scavenger_hunt_auth --local --command "SELECT id, email FROM users WHERE email = 'your@email.com'"
```

Copy the `id` value.

---

**2. Insert organizer capability directly into D1**

Replace `<YOUR_USER_ID>` with the id from step 1:

```bash
npx wrangler d1 execute scavenger_hunt_auth --local --command "INSERT INTO user_project_caps (user_id, project_id, capability, granted_at, granted_by_user_id) VALUES ('<YOUR_USER_ID>', 'democrats_abroad', 'organizer', unixepoch(), NULL)"
```

**Expected:** Command completes with no errors.

---

**3. Sign in via the UI**

Go to `http://localhost:8787/#/editor/login` and sign in with your email and password.

**Expected:** Redirected to `#/editor`. The **Invite editor** button is visible.

---

## Verify in the database

```bash
npx wrangler d1 execute scavenger_hunt_auth --local --command "SELECT * FROM user_project_caps"
```

**Expected:** A row with your `user_id`, `project_id = 'democrats_abroad'`, and `capability = 'organizer'`.

---

## Done

Continue with [local-03-editors.md](local-03-editors.md).
