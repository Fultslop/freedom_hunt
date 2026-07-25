# Dev/Test Environment — Roadmap

**Date:** 2026-07-25 (revised same day — see Revision History)
**Status:** All four sub-projects have a written spec and implementation plan, ready for review. Nothing has been implemented yet.

This is an index document, not a technical design — it exists so the sub-specs below read as one initiative instead of unrelated changes. Each sub-project gets its own spec → plan → implementation cycle; this doc tracks how they fit together and links to each as it's written.

---

## Why

The Democrats Abroad (Den Haag) project is now live production data — real participants, real submissions, real photos. It can no longer double as the team's playground for testing new features. We need a full test setup inside the same app: a landing page where testers can pick between the real DA project and a single `demo` project, where `demo` itself contains **both** DA's real content (referenced, not copied, so testers exercise the actual real flow) **and** synthetic new content (Paris/New York) that exercises the rest of the feature surface — all without any risk to DA's actual production data.

## Architecture

**Single Cloudflare Worker deployment — no second Worker, no separate URL.** Earlier in this initiative we designed a second Worker on its own `*.workers.dev` subdomain (see the superseded spec below); that was solving *code* isolation (a safe place to deploy in-progress backend changes). What's actually needed here is *data* isolation, which the app already provides for free: everything is scoped by `project_id` — D1 rows, KV password keys (`auth:<project>`), participant auth tokens. A second project id is already fully isolated from `democrats_abroad`'s real rows without any new infrastructure.

**Two project ids, not three.** `demo` is a single project containing four cities:

| Project id | Cities | What it is | Data source |
|---|---|---|---|
| `democrats_abroad` | `den_haag` (`oslo` present but disabled) | The real, live event. Unchanged. | Real D1/KV/R2, real Google Sheet via `FORM_SCRIPT_URL` |
| `demo` | `den_haag`, `oslo` (**by reference** — same YAML files DA uses, not a copy), `paris`, `new_york` (new synthetic content) | One test project spanning DA's real content and new content, so testers can exercise the actual real flow *and* the rest of the feature surface from one login. | Own D1 rows, own whitelist-based login (sub-project 4) — content for `den_haag`/`oslo` is read live from `democrats_abroad`'s directory via a small path-alias layer in `loadText.ts`; `paris`/`new_york` are demo's own files |

Both live in the same `projects.yaml`, so the landing page (`AppPage.svelte`) lists both as normal cards — no query param, no hidden picker, no build-mode gating. Routing stays hash-based (`#/demo/den_haag`, `#/demo/paris`) per the app's existing `svelte-spa-router` setup; a true path-based URL (`/demo` without the `#`) would require dropping hash routing entirely, which is out of scope here.

**Why reference DA's content instead of copying it (revised from the original plan):** a byte-for-byte copy under a second project id was the original design for sub-project 2, but it means two physical sets of files that can silently drift apart, and it implied `demo` and DA's-content-for-testing were different projects with different logins — contrary to "one demo project, pick DA-or-demo from one landing page." Referencing the same files directly (a path alias resolved at content-load time, detailed in sub-project 2) means there's exactly one copy of DA's content in the repo, ever, and testers reach it through the same `demo` login as everything else.

## Desired End State

| Requirement | Delivered by |
|---|---|
| Landing page lets testers choose DA or Demo | Already true once `demo` is added to `projects.yaml` — no new mechanism |
| Demo project includes DA's real content, safe to test against | Sub-project 2 (`demo/den_haag`, `demo/oslo`, by reference) |
| Demo project has two new cities (Paris, New York) | Sub-project 3 |
| Each new Demo city has 3 routes, each route 10 locations, 5/10 with a form incl. photo | Sub-project 3 |
| Demo project has its own photo gallery | Sub-project 3 (verification only — `/:project/:city/gallery` is already generic) |
| Demo project has its own login, whitelisted email + password, and a sign-up page | Sub-project 4 — covers all four of `demo`'s cities from one login |
| Testing never writes to the real DA D1 rows, KV password, R2 photos, or Google Sheet | Sub-project 1 (form-submit routing) + project-id scoping used throughout sub-projects 2–4 |
| Demo data co-exists with DA data (not a separate database) | Architecture above — one shared D1/KV/R2, isolated by `project_id`; DA's static content is shared too, by reference |

## Sub-Projects

### 1. Form-submit routing safety (backend, foundational)

Today `/form-submit` always forwards to `env.FORM_SCRIPT_URL` — DA's real Google Sheet — regardless of which project the submission came from. Before any project with forms exists besides `democrats_abroad`, this needs to become project-aware: only `democrats_abroad` posts to Google Apps Script; every other project id (just `demo`, under the current design) writes to a new D1 table instead. While researching this, a related gap surfaced and is folded in: `formSubmitRoute.ts` and `galleryRoutes.ts` didn't verify that an authenticated participant's own project matched the URL's project, meaning a participant of one project could read/write another's data by changing the URL. This has to land **before** sub-projects 2 and 3, because sub-project 2 makes DA's real form-bearing locations reachable under `demo` too — without this fix, submitting a test form there would write straight into DA's real, live Google Sheet.

- **Spec:** [2026-07-25-form-submit-routing-safety-design.md](2026-07-25-form-submit-routing-safety-design.md)
- **Plan:** `doc/superpowers/plans/2026-07-25-form-submit-routing-safety.md`
- **Status:** Spec and plan written, ready for review. No dependencies — can be implemented first.

