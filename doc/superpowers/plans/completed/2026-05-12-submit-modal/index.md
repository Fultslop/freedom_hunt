# Submit Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the in-form submit UX with a modal overlay that shows live submission status (submitting → success / failed), writes a richer `status` field to localStorage so the location list reflects in-flight and failed submissions, and provides retry paths from both the modal and the list.

**Architecture:** Four tasks in dependency order — storage helpers first (all tasks depend on them), then the modal component and list badge refactor in parallel, then the form wiring that combines both. `AppForm.svelte` is untouched. The modal is a new portal-rendered component in `src/pages/editor/`. All localStorage writes go through the unified `prWasClosed` helper so draft-clearing is never forgotten.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest, @testing-library/svelte/svelte5.

**Spec:** `doc/superpowers/specs/2026-05-12-submit-modal-design.md`

---

## File map

| File | Task | Change |
|---|---|---|
| `src/pages/editor/editorStorage.ts` | 01 | Add `status`, `isNew` to `PendingEntry`; add `updatePendingStatus`, `prWasClosed`, `clearCompletedPending` |
| `src/test/editorStorage.test.ts` | 01 | Tests for new helpers |
| `src/pages/editor/SubmitModal.svelte` | 02 | **New** — portal modal, three states |
| `src/pages/editor/SubmitModal.css` | 02 | **New** — modal styles |
| `src/test/SubmitModal.test.ts` | 02 | **New** — tests for all three states |
| `src/pages/editor/EditorLocationForm.svelte` | 03 | Modal state wiring, timeout, retry; remove old success screen |
| `src/test/EditorLocationForm.test.ts` | 03 | Update success test; add failure and retry tests |
| `src/pages/editor/EditorLocationList.svelte` | 04 | Badge variants, stale resolution, Clear completed, prWasClosed migration |
| `src/pages/editor/EditorLocationList.css` | 04 | Badge modifier classes |
| `src/test/EditorLocationList.test.ts` | 04 | Badge and retry tests |

## Tasks

- [Task 01](task-01-storage-helpers.md) — editorStorage: status field + new helpers
- [Task 02](task-02-submit-modal.md) — SubmitModal component
- [Task 03](task-03-form-wiring.md) — EditorLocationForm: wire modal, timeout, retry
- [Task 04](task-04-list-badges.md) — EditorLocationList: badge variants + stale handling

## Execution order

Task 01 must complete before all others.
Tasks 02 and 04 are independent of each other — run in parallel after Task 01.
Task 03 depends on Task 01 and Task 02.

## Verification (after all tasks)

```
npm run lint
npx vitest run --reporter=verbose
```

Then manually verify in the running app (`npm run dev`):
1. Fill a form → Submit → modal shows "Submitting…" with PR subtext
2. Submit succeeds → modal updates to "✓ Form submitted for review" with PR link
3. Click "Back to location list" → list shows ⏳ Pending badge
4. Simulate failure (DevTools → block the worker URL) → modal shows "✕ Submission failed" with copyable error
5. Click Retry → modal resets to "Submitting…" and re-tries
6. Navigate away during submission (click "Back to list") → list shows "⏱ Submitting…" → Refresh → resolves to Pending or Failed
7. Edit a location with a merged PR → list shows "✓ Up to date" badge
8. "Clear completed" button removes Up to date badges
