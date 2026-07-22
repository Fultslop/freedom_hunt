# Task 01: Infrastructure — D1 Binding, Migration, Env Type

**Files:**
- Create: `migrations/001_init.sql`
- Modify: `wrangler.jsonc`
- Modify: `src/types/worker.ts`

No tests in this task — infrastructure only. All existing tests must still pass at the end.

---

- [ ] **Step 1: Create the D1 database via wrangler**

Run in the project root:
```bash
npx wrangler d1 create freedom_hunt_auth
```

Copy the `database_id` from the output — you'll need it in Step 2.

---

- [ ] **Step 2: Add D1 binding to `wrangler.jsonc`**

Add the `d1_databases` array after the `kv_namespaces` block. Replace `<YOUR_DATABASE_ID>` with the id from Step 1:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "da-abroad-freedom-hunt",
  "main": "src/worker.ts",
  "compatibility_date": "2025-09-27",
  "observability": {
    "enabled": true,
  },
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application",
  },
  "r2_buckets": [
    {
      "binding": "PHOTOS",
      "bucket_name": "gwc-2026-photos",
    },
  ],
  "compatibility_flags": ["nodejs_compat"],
  "kv_namespaces": [
    {
      "binding": "AUTH_STORE",
      "id": "1ec42eaee97c489b83b1fdcef324a01e",
    },
  ],
  "d1_databases": [
    {
      "binding": "AUTH_DB",
      "database_name": "freedom_hunt_auth",
      "database_id": "<YOUR_DATABASE_ID>",
    },
  ],
  "vars": {
    "GITHUB_REPO": "fultslop/freedom_hunt",
  },
}
```

---

- [ ] **Step 3: Add `AUTH_DB` to the `Env` type**

Full replacement of `src/types/worker.ts`:

```typescript
/// <reference types="@cloudflare/workers-types" />

export interface Env {
  AUTH_STORE: KVNamespace;
  AUTH_DB: D1Database;
  AUTH_SECRET: string;
  PHOTOS: R2Bucket;
  ASSETS: Fetcher;
  GITHUB_REPO: string;
  GITHUB_PAT: string;
  FORM_SCRIPT_URL: string;
}
```

---

- [ ] **Step 4: Write the migration file**

Create `migrations/001_init.sql`:

```sql
CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,
  hunt_mode    TEXT NOT NULL DEFAULT 'open',
  editor_mode  TEXT NOT NULL DEFAULT 'restricted',
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id                      TEXT PRIMARY KEY,
  email                   TEXT UNIQUE NOT NULL,
  username                TEXT UNIQUE NOT NULL,
  password_hash           TEXT NOT NULL,
  created_at              INTEGER NOT NULL,
  email_consent_results   INTEGER,
  email_consent_marketing INTEGER,
  email_consent_at        INTEGER
);

CREATE TABLE IF NOT EXISTS user_project_caps (
  user_id             TEXT NOT NULL REFERENCES users(id),
  project_id          TEXT NOT NULL,
  capability          TEXT NOT NULL,
  granted_at          INTEGER NOT NULL,
  granted_by_user_id  TEXT REFERENCES users(id),
  revoked_at          INTEGER,
  PRIMARY KEY (user_id, project_id, capability)
);

CREATE INDEX IF NOT EXISTS idx_caps_user ON user_project_caps(user_id, revoked_at);

CREATE TABLE IF NOT EXISTS invite_tokens (
  token               TEXT PRIMARY KEY,
  project_id          TEXT NOT NULL,
  capability          TEXT NOT NULL,
  created_at          INTEGER NOT NULL,
  expires_at          INTEGER NOT NULL,
  used_at             INTEGER,
  revoked_at          INTEGER,
  invited_by_user_id  TEXT REFERENCES users(id)
);

-- Seed: DA abroad project
INSERT OR IGNORE INTO projects (id, hunt_mode, editor_mode, created_at)
VALUES ('democrats_abroad', 'limited', 'restricted', unixepoch());
```

---

- [ ] **Step 5: Apply the migration locally**

```bash
npx wrangler d1 execute freedom_hunt_auth --local --file=migrations/001_init.sql
```

Expected output: `Successfully applied migration` (no errors).

---

- [ ] **Step 6: Verify existing tests still pass**

```bash
npm run test:run
```

Expected: all existing tests pass (D1 binding not yet used in any test).

---

- [ ] **Step 7: Commit**

```bash
git add migrations/001_init.sql wrangler.jsonc src/types/worker.ts
git commit -m "feat: add D1 database binding and schema migration for user auth"
```
