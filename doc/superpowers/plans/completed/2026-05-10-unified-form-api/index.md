# Unified Form System + API Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace duplicated form components and scattered fetch calls with a single generic `AppForm.svelte` component backed by YAML field definitions, and a unified `src/utils/api.ts` module covering all client HTTP calls.

**Architecture:** `AppForm.svelte` renders all field types (including new `textarea` and `section` pseudo-type) from a `FormField[]` prop and calls an `onSubmit` callback with nested values. `ChallengeForm` becomes a thin wrapper adding challenge chrome. `EditorLocationForm` loads its field definitions from YAML and is fully data-driven. All `fetch()` calls move to `src/utils/api.ts`.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vite/YAML plugin, Vitest + @testing-library/svelte

---

## Task Overview

| # | Task file | What it does |
|---|-----------|-------------|
| 01 | [task-01-types.md](task-01-types.md) | Extend `FormField` types (`textarea`, `section`) |
| 02 | [task-02-api.md](task-02-api.md) | Create `src/utils/api.ts` — all client HTTP functions |
| 03 | [task-03-form-values.md](task-03-form-values.md) | Create `src/utils/formValues.ts` — dotted-path utilities |
| 04 | [task-04-app-form.md](task-04-app-form.md) | Create `AppForm.svelte` + `AppForm.css` |
| 05 | [task-05-challenge-form.md](task-05-challenge-form.md) | Refactor `ChallengeForm` to thin wrapper around AppForm |
| 06 | [task-06-editor-yaml.md](task-06-editor-yaml.md) | Create `src/data/text/en/editor/location_form.yaml` |
| 07 | [task-07-editor-location-form.md](task-07-editor-location-form.md) | Refactor `EditorLocationForm` to data-driven wrapper |
| 08 | [task-08-editor-location-list.md](task-08-editor-location-list.md) | Refactor `EditorLocationList` to use api.ts |
| 09 | [task-09-auth-callers.md](task-09-auth-callers.md) | Refactor `authStore`, `LoginPage`, `EditorLoginPage` |
| 10 | [task-10-api-tests.md](task-10-api-tests.md) | Add `src/test/api.test.ts` |
| 11 | [task-11-app-form-tests.md](task-11-app-form-tests.md) | Add `src/test/AppForm.test.ts` |
| 12 | [task-12-update-existing-tests.md](task-12-update-existing-tests.md) | Update existing component tests |
| 13 | [task-13-architecture-doc.md](task-13-architecture-doc.md) | Update `doc/architecture.md` |

## Execution Order

Tasks 01–03 must be done first (types and utilities that everything else depends on).
Tasks 04–09 can proceed in order once 01–03 are complete.
Tasks 10–12 depend on 04–09.
Task 13 is last.

## Verification (run after all tasks)

```
npm run lint
npm test
npm run build
```

Manual: player login → challenge form fill → confirm → submit
Manual: editor login → add new location → submit for review
