# Dev/Staging Deployment Implementation Plan

> **Superseded 2026-07-25 — DO NOT EXECUTE.** The project moved to a single-deployment model; see `doc/superpowers/specs/2026-07-25-dev-test-environment-roadmap.md`. Kept for history only.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a second Cloudflare Worker (`da-abroad-freedom-hunt-dev`) at its own `*.workers.dev` URL, sharing the exact same D1 database, KV namespace, and R2 bucket as the production Worker, so new code and content can be tested on a real deployed URL without touching the domain DA participants use.

**Architecture:** Add a Wrangler named environment (`env.dev`) to `wrangler.jsonc` that redeclares the same resource bindings as the top-level (prod) config under a new Worker name. Add a `deploy:dev` npm script mirroring the existing `deploy` script. Document the one-time secret setup and the shared-storage safety rule in `doc/setup.md`. No application code changes — this is infra config only.

**Tech Stack:** Wrangler 4.76 (Cloudflare Workers CLI), `@cloudflare/vite-plugin` (already in use — regenerates a redirected Wrangler config into `dist/` on every `vite build`, which `wrangler deploy` reads instead of `wrangler.jsonc` directly).

## Global Constraints

- Dev Worker name: `da-abroad-freedom-hunt-dev`.
- `env.dev` must redeclare `vars`, `r2_buckets`, `kv_namespaces`, and `d1_databases` with IDENTICAL values to the top-level config (same `database_id`, same KV `id`, same `bucket_name`) — verified below that `main`, `compatibility_date`, `compatibility_flags`, and `assets` do NOT need redeclaring; they resolve correctly from the top level.
- No new Cloudflare resources are created — only a second Worker script bound to existing storage.
- Secrets (`AUTH_SECRET`, `FORM_SCRIPT_URL`, `GITHUB_PAT`) are per-Worker-script in Wrangler and must be set again for `--env dev` even though the storage is shared.
- No CI changes — deploys stay manual, matching the existing `npm run deploy` workflow.
- All dev-environment testing must be scoped to the `demo` project once it exists — never write to `democrats_abroad` rows. This is a documented behavioral rule, not a code guard.
- `wrangler deploy --dry-run` (with or without `--env dev`) works without a Cloudflare login — verified in this repo. It only reads local config and bundles the Worker; it does not call the Cloudflare API. An actual (non-dry-run) deploy requires an authenticated `wrangler login` session and pushes to the real account, so it must be run by a human with that access, not an autonomous agent.
- `wrangler deploy` reads `dist/da_abroad_freedom_hunt/wrangler.json` (the redirected config `@cloudflare/vite-plugin` generates), not `wrangler.jsonc` directly — always run `npm run build` before a dry-run or deploy, otherwise you're validating against a stale build.

---

### Task 1: Add `env.dev` to `wrangler.jsonc`

**Files:**
- Modify: `wrangler.jsonc`

**Interfaces:**
- Consumes: nothing.
- Produces: an `env.dev` Wrangler deploy target, consumed by `deploy:dev` in Task 2 and the manual deploy in Task 4.

- [ ] **Step 1: Add the `env.dev` block**

Add this block as a new top-level key, immediately after the existing `"vars"` block (before the closing `}`):

```jsonc
  "env": {
    "dev": {
      "name": "da-abroad-freedom-hunt-dev",
      "vars": {
        "GITHUB_REPO": "fultslop/freedom_hunt",
      },
      "r2_buckets": [
        {
          "binding": "PHOTOS",
          "bucket_name": "gwc-2026-photos",
        },
      ],
      "kv_namespaces": [
        {
          "binding": "AUTH_STORE",
          "id": "1ec42eaee97c489b83b1fdcef324a01e",
        },
      ],
      "d1_databases": [
        {
          "binding": "AUTH_DB",
          "database_name": "scavenger_hunt_auth",
          "database_id": "cd5fcc35-7577-4295-986c-b690f03045d1",
        },
      ],
    },
  },
```

The full file should now read:

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
      "database_name": "scavenger_hunt_auth",
      "database_id": "cd5fcc35-7577-4295-986c-b690f03045d1",
    },
  ],
  "vars": {
    "GITHUB_REPO": "fultslop/freedom_hunt",
  },
  "env": {
    "dev": {
      "name": "da-abroad-freedom-hunt-dev",
      "vars": {
        "GITHUB_REPO": "fultslop/freedom_hunt",
      },
      "r2_buckets": [
        {
          "binding": "PHOTOS",
          "bucket_name": "gwc-2026-photos",
        },
      ],
      "kv_namespaces": [
        {
          "binding": "AUTH_STORE",
          "id": "1ec42eaee97c489b83b1fdcef324a01e",
        },
      ],
      "d1_databases": [
        {
          "binding": "AUTH_DB",
          "database_name": "scavenger_hunt_auth",
          "database_id": "cd5fcc35-7577-4295-986c-b690f03045d1",
        },
      ],
    },
  },
}
```

- [ ] **Step 2: Rebuild so the redirected Wrangler config picks up the change**

Run: `npm run build`
Expected: build succeeds, ends with `✓ built in ...`.

- [ ] **Step 3: Dry-run the dev environment and verify bindings**

Run: `npx wrangler deploy --env dev --dry-run`
Expected output includes this exact bindings table (same IDs as prod — this is the "data co-exists" property):

```
Your Worker has access to the following bindings:
Binding                                                 Resource
env.AUTH_STORE (1ec42eaee97c489b83b1fdcef324a01e)       KV Namespace
env.AUTH_DB (scavenger_hunt_auth)                       D1 Database
env.PHOTOS (gwc-2026-photos)                            R2 Bucket
env.GITHUB_REPO ("fultslop/freedom_hunt")               Environment Variable
```
followed by `--dry-run: exiting now.` with no errors.

- [ ] **Step 4: Confirm prod dry-run is unaffected**

Run: `npx wrangler deploy --dry-run` (no `--env` flag)
Expected: identical bindings table as Step 3 — proves the prod deploy target still resolves correctly and wasn't broken by adding `env.dev`.

- [ ] **Step 5: Commit**

```bash
git add wrangler.jsonc
git commit -m "infra: add dev Worker environment sharing prod D1/KV/R2"
```

---

### Task 2: Add `deploy:dev` npm script

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: `env.dev` from Task 1.
- Produces: `npm run deploy:dev` command, referenced in Task 3's docs and run manually in Task 4.

- [ ] **Step 1: Add the script**

In `package.json`, in the `"scripts"` block, add a new line immediately after `"deploy"`:

```json
    "deploy": "npm run build && wrangler deploy",
    "deploy:dev": "npm run build && wrangler deploy --env dev",
