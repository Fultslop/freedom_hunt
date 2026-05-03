# Location Editor Implementation Plan

Status: Completed

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a password-protected organiser tool at `/editor` where non-technical organisers can add, edit, and hide hunt locations — each change opens a GitHub PR for review before going live.

**Architecture:** The Cloudflare Worker gains GitHub API proxy routes (`/editor/locations`, `/editor/location`) that use a stored PAT to read and write YAML files in the repo. The React app gains an `/editor` subtree protected by an `AdminRoute` guard — a login page (project + password, no team field), a landing page with three tiles (City, Route, Location — first two placeholder), and a fully functional location list + form. Submitted changes create a GitHub PR; the local optimistic state is stored in `localStorage` and shown as a "Pending edit" badge on the list. The `challenge.form` array is preserved round-trip but not editable in v1.

**Tech Stack:** Cloudflare Workers, js-yaml (npm), GitHub REST API v3, React JSX, CSS custom properties, Vitest

**Dependency note:** Tasks 01–03 implement admin auth. If the dashboard plan (`2026-05-02-dashboard-03-admin-auth.md`) has already been fully implemented, skip Task 03 of this plan — `AdminRoute`, `AuthContext` changes, and `LoginPage` changes are already in place.

---

## Tasks

| # | File(s) | What it does |
|---|---------|-------------|
| [01](2026-05-02-location-editor-01-deps-config.md) | `package.json`, `wrangler.jsonc` | Install js-yaml; add GITHUB_REPO var |
| [02](2026-05-02-location-editor-02-worker-github.md) | `src/worker.js`, `src/test/worker.test.js` | Worker GitHub proxy routes |
| [03](2026-05-02-location-editor-03-admin-auth.md) | `src/worker.js`, `src/auth/AuthContext.jsx`, `src/auth/AdminRoute.jsx`, `src/pages/LoginPage.jsx` | Admin auth tier (skip if dashboard-03 done) |
| [04](2026-05-02-location-editor-04-editor-shell.md) | `src/pages/editor/EditorLoginPage.jsx`, `src/pages/editor/EditorPage.jsx`, `src/App.jsx` | Editor login, landing shell, routing |
| [05](2026-05-02-location-editor-05-location-list.md) | `src/pages/editor/EditorLocationList.jsx` | Location list with pending overlay |
| [06](2026-05-02-location-editor-06-location-form.md) | `src/pages/editor/EditorLocationForm.jsx` | Add / edit / hide form → PR |
| [07](2026-05-02-location-editor-07-setup-docs.md) | `doc/setup.md` | GITHUB_PAT + GITHUB_REPO setup guide |

---

## Location YAML schema (reference)

Every location file (`001_loc_binnenhof.yaml`, etc.) has this shape. Fields marked **editable** appear in the form; `challenge.form` is read-only in v1.

```yaml
locationId: 1                        # read-only in form
title: "The Final Civic Act"         # editable
image: filename.jpg                  # editable (filename only, no upload in v1)
name:
  label: ""                          # editable
  value: "Binnenhof / Het Plein"     # editable
address: "Binnenhof 1"              # editable
coordinates:
  longitude: 4.3133                  # editable
  latitude: 52.0799                  # editable
storyline: |                         # editable (textarea)
  …
challenge:
  name: ""                           # editable
  description: |                     # editable (textarea)
    …
  notes: ""                          # editable
  form:                              # NOT editable in v1, preserved round-trip
    - …
breadcrumb: |                        # editable (textarea)
  …
hidden: true                         # set by Hide action only (not in form)
```

## GitHub PR flow (reference)

The Worker performs these GitHub API calls to create a PR:

1. `GET /repos/{repo}/git/ref/heads/main` → get HEAD SHA
2. `POST /repos/{repo}/git/refs` → create branch `editor/{filename-base}-{timestamp}`
3. `GET /repos/{repo}/contents/{filepath}` → get current file SHA (update only)
4. `PUT /repos/{repo}/contents/{filepath}` → commit YAML on branch
5. `POST /repos/{repo}/pulls` → open PR to main

File path format: `src/data/text/en/projects/{project}/{city}/{filename}`
