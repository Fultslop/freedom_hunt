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
```

Note: local runs on an sqllite transient (?) db

**Expected:** Command completes with no errors.

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