```

- [ ] **Step 2: Verify the script is registered**

Run: `npm run`
Expected: the printed list of available scripts includes `deploy:dev`.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "infra: add deploy:dev script for the dev Worker environment"
```

---

### Task 3: Document dev deployment setup in `doc/setup.md`

**Files:**
- Modify: `doc/setup.md`

**Interfaces:**
- Consumes: `env.dev` (Task 1), `deploy:dev` (Task 2).
- Produces: the setup guide a human follows to do Task 4.

- [ ] **Step 1: Add a new "Part 6" section**

Add this section at the end of `doc/setup.md`, after the existing "Part 5: Location Editor Setup" section (after its "Security notes" subsection, which currently ends the file):

```markdown

---

## Part 6: Dev/Staging Deployment

A second Cloudflare Worker (`da-abroad-freedom-hunt-dev`) runs the same code at its own `*.workers.dev` URL. It shares the same D1 database, KV namespace, and R2 bucket as production — there is no separate dev database. This exists so new code and content can be tested on a real deployed URL before it reaches the domain DA participants use.

> **Shared storage — read this first.** Because the dev Worker binds to the exact same production D1/KV/R2 as the live app, anything you do on the dev URL is a real write against production storage. There is no sandbox underneath it. **All testing on the dev URL must stay scoped to the `demo` project — never create, edit, or delete data under `democrats_abroad`.**

### One-time setup

The dev Worker needs its own copies of the three Worker secrets, even though storage is shared — Cloudflare secrets are always per-Worker-script.

```
wrangler secret put AUTH_SECRET --env dev
wrangler secret put FORM_SCRIPT_URL --env dev
wrangler secret put GITHUB_PAT --env dev
```

It's safe to paste the exact same values used for production — auth cookies are scoped to whichever URL issued them by the browser, so a shared signing key or script URL doesn't let the two environments interfere with each other.

### Deploying

```
npm run deploy:dev
```

This builds the app and deploys it to the dev Worker. The first deploy will print the assigned `*.workers.dev` URL — save it. Subsequent deploys reuse the same URL.

### Verifying

1. Visit the printed `*.workers.dev` URL — the home screen should list projects, including `democrats_abroad` (proving the dev Worker reaches the same D1 database as prod).
2. Navigate to `/#/login/democrats_abroad` and confirm the existing DA participant password logs in (proving it reaches the same KV namespace). This is a read-only check — do not submit forms or upload photos against `democrats_abroad` from the dev URL.
3. Run `wrangler secret list --env dev` and confirm `AUTH_SECRET`, `FORM_SCRIPT_URL`, and `GITHUB_PAT` are all listed.
```

- [ ] **Step 2: Re-read the new section and cross-check every command against Tasks 1–2**

Confirm `deploy:dev` matches the `package.json` script name exactly, and that the `--env dev` flag is present on every `wrangler secret put` / `wrangler secret list` command shown.

- [ ] **Step 3: Commit**

```bash
git add doc/setup.md
git commit -m "docs: document dev/staging deployment setup"
```

---

### Task 4 (manual — not agent-executable): First deploy and smoke test

This task requires an authenticated `wrangler login` session tied to the real Cloudflare account and performs a real deploy plus real secret writes. It must be run by a human with that access — not by an autonomous coding agent, and not inside this sandbox (confirmed not logged in). If you're an agent executing this plan, stop here and hand this checklist back to the user rather than attempting it.

- [ ] Run `wrangler login` if not already authenticated on this machine.
- [ ] Follow `doc/setup.md` → "Part 6: Dev/Staging Deployment" → "One-time setup" to set the three secrets with `--env dev`.
- [ ] Run `npm run deploy:dev` and note the printed `*.workers.dev` URL.
- [ ] Follow the "Verifying" steps in that same doc section.
- [ ] Confirm `npm run deploy` (prod, no flag) still works unaffected — this proves Task 1 didn't regress the production deploy target. (Optional if you're not ready to actually redeploy prod — the Task 1 Step 4 dry-run already gives strong evidence of this.)
