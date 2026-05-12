# Image Picker Dialog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text image filename input in the editor location form with a modal grid dialog that lets users pick from available images visually.

**Architecture:** A new `"image-picker"` `FormFieldType` drives a new rendering branch in `AppForm.svelte`. Image discovery uses Vite's `import.meta.glob` over `src/data/img/*` (filtered by extension) via a new `src/utils/images.ts` utility. The picker dialog is a standalone `ImagePickerDialog.svelte` component rendered via the existing `portal` action. The stored value remains a plain filename string.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vite `import.meta.glob`, `@testing-library/svelte`

---

## Files

| Action | File |
|--------|------|
| Modify | `src/types/data.ts` |
| Create | `src/utils/images.ts` |
| Create | `src/test/images.test.ts` |
| Create | `src/components/ImagePickerDialog.svelte` |
| Create | `src/components/ImagePickerDialog.css` |
| Create | `src/test/ImagePickerDialog.test.ts` |
| Modify | `src/components/AppForm.svelte` |
| Modify | `src/components/AppForm.css` |
| Modify | `src/test/AppForm.test.ts` |
| Modify | `src/data/text/en/editor/location_form.yaml` |

---

## Tasks

- [Task 01](2026-05-12-image-picker-01-types-utils.md) — Types + image discovery utility
- [Task 02](2026-05-12-image-picker-02-dialog.md) — ImagePickerDialog component
- [Task 03](2026-05-12-image-picker-03-appform.md) — AppForm integration
- [Task 04](2026-05-12-image-picker-04-yaml.md) — YAML wiring
