# Coordinate Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two manual lat/lng number inputs in the editor form with an inline `CoordinatePicker` component that shows a clickable Leaflet map and pre-fills coordinates from the selected city.

**Architecture:** A new `coord-picker` FormFieldType is added throughout the system — in the TypeScript types, the YAML field definition, and `AppForm`'s renderer. The `leafletMap` Svelte action is extended with optional `onClick` and `scrollWheelZoom` params. `CoordinatePicker` wraps two number inputs and a clickable Leaflet map into a single compound field. `EditorLocationForm` loads city coordinates from `cities.yaml` and uses them as initial values for new locations.

**Tech Stack:** Svelte 5 (runes), TypeScript, Leaflet via `use:leafletMap` action, Vitest + @testing-library/svelte

---

## Tasks

| # | File | Description |
|---|------|-------------|
| [01](./01-types-and-yaml.md) | `src/types/data.ts`, `location_form.yaml` | Add `coord-picker` type and `City.coordinates` |
| [02](./02-leaflet-map-action.md) | `src/actions/leafletMap.ts` | Add `scrollWheelZoom` and `onClick` params |
| [03](./03-coordinate-picker-component.md) | `src/components/CoordinatePicker.svelte` + `.css`, `src/test/CoordinatePicker.test.ts` | New compound field component (TDD) |
| [04](./04-appform-changes.md) | `src/components/AppForm.svelte`, `src/test/AppForm.test.ts` | Wire `coord-picker` into the form renderer (TDD) |
| [05](./05-editor-location-form-changes.md) | `src/pages/editor/EditorLocationForm.svelte`, `src/test/EditorLocationForm.test.ts` | City defaults, initialValues reconstruction, handleSubmit (TDD) |

**Dependency order:** 01 → 02 → 03 → 04 → 05
