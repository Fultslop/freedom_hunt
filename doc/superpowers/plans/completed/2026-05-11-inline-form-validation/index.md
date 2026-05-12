# Inline Form Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce that `*_loc_*.yaml` challenge forms are always referenced by filename (never inline arrays) via three complementary validation layers, then migrate Oslo's 7 inline forms.

**Architecture:** Layer 1 adds a JSON Schema + VS Code wiring so the IDE flags inline forms immediately. Layer 2 adds a runtime sentinel in `loadLocations.ts` that replaces any inline array with an unknown-type field, which `AppForm.svelte` renders as "unrecognized field '…'". Layer 3 adds a Node.js validate script wired to `npm run validate:yaml` and the CI pipeline.

**Tech Stack:** Svelte 5, TypeScript, Vite, Vitest + @testing-library/svelte, js-yaml, GitHub Actions

---

## Tasks

| # | File | Description |
|---|------|-------------|
| [01](task-01-yaml-schema.md) | `src/data/schemas/location.schema.json`, `.vscode/settings.json` | JSON Schema + VS Code wiring |
| [02](task-02-load-locations-sentinel.md) | `src/utils/loadLocations.ts`, `src/test/loadText.test.ts` | Inline array → sentinel field |
| [03](task-03-appform-unknown-type.md) | `src/components/AppForm.svelte`, `AppForm.css`, `src/test/AppForm.test.ts` | Unknown-type rendering |
| [04](task-04-validate-script.md) | `scripts/validate-yaml.js`, `package.json`, `.github/workflows/ci.yml` | Build validate script + CI |
| [05](task-05-oslo-migration.md) | `oslo/*_form_*.yaml` (×7), `oslo/*_loc_*.yaml` (×7) | Oslo data migration |

## Execution order

Tasks 01–04 can be run in any order (no shared state). Task 05 depends on all
of 01–04 being in place — it triggers all three validation layers, then clears them.
