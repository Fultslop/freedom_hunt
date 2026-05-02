# Task 01: Dependencies + Config

Status: Completed

> Part of [2026-05-02-location-editor.md](2026-05-02-location-editor.md)

**Goal:** Install `js-yaml` (needed by the Worker to parse YAML fetched from GitHub), and register `GITHUB_REPO` as a plain config var in `wrangler.jsonc`. The PAT itself is a secret set via `wrangler secret put` (covered in Task 07).

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `wrangler.jsonc` — add `vars` block with `GITHUB_REPO`

---

- [ ] **Step 1: Install js-yaml**

```
npm install js-yaml
```

Expected output: js-yaml added to `dependencies` in `package.json`.

- [ ] **Step 2: Add GITHUB_REPO to `wrangler.jsonc`**

Open `wrangler.jsonc`. Add a `vars` block after the `kv_namespaces` array. Replace `pointlesspun/freedom_hunt` with the actual GitHub `owner/repo` if different:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "da-abroad-freedom-hunt",
  "main": "src/worker.js",
  "compatibility_date": "2025-09-27",
  "observability": {
    "enabled": true
  },
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  },
  "r2_buckets": [
    {
      "binding": "PHOTOS",
      "bucket_name": "gwc-2026-photos"
    }
  ],
  "compatibility_flags": [
    "nodejs_compat"
  ],
  "kv_namespaces": [
    {
      "binding": "AUTH_STORE",
      "id": "1ec42eaee97c489b83b1fdcef324a01e"
    }
  ],
  "vars": {
    "GITHUB_REPO": "pointlesspun/freedom_hunt"
  }
}
```

- [ ] **Step 3: Add GITHUB_PAT to `.dev.vars` for local development**

Open `.dev.vars` (in the project root). Add the line — use a real PAT with `contents:read+write` and `pull_requests:write` scope on the repo:

```
GITHUB_PAT=your_personal_access_token_here
```

Do not commit `.dev.vars` — it is already in `.gitignore`.

- [ ] **Step 4: Verify the build still works**

```
npm run build
```

Expected: build succeeds, no errors about js-yaml.

- [ ] **Step 5: Commit**

```
git add wrangler.jsonc package.json package-lock.json
git commit -m "chore: add js-yaml dependency and GITHUB_REPO wrangler var"
```
