# Dev/Staging Deployment Design

**Date:** 2026-07-25
**Superseded 2026-07-25:** the project settled on a single-deployment model instead — the Demo project and a `democrats_abroad_demo` content mirror live on the *same* Worker/domain as production, isolated purely by `project_id` scoping (already built into the app) rather than by a second Worker. See [2026-07-25-dev-test-environment-roadmap.md](2026-07-25-dev-test-environment-roadmap.md) for the current plan. Kept below for history — nothing in this file should be implemented.
**Scope:** A second, independently-deployable Cloudflare Worker for this project, served at its own URL, sharing the production D1 database / KV namespace / R2 bucket. Does NOT include a separate database, separate secrets *values*, custom domain/DNS work, or any CI/CD automation — see Out of Scope.

---

## Background

The Democrats Abroad (Den Haag) project is now live production data — it can no longer double as the team's test/staging target. This is the first of four sub-projects toward a proper dev/test setup (dev deployment → Demo project content → Demo participant auth → form-submit to D1); this spec covers only the deployment piece: a place to point a browser at new code/content before it reaches the domain DA participants use.

Today, deployment is entirely manual: `npm run deploy` (`vite build && wrangler deploy`) pushes to the single Worker `da-abroad-freedom-hunt`, configured in `wrangler.jsonc` with no `env` blocks. There is no CI-driven deploy — `.github/workflows/ci.yml` only lints, typechecks, and tests. Secrets (`AUTH_SECRET`, `FORM_SCRIPT_URL`, `GITHUB_PAT`) are set via `wrangler secret put` and documented in `doc/setup.md`.

---

## Architecture

### What changes

| Layer | Now | After |
|---|---|---|
| `wrangler.jsonc` | Single top-level config, no environments | Adds an `env.dev` block: its own Worker `name`, and its own copies of `d1_databases` / `kv_namespaces` / `r2_buckets` / `vars` pointing at the **same** IDs/names as the top-level (prod) config |
| Worker deployments | One (`da-abroad-freedom-hunt`) | Two: prod (unchanged) and `da-abroad-freedom-hunt-dev` |
| Public URL | Whatever's attached to the prod Worker today (default `*.workers.dev` subdomain or a manually-attached custom domain — not visible in the repo) | Dev gets its own `*.workers.dev` subdomain automatically from its Worker name, e.g. `da-abroad-freedom-hunt-dev.<account-subdomain>.workers.dev` |
| Secrets | One copy each, on the prod Worker | A second copy each (`wrangler secret put <NAME> --env dev`) — Wrangler secrets are always per-Worker-script, never shared across environments even when other bindings are |
| `package.json` scripts | `deploy` only | Adds `deploy:dev` |
| Storage (D1/KV/R2) | Prod only | **Unchanged, single set of resources** — both Workers bind to the identical `database_id`, KV `id`, and `bucket_name`. This is what makes Demo project data and DA project data literally co-exist: one database, scoped by `project_id`, reachable from two different Worker deployments. |

### Why shared storage instead of a clone

A second Worker with its own D1/KV/R2 would give full isolation, but the requirement is that Demo data "co-exists" with DA's — i.e. the app's existing multi-tenant model (everything scoped by `project_id`) is the isolation boundary, not a second database. Sharing storage also means there's nothing to keep in sync: one migration, one schema, one set of real rows, reachable from either URL. The cost is accepted explicitly below.

### Config inheritance note (for the implementation plan)

Wrangler does not deep-merge array-shaped config (`d1_databases`, `kv_namespaces`, `r2_buckets`) between the top level and an `env` block — an `env.dev` section must fully re-list each binding with the same `database_id`/`id`/`bucket_name` as prod, or the dev Worker won't have them. `main`, `compatibility_date`, and `compatibility_flags` are simple values and are inherited. This should be confirmed with `wrangler deploy --env dev --dry-run` before the first real deploy, since exact inheritance behavior is version-dependent.

---

## Deploy Workflow

- `npm run deploy:dev` → `vite build && wrangler deploy --env dev`
- No change to `npm run deploy` (prod) or to CI, which never deploys.
- One-time setup, documented in `doc/setup.md`:
  1. Add the `env.dev` block to `wrangler.jsonc`.
  2. `wrangler secret put AUTH_SECRET --env dev` (reuse the same value as prod — harmless, since auth cookies are host-scoped by the browser and never cross between the two URLs regardless of a shared signing key).
  3. `wrangler secret put FORM_SCRIPT_URL --env dev` and `wrangler secret put GITHUB_PAT --env dev` (reuse prod values, or point at throwaway test targets if preferred — either works since these aren't security-sensitive to duplicate).
  4. `wrangler deploy --env dev --dry-run` to sanity-check config resolution.
  5. `npm run deploy:dev` for the first real deploy; confirm the new `*.workers.dev` URL serves the SPA and that `/auth/login` works end-to-end.

---

## Safety Note — Shared Production Storage

This is the one deliberate risk this design accepts: because dev and prod bind to the *same* D1 database, KV namespace, and R2 bucket, anything exercised on the dev URL is a real write against production storage — there is no sandbox underneath it.

The mitigation is behavioral, not technical: all dev-environment testing must be scoped to the `demo` project (introduced in the next sub-project spec) and must never write, edit, or delete rows/objects belonging to `democrats_abroad`. This will be called out explicitly in `doc/setup.md`'s dev-deployment section. No code-level tenant isolation (e.g. blocking dev from touching `democrats_abroad` rows) is in scope for this spec — the existing `project_id` scoping already used throughout the app is treated as sufficient given the org's size and usage pattern.

---

## Out of Scope

- A dedicated/cloned database for dev (rejected — contradicts "data co-exists").
- Custom domain or Cloudflare Route/path-based dev URL — the `*.workers.dev` subdomain is simpler, requires no DNS/zone work, and directly satisfies "a different URL."
- CI/CD automation of `deploy:dev` — deploys stay manual, matching the existing prod workflow.
- Any application-level guard preventing dev-origin requests from mutating `democrats_abroad` rows — accepted as a documented behavioral risk, not a code change, per the Safety Note above.
- Rotating or differentiating secret *values* between prod and dev — copies are fine; only the Worker deployment differs.

---

## Testing / Verification

Since this is infra config, not application code, verification is manual:

1. `wrangler deploy --env dev --dry-run` — confirms config resolves (bindings present, no missing-field errors) without pushing anything.
2. `npm run deploy:dev` — real deploy; visit the resulting `*.workers.dev` URL.
3. Confirm the SPA loads (`AppPage` lists projects, including `democrats_abroad` — proving shared D1 is reachable).
4. Confirm `/auth/login/democrats_abroad` accepts the existing DA participant password (proving shared KV is reachable) — read-only smoke test, no writes against DA data.
5. Confirm `wrangler secret list --env dev` shows all three secrets set.

No automated tests are added for this spec — there's no application code to unit test.
