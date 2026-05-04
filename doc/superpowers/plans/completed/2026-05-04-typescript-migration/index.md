# TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the entire codebase from JavaScript/JSX to TypeScript/TSX, replacing PropTypes with type interfaces.

**Architecture:** Gradual file-by-file migration using `allowJs: true` so the project builds at every step. Shared type definitions in `src/types/` flow outward to worker files → hooks → contexts → components → pages. Worker files reference `@cloudflare/workers-types` for runtime globals.

**Tech Stack:** TypeScript 5.x, `@cloudflare/workers-types`, existing Vite 8 + React 19 + Vitest stack.

---

## File Changes Overview

**Created:**
- `tsconfig.json`
- `src/types/yaml.d.ts`
- `src/types/data.ts`
- `src/types/theme.ts`
- `src/types/auth.ts`
- `src/types/worker.ts`

**Converted (.js → .ts):**
- `src/worker/utils.js`
- `src/worker/auth.js`
- `src/worker/github.js`
- `src/worker/routes/authRoutes.js`
- `src/worker/routes/uploadRoute.js`
- `src/worker/routes/formSubmitRoute.js`
- `src/worker/routes/editorRoutes.js`
- `src/worker.js`
- `src/theme/themes.js`
- `src/assets/AssetManager.js`
- `src/hooks/useCssVars.js`
- `src/hooks/useText.js`
- `src/hooks/useLocations.js`
- `src/pages/editor/editorStorage.js`

**Converted (.jsx → .tsx):**
- `src/i18n/LanguageContext.jsx`
- `src/theme/ThemeContext.jsx`
- `src/theme/TitleBarContext.jsx`
- `src/theme/FontSizeContext.jsx`
- `src/auth/AuthContext.jsx`
- `src/auth/AdminRoute.jsx`
- `src/auth/ProtectedRoute.jsx`
- `src/components/MarkdownText.jsx`
- `src/components/CitySelector.jsx`
- `src/components/RouteSelector.jsx`
- `src/components/ChallengeForm.jsx`
- `src/components/ChallengeCard.jsx`
- `src/components/TitleBar.jsx`
- `src/pages/AppPage.jsx`
- `src/pages/LoginPage.jsx`
- `src/pages/ProjectPage.jsx`
- `src/pages/CityPage.jsx`
- `src/pages/RoutePage.jsx`
- `src/pages/editor/EditorLoginPage.jsx`
- `src/pages/editor/EditorPage.jsx`
- `src/pages/editor/EditorLocationList.jsx`
- `src/pages/editor/EditorLocationForm.jsx`
- `src/App.jsx`
- `src/main.jsx`

**Test files (.js/.jsx → .ts/.tsx):**
- `src/test/setup.js`
- All 12 `src/test/*.test.{js,jsx}` files

**Modified:**
- `package.json` (add `typecheck` script, remove `prop-types` dependency)
- `eslint.config.js` (point TypeScript parser at `tsconfig.json`)
- `vite.config.js` → `vite.config.ts`
- `CLAUDE.md` (update language conventions)

---

## Import Convention

Use **extension-free relative imports** throughout, matching the existing codebase:

```typescript
// Correct — matches existing style
import { useTheme } from "../theme/ThemeContext";
import type { Location } from "../types/data";

// Avoid — explicit extensions are unnecessary with moduleResolution: Bundler
import { useTheme } from "../theme/ThemeContext.tsx";
```

TypeScript's `moduleResolution: "Bundler"` resolves `.ts`, `.tsx`, `.js`, and `.jsx` without needing explicit extensions. YAML imports still need `.yaml`.

---

## Tasks

1. [task-01-infrastructure.md](task-01-infrastructure.md) — Install TypeScript, create tsconfig.json, YAML module declaration
2. [task-02-shared-types.md](task-02-shared-types.md) — Create type definitions in `src/types/`
3. [task-03-worker-files.md](task-03-worker-files.md) — Convert `src/worker/` to TypeScript
4. [task-04-hooks-utilities.md](task-04-hooks-utilities.md) — Convert hooks, themes, AssetManager, editorStorage
5. [task-05-contexts.md](task-05-contexts.md) — Convert contexts and auth guards to TSX
6. [task-06-components.md](task-06-components.md) — Convert all components to TSX
7. [task-07-pages.md](task-07-pages.md) — Convert all pages to TSX
8. [task-08-root-files.md](task-08-root-files.md) — Convert `App.jsx` and `main.jsx`
9. [task-09-tests.md](task-09-tests.md) — Convert test files to TS/TSX
10. [task-10-cleanup.md](task-10-cleanup.md) — `vite.config.ts`, remove `prop-types`, update `CLAUDE.md`
