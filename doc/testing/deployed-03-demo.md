# Deployed Test 3 — Demo Project & DA Content Reference

Prerequisite: [deployed-00-setup.md](deployed-00-setup.md) completed and deployed. Independent of deployed-01/02 (organizers/editors) — this exercises participant-facing flows only.

Replace `https://your-app.workers.dev` with your actual URL throughout.

> **Caution — shared production data.** `demo` and `democrats_abroad` share the same live D1/KV/R2. Everything in this guide writes real rows under `project_id = 'demo'`, which is safe and isolated. Do **not** submit forms, upload photos, or otherwise write data against `democrats_abroad` while testing — only read-only checks (viewing content, logging in) are safe there.

---

## Steps

**1. Confirm migrations 002–005 are applied**

`deployed-00-setup.md` step 4 now applies all five migrations up front. If this deployment was set up before that changed, apply the missing ones now:

```bash
npx wrangler d1 execute scavenger_hunt_auth --file=migrations/002_photos.sql
npx wrangler d1 execute scavenger_hunt_auth --file=migrations/003_form_submissions.sql
npx wrangler d1 execute scavenger_hunt_auth --file=migrations/004_participant_auth.sql
npx wrangler d1 execute scavenger_hunt_auth --file=migrations/005_photo_kind.sql
```

**Expected:** All four complete with no errors. (`002`-`004` are harmless to rerun — `CREATE TABLE IF NOT EXISTS`. `005`'s `ALTER TABLE ... ADD COLUMN` is not idempotent the same way — if it's already applied, it errors with `duplicate column name: kind`, which just means this step is already done.)

---

**2. Whitelist a test email**

```bash
npx wrangler d1 execute scavenger_hunt_auth \
  --command "INSERT INTO participant_whitelist (email, project_id, added_at) VALUES ('demo-tester@example.com', 'demo', strftime('%s','now'))"
```

**Expected:** Command completes with no errors.

---

**3. Open the app**

Go to `https://your-app.workers.dev`

**Expected:** Landing page shows two projects — `Democrats Abroad / Global Women's Caucus` and `Demo`.

---

**4. Sign up for Demo**

Click **Demo** → redirected to `#/login/demo` → click **Create an account** → fill in the whitelisted email and a password (8+ characters) → **Create account**. (No team name or contact field — team name is set later when a participant joins a project/city; contact defaults to the signup email.)

**Expected:** Redirected into `#/demo`. City picker shows **3 cities**: Den Haag, Paris, New York.

---

**5. Confirm Den Haag is DA's real content, referenced not copied**

Open `Demo → Den Haag`, walk the `short_loop` route, and compare against the real `Democrats Abroad → Den Haag` in a separate tab.

**Expected:** Identical storyline and challenge text.

---

**6. Submit a form and confirm it goes to D1, not Google Sheets**

On any form-bearing location under `demo` (Den Haag, Paris, or New York), fill it in and submit.

**Expected:** "Submitted! ✓" appears.

---

**7. Upload a photo and check the gallery**

Complete a photo-upload field, then check that city's gallery page.

**Expected:** Your photo appears.

---

**8. Confirm DA's real project is unaffected**

Sign out, go to `#/democrats_abroad`, log in with the real event password.

**Expected:** Works exactly as before. **Do not submit a form or upload a photo here** — this is real production data.

---

**9. Confirm cross-project access is blocked**

Log back into `demo`. Manually change the URL to `#/democrats_abroad/den_haag` while that session is active.

**Expected:** Redirected to `#/login/democrats_abroad`.

---

## Verify in D1

```bash
npx wrangler d1 execute scavenger_hunt_auth \
  --command "SELECT email, project_id, team_name FROM participant_accounts"
```

**Expected:** One row — the account from step 4.

```bash
npx wrangler d1 execute scavenger_hunt_auth \
  --command "SELECT project_id, city_id, team_name, answers FROM form_submissions"
```

**Expected:** One row, `project_id` = `demo`, from step 6.

---

## Done

All demo/DA-reference flows verified end-to-end in production, with no writes against `democrats_abroad`'s real data.
