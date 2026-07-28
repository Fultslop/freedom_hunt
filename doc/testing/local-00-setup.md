# Local Setup — One-time

Do this once before any other local testing.

---

## Steps

**1. Start the local server**

```bash
npm run preview
```

This builds the app and starts `wrangler dev` with a local D1 database and local KV. Leave it running.

**Expected:** App loads at `http://localhost:8787`. No errors in the terminal or browser console.

---

**2. Apply the database schema**

Open a second terminal:

```bash
npx wrangler d1 execute scavenger_hunt_auth --local --file=migrations/001_init.sql
npx wrangler d1 execute scavenger_hunt_auth --local --file=migrations/002_photos.sql
npx wrangler d1 execute scavenger_hunt_auth --local --file=migrations/003_form_submissions.sql
npx wrangler d1 execute scavenger_hunt_auth --local --file=migrations/004_participant_auth.sql
```

Apply all four here, even if you only plan to test users/organizers/editors right away — skipping 002–004 doesn't error at setup time, it just means `photos`/`form_submissions`/`participant_whitelist`/`participant_accounts` don't exist yet, so anything that touches them (photo upload, form submit, demo participant signup) fails later with an unrelated-looking 500. The `CREATE TABLE IF NOT EXISTS` statements make re-running any of these harmless.

Note: local D1 is a real sqlite file under `.wrangler/state/v3/d1`, not transient — it persists across `npm run dev`/`npm run preview` restarts (both read the same local persistence directory), which is exactly why this step only needs to happen once per machine (see the "Done" note below), and also why it's easy to end up on a stale schema if you cloned the repo before a later migration was added.

**Expected:** All four commands complete with no errors.

---

**3. Add the project row**

```bash
npx wrangler d1 execute scavenger_hunt_auth --local \
  --command "INSERT OR IGNORE INTO projects (id, hunt_mode, editor_mode, created_at) VALUES ('democrats_abroad', 'limited', 'restricted', unixepoch())"
```

**Expected:** Command completes with no errors.

---

**4. Set the bootstrap password**

```bash
npx wrangler kv key put "admin:democrats_abroad" "testbootstrap123" \
  --binding AUTH_STORE --local
```

**Expected:** `Writing the value "testbootstrap123"` (or similar confirmation).

---

## Done

You're ready. Continue with [local-01-users.md](local-01-users.md).

> This setup survives as long as `wrangler dev` uses the same local persistence directory (`.wrangler/`). If you delete `.wrangler/`, repeat steps 2–4.
