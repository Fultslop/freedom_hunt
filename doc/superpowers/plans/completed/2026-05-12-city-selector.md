# City Selector in Editor Location List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a city `<select>` dropdown to the `EditorLocationList` toolbar so organizers can switch between project cities, and fix `EditorPage` to navigate to the last-used city instead of hardcoding `den_haag`.

**Architecture:** `EditorLocationList` loads the city list via `loadText<CitiesText>` inside the existing `$effect`. The effect also reads `params.city` explicitly (ensuring it re-fires on city change), writes the current city to `localStorage`, and resets `selectedCity` state. On dropdown change, `handleCityChange` saves the new city to `localStorage` and navigates to the new URL. `EditorPage` reads the same key at click time instead of hardcoding.

**Tech Stack:** Svelte 5 runes, svelte-spa-router `push`, `loadText` utility (Vite `import.meta.glob`), Vitest + @testing-library/svelte

**Spec:** `doc/superpowers/specs/2026-05-12-city-selector-design.md`

---

## Tasks

| # | Files | What it does |
|---|-------|--------------|
| [01](2026-05-12-city-selector-01-dropdown.md) | `EditorLocationList.svelte`, `EditorLocationList.css`, `src/test/EditorLocationList.test.ts` | City dropdown in toolbar — renders, navigates, persists |
| [02](2026-05-12-city-selector-02-editor-page.md) | `EditorPage.svelte`, `src/test/EditorPage.test.ts` | Fix hardcoded `den_haag` — read last city from localStorage |
