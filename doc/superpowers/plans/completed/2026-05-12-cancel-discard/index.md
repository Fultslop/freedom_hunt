# Cancel Discard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user presses Cancel in EditorLocationForm, confirm with a dialog and discard the localStorage draft; show the file's display name and a dirty asterisk in the title bar.

**Architecture:** Extend `TitleBarState` with `subtitle`/`isDirty`; `TitleBar.svelte` renders a subtitle line with optional `*`. `AppForm` gains an `onHasChangesChange` callback that fires whenever `hasChanges` flips. `EditorLocationForm` uses that callback to track `isDirty`, syncs it into the store, computes the subtitle from the parsed filename, and rewires the Cancel button to confirm + clear draft.

**Tech Stack:** Svelte 5 runes (`$state`, `$derived`, `$effect`), `svelte/store` writable, `svelte-spa-router` `push`, Vitest + @testing-library/svelte

---

## File Map

| File | Change |
|------|--------|
| `src/stores/titleBarStore.ts` | Add `subtitle?: string` and `isDirty?: boolean` to `TitleBarState` |
| `src/components/TitleBar.svelte` | Wrap title in `titlebar__title-wrap` div; render subtitle span |
| `src/components/TitleBar.css` | Add `.titlebar__title-wrap` and `.titlebar__subtitle` rules |
| `src/components/AppForm.svelte` | Add `onHasChangesChange` prop + `$effect` |
| `src/pages/editor/EditorLocationForm.svelte` | Add `clearDraft` import, `isDirty` state, `getSubtitle`, handleCancel, subtitle in store effect, isDirty sync effect, wire AppForm |
| `src/test/TitleBar.test.ts` | 3 new tests: no subtitle, subtitle without `*`, subtitle with `*` |
| `src/test/AppForm.test.ts` | 2 new tests: `onHasChangesChange(true)` on change, `(false)` on restore |
| `src/test/EditorLocationForm.test.ts` | 6 new tests: subtitle "new", subtitle edit mode, cancel clean, cancel dirty (dismissed), cancel dirty (confirmed) |

---

## Tasks

- [Task 01](task-01-titlebar-subtitle.md) — TitleBar subtitle rendering
- [Task 02](task-02-appform-callback.md) — AppForm `onHasChangesChange` callback
- [Task 03](task-03-editor-form-wiring.md) — EditorLocationForm wiring (subtitle, dirty tracking, cancel)
