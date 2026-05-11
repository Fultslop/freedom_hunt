# Editor PR Workflow — Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four production gaps in the location editor (filename bug, duplicate PRs, no-change submit, missing localStorage badge) and add draft auto-save for network resilience.

**Architecture:** Targeted patches to six existing files plus a new `editorStorage.test.ts`. Backend gets a renamed, re-parameterised `createFilePR` with idempotent branch logic. Frontend gets `hasChanges` + draft plumbing in `AppForm` and `EditorLocationForm`, namespace-keyed storage, and a "Pending additions" section in the list.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest, @testing-library/svelte/svelte5, Cloudflare Workers, GitHub REST API v3.

**Spec:** `doc/superpowers/specs/2026-05-11-editor-pr-workflow-design.md`

---

## File Map

| File | Task | What changes |
|------|------|-------------|
| `src/pages/editor/EditorLocationForm.svelte` | 01, 05 | Fix filename; draft load/save/clear; compact success |
| `src/worker/github.ts` | 02 | Rename → `createFilePR`; idempotent branch; find-or-create PR; export `slugify` |
| `src/worker/routes/editorRoutes.ts` | 02 | Pass `filePath` + `teamName` to `createFilePR` |
| `src/components/AppForm.svelte` | 03 | Add `hasChanges`, `baseValues`, `onValuesChange` props |
| `src/pages/editor/editorStorage.ts` | 04 | Namespace refactor on existing helpers; add draft helpers |
| `src/pages/editor/EditorLocationList.svelte` | 04, 06 | Update callers to namespace; pending additions section |
| `src/pages/editor/EditorLocationList.css` | 06 | `.loc-list__section-heading`, `.loc-list__item--pending` |
| `src/test/EditorLocationForm.test.ts` | 01, 05 | New tests for filename fix and draft behaviour |
| `src/test/worker.github.test.ts` | 02 | Tests for `slugify` and `createFilePR` |
| `src/test/AppForm.test.ts` | 03 | Tests for `hasChanges`, `baseValues`, `onValuesChange` |
| `src/test/editorStorage.test.ts` | 04 | New file — tests for namespace helpers and draft helpers |
| `src/test/EditorLocationList.test.ts` | 06 | Test for pending additions section |

## Tasks

- [Task 01](task-01-fix-filename-bug.md) — Fix filename resolution bug
- [Task 02](task-02-idempotent-pr.md) — Idempotent PR creation (`createFilePR`)
- [Task 03](task-03-appform-has-changes.md) — AppForm: `hasChanges`, `baseValues`, `onValuesChange`
- [Task 04](task-04-storage-namespace.md) — Storage namespace refactor + draft helpers
- [Task 05](task-05-draft-save.md) — EditorLocationForm: draft save + compact success
- [Task 06](task-06-pending-additions.md) — EditorLocationList: pending additions section

## Execution order

Tasks 01, 02, 03 are independent — run in any order or in parallel.
Task 04 must complete before Task 05 (Task 05 uses the new draft helpers).
Task 05 must complete before Task 06 (Task 06 uses the namespace from Task 04, and the list display depends on Task 05's `addPending` call having the correct filename from Task 01).

## Verification (run after all tasks)

```
npm run lint
npm run test -- --reporter=verbose
```

Then manually verify in the running app (`npm run dev`):
1. Edit a location → submit → list shows PR badge on the correct row.
2. Edit the same location again → second submit adds a commit to the existing PR, not a new PR.
3. Open an edit form without changing anything → submit button shows "No changes" and is disabled.
4. Make a change → button becomes enabled.
5. Submit a new location → compact success screen with PR link → "Back to list" → appears in "Pending additions".
6. Start editing, type values, disable network (DevTools → Network → Offline), navigate away → re-enable network → reopen form → values restored.
