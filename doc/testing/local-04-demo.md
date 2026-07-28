# Local Test 4 — Demo Project & DA Content Reference

Prerequisite: [local-00-setup.md](local-00-setup.md) completed and `npm run preview` is running. Independent of local-01/02/03 (users/organizers/editors) — this exercises participant-facing flows only.

---

## Steps

**1. Confirm migrations 002–004 are applied**

`local-00-setup.md` step 2 now applies all four migrations up front. If you set up this machine before that changed, apply the missing ones now (harmless to re-run — all are `CREATE TABLE IF NOT EXISTS`):

```bash
npx wrangler d1 execute scavenger_hunt_auth --local --file=migrations/002_photos.sql
npx wrangler d1 execute scavenger_hunt_auth --local --file=migrations/003_form_submissions.sql
npx wrangler d1 execute scavenger_hunt_auth --local --file=migrations/004_participant_auth.sql
```

**Expected:** All three complete with no errors.

---

**2. Whitelist a test email**

```bash
npx wrangler d1 execute scavenger_hunt_auth --local \
  --command "INSERT INTO participant_whitelist (email, project_id, added_at) VALUES ('demo-tester@example.com', 'demo', strftime('%s','now'))"
```

**Expected:** Command completes with no errors.

---

**3. Open the app**

Go to `http://localhost:8787`

**Expected:** Landing page shows two projects — `Democrats Abroad / Global Women's Caucus` and `Demo`. Not three: there's no separate "mirror" project, DA's real content is referenced from inside `Demo`.

---

**4. Sign up for Demo**

Click the **Demo** card → redirected to `#/login/demo` (an email+password form, not DA's shared-password form) → click **Create an account** → fill in:

- Email: `demo-tester@example.com` (must match what you whitelisted in step 2)
- Password: at least 8 characters

(That's it — no team name or contact field at signup. Team name is set later, when a participant actually joins a project/city; contact defaults to the signup email.)

Click **Create account**.

**Expected:** Redirected into `#/demo`. City picker shows **3 cities**: Den Haag, Paris, New York. (Oslo exists in the data but is currently disabled — its card and location images don't exist yet.)

---

**5. Confirm Den Haag is DA's real content, referenced not copied**

Open `Demo → Den Haag`, walk the `short_loop` route.

**Expected:** Identical storyline and challenge text to the real `Democrats Abroad → Den Haag` project — open both in separate tabs to compare directly.

---

**6. Submit a form and confirm it goes to D1, not Google Sheets**

Open a form-bearing location (`Den Haag`'s `001_loc_abc`, or any of the Paris/New York stops marked with a form), fill it in, and submit. Before submitting, open devtools → Network tab.

**Expected:** "Submitted! ✓" appears. No request to `script.google.com` in the Network tab — only `/form-submit`.

---

**7. Upload a photo and check the gallery**

Complete a photo-upload field on any form, then navigate to that city's gallery (e.g. `#/demo/den_haag/gallery`).

**Expected:** Your photo appears in the gallery grid.

---

**8. Confirm DA's real project is unaffected**

Sign out (`☰ → Profile → Sign out`), go to `#/democrats_abroad`, log in with the real shared team password.

**Expected:** Works exactly as before — nothing here changed it.

---

**9. Confirm cross-project access is blocked**

Log back into `demo`. While logged in, manually change the URL to `#/democrats_abroad/den_haag`.

**Expected:** Redirected to `#/login/democrats_abroad` — an active session for one project doesn't grant access to another.

---

## Verify in the database

```bash
npx wrangler d1 execute scavenger_hunt_auth --local \
  --command "SELECT email, project_id, team_name FROM participant_accounts"
```

**Expected:** One row — the account created in step 4.

```bash
npx wrangler d1 execute scavenger_hunt_auth --local \
  --command "SELECT project_id, city_id, team_name, answers FROM form_submissions"
```

**Expected:** One row, `project_id` = `demo`, from step 6.

---

## Done

Continue with [deployed-00-setup.md](deployed-00-setup.md) when ready to test against Cloudflare.
