# Deployed Setup — One-time Cloudflare Setup

Do this once before deploying to Cloudflare Workers.

Prerequisite: `wrangler` CLI installed. Cloudflare account with Workers and D1 enabled (free tier is fine).

---

## Steps

**1. Authenticate wrangler**

```bash
npx wrangler login
```

Follow the browser prompt.

---

**2. Create the D1 database**

```bash
npx wrangler d1 create scavenger_hunt_auth
```

Copy the `database_id` from the output. You'll need it in the next step.

---

**3. Add the D1 binding to `wrangler.jsonc`**

```jsonc
"d1_databases": [
  {
    "binding": "AUTH_DB",
    "database_name": "scavenger_hunt_auth",
    "database_id": "<YOUR_DATABASE_ID>"
  }
]
```

---

**4. Apply the schema**

```bash
npx wrangler d1 execute scavenger_hunt_auth --file=migrations/001_init.sql
```

**Expected:** No errors.

---

**5. Add the project row**

```bash
npx wrangler d1 execute scavenger_hunt_auth \
  --command "INSERT OR IGNORE INTO projects (id, hunt_mode, editor_mode, created_at) VALUES ('democrats_abroad', 'limited', 'restricted', unixepoch())"
```

---

**6. Set the bootstrap password in KV**

Choose a strong password — you only need it once.

```bash
npx wrangler kv key put "admin:democrats_abroad" "your_strong_bootstrap_password" \
  --binding AUTH_STORE
```

**Expected:** Confirmation that the key was written.

---

**7. Deploy**

```bash
npx wrangler deploy
```

**Expected:** Worker deployed. The output shows your `workers.dev` URL (e.g. `https://freedom-hunt.your-subdomain.workers.dev`).

Note that URL — you'll use it throughout the deployed guides.

---

## Done

Continue with [deployed-01-organizers.md](deployed-01-organizers.md).
