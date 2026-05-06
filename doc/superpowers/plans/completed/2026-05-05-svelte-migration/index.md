# Svelte Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the freedom_hunt frontend from React 19 to Svelte 5, replacing all React contexts, hooks, and JSX with Svelte stores, runes, and `.svelte` files — leaving the worker backend entirely untouched.

**Architecture:** Svelte 5 with `svelte-spa-router` for hash-based routing. React contexts become Svelte `writable` stores. Components are rewritten using runes (`$state`, `$derived`, `$effect`, `$props`). Data-loading React hooks become plain async utility functions.

**Tech stack:** Svelte 5, `@sveltejs/vite-plugin-svelte`, `svelte-spa-router`, `lucide-svelte`, `@testing-library/svelte`, Vitest, Vite 8, TypeScript, Cloudflare Workers.

---

## Spec

`doc/superpowers/specs/2026-05-05-svelte-migration-design.md`

---

## Task index

| # | Task | Files |
|---|------|-------|
| 01 | [Infrastructure](task-01-infrastructure.md) | `package.json`, `vite.config.ts`, `tsconfig.json`, `svelte.config.js`, `eslint.config.js` |
| 02 | [Stores + utilities](task-02-stores-and-utilities.md) | `src/stores/*.ts`, `src/utils/loadText.ts`, `src/utils/loadLocations.ts` |
| 03 | [App shell](task-03-app-shell.md) | `src/App.svelte`, `src/main.ts` |
| 04 | [Leaf components](task-04-leaf-components.md) | `MarkdownText.svelte`, `CitySelector.svelte`, `RouteSelector.svelte` |
| 05 | [Complex components](task-05-complex-components.md) | `src/actions/swipe.ts`, `src/actions/leafletMap.ts`, `ChallengeForm.svelte`, `ChallengeCard.svelte`, `TitleBar.svelte` |
| 06 | [Auth route guards](task-06-auth-guards.md) | `App.svelte` (add `wrap()` guards) |
| 07 | [Hunt pages](task-07-hunt-pages.md) | `AppPage.svelte`, `LoginPage.svelte`, `ProjectPage.svelte`, `CityPage.svelte`, `RoutePage.svelte` |
| 08 | [Editor pages](task-08-editor-pages.md) | `EditorLoginPage.svelte`, `EditorPage.svelte`, `EditorLocationList.svelte`, `EditorLocationForm.svelte` |
| 09 | [Cutover](task-09-cutover.md) | Delete React files, update docs, deploy preview, merge |

---

## What is NOT changing

- `src/worker.ts` and all of `src/worker/` — zero changes
- `src/data/` — YAML files and images unchanged
- `src/styles/` — CSS tokens and global styles unchanged
- `src/types/` — TypeScript type definitions unchanged
- `src/test/worker*.test.ts` — worker tests are React-agnostic, run as-is
- `src/theme/themes.ts` — theme presets unchanged
- `src/assets/AssetManager.ts` — image fetch utility unchanged

---

## Key patterns reference

### Runes (Svelte 5)
```svelte
<script lang="ts">
  let { title, onSubmit } = $props()          // props
  let count = $state(0)                        // reactive state
  let double = $derived(count * 2)             // computed
  $effect(() => { document.title = title })    // side effect
</script>
```

### Store auto-subscribe in templates
```svelte
<script lang="ts">
  import { themeStore } from '../stores/themeStore'
</script>
<!-- $themeStore auto-subscribes; no onDestroy needed -->
<p style="color: {$themeStore.theme.text}">{$themeStore.themeName}</p>
```

### svelte-spa-router navigation
```typescript
import { push, replace } from 'svelte-spa-router'
push('/some/path')      // adds to history
replace('/some/path')   // replaces current entry
```

### Route params
```svelte
<script lang="ts">
  let { params } = $props<{ params: { project: string; city: string } }>()
</script>
```
