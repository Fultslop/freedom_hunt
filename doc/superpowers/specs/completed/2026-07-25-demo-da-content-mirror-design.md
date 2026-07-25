# DA Content by Reference in the Demo Project Design

**Date:** 2026-07-25 (rewritten same day — see note below)
**Rewritten:** the original version of this spec proposed copying DA's real content into a second project id, `democrats_abroad_demo`. That's been replaced: DA's content is now referenced from inside the single `demo` project (alongside the Paris/New York content from [sub-project 3](2026-07-25-demo-project-content-design.md)), not copied into a second project. This version reflects that.
**Scope:** Add `den_haag` and `oslo` as two more cities inside the `demo` project, resolved live from `democrats_abroad`'s existing content files — no duplicated YAML, no second project id, no second login. Does NOT include any new application code beyond a small path-alias layer — see Out of Scope.

---

## Background

This is sub-project 2 of the [dev/test environment roadmap](2026-07-25-dev-test-environment-roadmap.md). It depends on [sub-project 1](2026-07-25-form-submit-routing-safety-design.md) (form-submit routing safety must already be in place — DA's real content includes forms) **and** [sub-project 3](2026-07-25-demo-project-content-design.md), which creates the `demo` project scaffold (`demo.yaml`, `cities.yaml`, the `projects.yaml` entry) that this sub-project appends to. Despite the numbering, build sub-project 3 first.

The requirement: "Demo is a project consisting of the existing democrats abroad data (cities, routes, locations, forms) by reference and the new demo (paris, new york)." One project, one login, four cities — two of which (`den_haag`, `oslo`) are DA's real content, read live rather than copied.

## Why reference instead of copy

The app's content loader (`src/utils/loadText.ts`) resolves every YAML file through one function, `loadText(lang, path)`, where `path` is built by page components as `projects/${project}/${city}/...`. Every location, route, and city file in the app passes through this single chokepoint. That makes "reference" tractable without filesystem symlinks (which would be fragile here — this repo is developed on Windows, where symlinks require elevated permissions or Developer Mode, and git's symlink support needs explicit configuration that isn't guaranteed on every contributor's machine). Instead, a small path-alias table inside `loadText.ts` rewrites specific `demo/...` paths to their `democrats_abroad/...` equivalents before the lookup happens — a code-level redirect, not a filesystem one.

## Architecture

### What changes

| Layer | Now | After |
|---|---|---|
| `src/utils/loadText.ts` | `loadText(lang, path)` resolves `path` directly against the bundled YAML modules | Before resolving, rewrites `path` if it starts with an aliased prefix (`projects/demo/den_haag` → `projects/democrats_abroad/den_haag`, `projects/demo/oslo` → `projects/democrats_abroad/oslo`); everything else passes through unchanged |
| `src/data/text/en/projects/demo/cities.yaml` | Lists `paris`, `new_york` (from sub-project 3) | Two more entries: `den_haag`, `oslo` |
| `src/data/text/en/projects/democrats_abroad/` | — | **Untouched.** This is the single source of truth; nothing here changes |
| `src/data/text/en/projects/demo/den_haag/`, `.../oslo/` | — | **Do not exist.** There is nothing to create — the alias means these paths never get looked up literally |

### How the alias resolves, concretely

`CityPage.svelte` and `RoutePage.svelte` build paths like `projects/demo/den_haag/routes`, `projects/demo/den_haag/den_haag`, `projects/demo/den_haag/001_loc_abc` — exactly the same shape as any other project's paths, with no awareness that `den_haag` is aliased. `loadText`'s alias table matches on a path prefix boundary (`projects/demo/den_haag` as a whole segment, not a bare string prefix that could accidentally also match something like a hypothetical `den_haag_extra`), rewrites the matched prefix, and looks up the rewritten path in the same `import.meta.glob` module map that already includes every file under `democrats_abroad/` — since that map is a blanket glob over the whole `data/text` tree, the aliased target is always already present with zero new files.

`projects/demo/demo` (the project metadata file) and `projects/demo/cities` (the city list) are **not** aliased — those belong to `demo` itself, listing all four cities including the two real ones, and are authored once in sub-project 3 and extended here. Only city-and-below paths (`den_haag`/`oslo` and everything nested under them) are redirected.

### `demo/cities.yaml` additions

Small metadata entries, copied from `democrats_abroad/cities.yaml`'s existing `den_haag` entry (same `name`, `image`, `country`, `description`, `coordinates` — this is index metadata, not bulk content, so duplicating a handful of lines here doesn't reintroduce the drift problem a full content copy would). `oslo` was initially planned as included and enabled here even though it's commented out (disabled) in DA's real `cities.yaml` — but its card image and all 7 of its location images don't exist anywhere in `src/data/img/` (a dormant gap in DA's own content, never visible while Oslo stayed disabled there). Enabling it here would have surfaced broken images throughout. `demo/cities.yaml`'s Oslo entry is commented out to match, with a note on what's missing — re-enable once real images are sourced.

## Out of Scope

- Any change to `democrats_abroad`'s own content, routing, or auth — this sub-project only adds a read path from `demo` into it.
- Aliasing the location editor (`/editor`) — editing DA's real content is still done through the real `democrats_abroad` project in the editor; there's no "edit via demo" path, and none is needed since `demo/den_haag` is a read-only mirror by construction.
- Enabling DA's currently-commented-out `extended_route` — the alias reflects `democrats_abroad/den_haag/routes.yaml` exactly as it is, including what's disabled there; only the city-level `oslo` toggle (a `demo`-local decision in `demo/cities.yaml`, not a change to DA's file) differs from DA's real picker.
- A KV password specific to `den_haag`/`oslo` within `demo` — the whole `demo` project shares one auth mechanism (sub-project 4's whitelist model), not a per-city password.

## Testing / Verification

1. Unit tests for the alias resolution in `loadText.ts` (new): `projects/demo/den_haag/routes` resolves to the same content as `projects/democrats_abroad/den_haag/routes`; same for a location path and the `oslo` prefix; `projects/demo/demo`, `projects/demo/cities`, and `projects/demo/paris/...` are confirmed **not** aliased (pass through unchanged).
2. `npm run validate:yaml` — only `demo/cities.yaml`'s new entries are new content to validate; nothing under `democrats_abroad/` changes.
3. Manual: once sub-project 4's login exists, log into `demo`, confirm `den_haag` and `oslo` appear as cities alongside `paris`/`new_york`; walk `den_haag`'s `short_loop` and confirm it renders identically to the real DA project (same storyline, same form); submit the form and confirm it lands in D1 (per sub-project 1) rather than DA's real Google Sheet.
