# Editor PR Workflow — Production Hardening

**Date:** 2026-05-11
**Status:** Approved

## Problem

The editor's location form is a proof-of-concept. Four issues block production readiness:

1. After submit, a full-screen success dialog with "back to list" is shown once — the PR link should be persistent in the list.
2. Each submit creates a new PR, even if one is already open for that file.
3. If the user makes no changes, submit should be disabled.
4. The "pending PR" badge in the location list is never shown for edits — a filename computation bug stores the wrong key in localStorage.

A resilience gap was also identified: if the network drops, "Try again" is the only fallback. Form values should auto-save as a draft so no work is lost.

## Decisions

### Success screen
Keep a minimal success state — `✓ Changes submitted. [View pull request →]` + single "Back to list" button. Not removed entirely: the user must always see the PR URL before leaving the form, even if the list also shows it.

### Idempotent PR branch name
`editor/{slug(teamName)}/{slug(filePath)}` where `filePath` is the full repo path (e.g. `src/data/text/en/projects/democrats_abroad/den_haag/001_loc_binnenhof.yaml`). Using the full path guarantees uniqueness across all future editor types (locations, cities, routes). Derived entirely on the backend from the JWT — no frontend input needed.

### Storage namespace
`getPending`/`addPending`/`removePending` and all draft helpers accept a single `namespace` string instead of separate `project` + `city` params. Location editor passes `{project}/{city}/locations`. Future editors pass their own namespaces (e.g. `{project}/cities`).

### `createFilePR` (renamed from `createLocationPR`)
Accepts `filePath: string` instead of `project` + `city` + `filename`. Works for any editor type.

### Draft auto-save
Auto-save on every form change via `onValuesChange` callback on `AppForm`. Draft key: `editor_draft_{namespace}_{filename}` for edits, `editor_draft_{namespace}_new` for new. Draft restored on form open; cleared on successful submit.

### Pending additions in list
New locations (pending entries with no match in the GitHub-fetched list) appear in a "Pending additions" section above the main list, with PR link and a Remove button.

## Architecture

### Frontend components affected

**`AppForm.svelte`** (generic — used by all editors and challenge form):
- Add `hasChanges: boolean` derived — compares `values` vs `initialValues` field by field, using `JSON.stringify` for arrays.
- Add `onValuesChange?: (values: FieldValues) => void` prop, fired via `$effect(() => { onValuesChange?.({...values}); })`.
- Submit button: disabled + "No changes" label when `!hasChanges`.

**`EditorLocationForm.svelte`**:
- Fix `resolvedFilename`: use `params.filename` directly for edit routes (was always recomputing with `params.newId ?? 0`, producing `000_loc_*` instead of `001_loc_*`).
- Load draft synchronously at `$state` init for new locations (before AppForm mounts). For edits, apply draft in the server-load `.finally()` (after `locLoading` guards AppForm mount).
- Pass `onValuesChange` to AppForm for auto-save; call `clearDraft` + set `submitSuccess` in `handleSuccess`.

**`EditorLocationList.svelte`**:
- Migrate all `getPending`/`addPending`/`removePending` calls to namespace form.
- Add `pendingNewLocations` derived; render "Pending additions" section.

### Backend affected

**`github.ts`**:
- Rename `createLocationPR` → `createFilePR(filePath, content, teamName, env)`.
- Deterministic branch: `editor/{slugify(teamName)}/{slugify(filePath)}`.
- Idempotent flow: check if branch exists → reuse or create; get file SHA on branch; update file; find open PR or create one.

**`editorRoutes.ts`**:
- Compute `filePath = locationFilePath(project, city, filename)`.
- Pass `filePath` and `authPayload.teamName` to `createFilePR`.

**`editorStorage.ts`**:
- Change `project, city` params → `namespace: string` on existing helpers.
- Add `getDraft`, `saveDraft`, `clearDraft`.

## Data flow

```
User types in form
  → AppForm onValuesChange fires
  → EditorLocationForm saveDraft(key, values) → localStorage

User submits
  → AppForm validates + calls onSubmit
  → EditorLocationForm.handleSubmit resolves filename correctly
  → POST /editor/location (with filePath derived server-side)
  → github.createFilePR: deterministic branch → idempotent commit → find/create PR
  → Response: { ok: true, prUrl }
  → addPending(namespace, { filename, prUrl, ... }) → localStorage
  → AppForm calls onSuccess
  → EditorLocationForm.handleSuccess: clearDraft + submitSuccess = true
  → User sees compact success screen with PR link
  → Clicks "Back to list"
  → EditorLocationList: syncPending reads localStorage
  → Existing location: shows "⏳ Pending edit — view PR"
  → New location: appears in "Pending additions" section
```

## Verification

1. **Filename bug:** Edit an existing location → submit → list shows PR badge on the correct row.
2. **Idempotent PR:** Edit the same location twice → second submit adds a commit to the existing PR, not a new one.
3. **No changes:** Open edit form without changing anything → submit shows "No changes", is disabled → change a field → button becomes active.
4. **New location flow:** Submit new location → compact success with PR link → "Back to list" → appears in "Pending additions" with PR link.
5. **Draft restore:** Edit form, type values, disable network (DevTools), navigate away → reopen form → values restored from draft.
6. `npm run lint` and full test suite pass with no regressions.
