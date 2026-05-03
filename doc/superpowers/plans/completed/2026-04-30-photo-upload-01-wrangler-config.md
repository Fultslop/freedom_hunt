# Task 1: Configure wrangler.jsonc

**Part of:** [Photo Upload](2026-04-30-photo-upload.md)
**Depends on:** nothing
**Next:** [Task 2 — Create Worker script](2026-04-30-photo-upload-02-worker-script.md)

**Files:**

- Modify: `wrangler.jsonc`

---

- [ ] **Step 1: Add `main` and `r2_buckets` to wrangler.jsonc**

Replace the contents of `wrangler.jsonc` with:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "gwc-2026",
  "main": "src/worker.js",
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
}
```

- [ ] **Step 2: Verify the dev server still starts**

```bash
npm run dev
```

Expected: server starts with no errors. Stop it with Ctrl+C.

> Note: `src/worker.js` does not exist yet — this step just confirms Vite (not wrangler) is unaffected. The wrangler preview will be tested in Task 2.

- [ ] **Step 3: Commit**

```bash
git add wrangler.jsonc
git commit -m "feat: add Worker entry and R2 bucket binding to wrangler config"
```