### 2. DA content by reference in the Demo project

Adds `den_haag` and `oslo` as two more cities inside the `demo` project — **not** a copy of DA's YAML files, but a small path-alias layer in `src/utils/loadText.ts` that resolves `projects/demo/den_haag/...` (and `oslo`) straight to `projects/democrats_abroad/den_haag/...` at content-load time. `demo/cities.yaml` gets two more entries; no location/route/form files are duplicated. Depends on sub-project 3 having already created the `demo` project scaffold (`demo.yaml`, `cities.yaml`, the `projects.yaml` entry) — this sub-project appends to that rather than creating it, so the build order is 3 before 2 even though this is numbered second in the requirements list.

- **Spec:** [2026-07-25-demo-da-content-mirror-design.md](2026-07-25-demo-da-content-mirror-design.md) *(filename kept from the original copy-based design; content rewritten for the reference-based approach)*
- **Plan:** `doc/superpowers/plans/2026-07-25-demo-da-content-mirror.md`
- **Status:** Spec and plan written, ready for review. Depends on sub-project 1 (forms must already be routed safely — the referenced content includes forms) **and** sub-project 3 (needs `demo/cities.yaml` to already exist).

### 3. Demo project content (Paris / New York)

Scaffolds the `demo` project itself (`demo.yaml`, `cities.yaml`, `projects.yaml` entry) and adds two new cities: Paris and New York, 3 routes × 10 locations each, 5 of 10 locations per route carrying a form with a photo field. Synthetic content, authored fresh — real, recognizable landmarks, generic trivia framing. Demo's photo gallery falls out of this for free, since `/:project/:city/gallery` is already generic — this sub-project verifies that rather than building anything new.

- **Spec:** [2026-07-25-demo-project-content-design.md](2026-07-25-demo-project-content-design.md)
- **Plan:** `doc/superpowers/plans/2026-07-25-demo-project-content.md`
- **Status:** Spec and plan written, ready for review. Depends on sub-project 1 only. Content isn't reachable through login until sub-project 4 ships. Build this **before** sub-project 2 (see above).

### 4. Demo participant auth

A new auth mode for participants, used by the `demo` project — covering all four of its cities (`den_haag`, `oslo`, `paris`, `new_york`) from one login, since they're all one project. A pre-approved email whitelist (D1 table, managed by manual `wrangler d1 execute` for now — no admin UI yet) gates a new participant-facing sign-up page, which creates an individual email+password account — distinct from DA's shared-team-password model (which only `democrats_abroad` keeps using now) and from the existing D1 editor/organizer account model, but issuing the *same* participant token shape so all existing participant-facing code needs no changes.

- **Spec:** [2026-07-25-demo-participant-auth-design.md](2026-07-25-demo-participant-auth-design.md)
- **Plan:** `doc/superpowers/plans/2026-07-25-demo-participant-auth.md`
- **Status:** Spec and plan written, ready for review. Depends on sub-project 3 (needs the `demo` project to exist) and, for its manual verification step, benefits from sub-project 1 being live first.

## Sequencing

1 → 3 → 2 → 4. Form-submit safety lands first — it's what makes it safe to introduce any new project with forms. Sub-project 3 comes next because it creates the `demo` project scaffold; sub-project 2 appends to that scaffold rather than creating its own project, so it has to follow 3 despite the numbering. Sub-project 4 needs the `demo` project to exist before it has anything to gate access to.

## Out of Scope (for the whole initiative)

- Migrating DA's live form-submit pipeline off Google Apps Script — `democrats_abroad` keeps using it; only new projects use D1.
- A separate/cloned database, KV namespace, or R2 bucket for testing — everything shares the same storage, isolated by `project_id`.
- A second Cloudflare Worker or a `*.workers.dev` staging subdomain — superseded, see Revision History.
- True path-based URLs (`/demo` without a `#`) — the app keeps hash-based routing; sub-project 3 will confirm the exact hash-route shape.
- CI/CD automation of deploys — deploys stay manual `npm run deploy`.
- Any change to DA's existing shared-team-password login.

## Revision History

- **2026-07-25 (original):** Proposed a second Cloudflare Worker (`da-abroad-freedom-hunt-dev`) on its own subdomain, sharing prod D1/KV/R2, as sub-project 1. Spec and plan were written and are kept at `doc/superpowers/specs/2026-07-25-dev-deployment-design.md` / `doc/superpowers/plans/2026-07-25-dev-deployment.md`, both marked superseded.
- **2026-07-25 (revised):** Replaced the second-Worker approach with a single-deployment model isolated by `project_id`, added the `democrats_abroad_demo` content-mirror concept, and reordered so form-submit routing safety lands first.
- **2026-07-25 (specs + plans written):** All four sub-projects now have a written spec and implementation plan (linked above). None has been implemented — awaiting review.
- **2026-07-25 (merged into a single `demo` project):** Corrected: there is one `demo` project, not two (`demo` + `democrats_abroad_demo`). `demo` contains DA's real content by reference (a small path-alias layer, not a file copy) alongside new Paris/New York content, all under one login. Sub-project 2's spec and plan were rewritten for this; build order is now 1 → 3 → 2 → 4 (sub-project 2 appends to the project scaffold sub-project 3 creates, rather than creating its own).
