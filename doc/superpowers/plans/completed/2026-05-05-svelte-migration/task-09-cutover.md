# Task 09 — Cutover

**Files:**
- Delete: all remaining React source files (`.tsx`, React hooks, old context files)
- Modify: `doc/architecture.md`
- Modify: `.claude/CLAUDE.md`
- Modify: `doc/devlog/_devlog.md`

This task cleans up the React files, verifies the full test suite, deploys to a Cloudflare preview URL for smoke testing, and merges to main.

---

## Cleanup

- [ ] **Step 1: Delete all React source files**

```bash
# Pages
rm src/pages/AppPage.tsx src/pages/LoginPage.tsx src/pages/ProjectPage.tsx
rm src/pages/CityPage.tsx src/pages/RoutePage.tsx
rm src/pages/editor/EditorLoginPage.tsx src/pages/editor/EditorPage.tsx
rm src/pages/editor/EditorLocationList.tsx src/pages/editor/EditorLocationForm.tsx

# Components
rm src/components/ChallengeCard.tsx src/components/ChallengeForm.tsx
rm src/components/CitySelector.tsx src/components/RouteSelector.tsx
rm src/components/MarkdownText.tsx src/components/TitleBar.tsx

# Contexts and old React infrastructure
rm src/App.tsx src/main.tsx
rm src/theme/ThemeContext.tsx src/theme/FontSizeContext.tsx src/theme/TitleBarContext.tsx
rm src/i18n/LanguageContext.tsx
rm src/auth/AuthContext.tsx src/auth/ProtectedRoute.tsx src/auth/AdminRoute.tsx
rm src/hooks/useCssVars.ts src/hooks/useText.ts src/hooks/useLocations.ts

# Old React tests (replaced in Tasks 04–08)
rm src/test/ThemeContext.test.tsx src/test/TitleBarContext.test.tsx
rm src/test/LanguageContext.test.tsx src/test/AuthContext.test.tsx
rm src/test/ChallengeCard.test.tsx src/test/ChallengeForm.test.tsx
rm src/test/TitleBar.test.tsx src/test/LoginPage.test.tsx
rm src/test/useLocations.test.tsx src/test/useText.test.tsx
rm src/test/RoutePage.test.tsx
```

**Note:** `src/test/RoutePage.swipe.test.ts` and `src/test/worker*.test.ts` are kept — they have no React dependencies.

- [ ] **Step 2: Remove empty directories if applicable**

```bash
# Only if empty after step 1:
# rmdir src/auth (if ProtectedRoute/AdminRoute were the only files)
# rmdir src/hooks
# rmdir src/theme (keep if themes.ts is still there)
```

Keep `src/theme/themes.ts` and `src/types/` — these are still used.

- [ ] **Step 3: Run the full test suite**

```bash
npm run test:run
```

Expected output: all Svelte component/page tests pass; all three worker test files pass; 0 React tests remain. If any tests fail, fix them before proceeding.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors from both `tsc` and `svelte-check`.

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 6: Build**

```bash
npm run build
```

Expected: build succeeds with no errors.

---

## Smoke test

- [ ] **Step 7: Deploy to Cloudflare preview**

```bash
npm run deploy
```

Note the preview URL from the wrangler output (format: `https://<hash>.freedom-hunt.workers.dev`).

If you have a named preview environment configured, use:
```bash
wrangler deploy --env preview
```

- [ ] **Step 8: Smoke test — hunt app**

Open the preview URL in a mobile browser (or Chrome DevTools mobile emulation). Walk through each route:

| Route | Expected |
|---|---|
| `#/` | Project list renders with Democrats Abroad |
| `#/login/democrats_abroad` | Login form renders, can submit |
| `#/democrats_abroad` | Redirects to login if not authenticated |
| After login → `#/democrats_abroad` | City list renders with Den Haag |
| `#/democrats_abroad/den_haag` | Route selector renders |
| `#/democrats_abroad/den_haag/short_loop` | Challenge cards render, swipe works, map renders |

- [ ] **Step 9: Smoke test — theme and font size**

On any page, open the ☰ menu:
- Switch theme: page re-skins immediately
- Switch font size: text resizes immediately
- Theme persists on reload

- [ ] **Step 10: Smoke test — editor**

| Route | Expected |
|---|---|
| `#/editor` | Redirects to `#/` if not admin |
| `#/editor/login` | Password form renders |
| After admin login → `#/editor` | Project list with "Manage locations" button |
| `#/editor/locations/democrats_abroad/den_haag` | Location list renders |
| Click Edit on a location | YAML editor renders with content |

- [ ] **Step 11: Smoke test — deep links**

Copy these URLs and open them in a fresh browser tab (simulating an organizer sharing a link):
- `https://<preview-url>/#/democrats_abroad` — should land on city picker (after login)
- `https://<preview-url>/#/democrats_abroad/den_haag` — should land on route picker

Expected: both URLs resolve correctly after login.

---

## Documentation update

- [ ] **Step 12: Update `doc/architecture.md`** — update the tech stack table

Replace the Framework/Routing/Language/Testing rows:

```markdown
| Framework    | Svelte 5                                                                      |
| Build tool   | Vite 8                                                                        |
| Routing      | svelte-spa-router (hash-based)                                                |
| Language     | TypeScript (`.ts` + `.svelte`)                                                |
| Styling      | Co-located `.css` files + CSS custom properties (no CSS modules, no Tailwind) |
| Testing      | Vitest + @testing-library/svelte                                              |
```

Also update the file structure section to replace `.jsx` and `.tsx` references with `.svelte` and `.ts`, and update the context section to describe Svelte stores.

- [ ] **Step 13: Update `.claude/CLAUDE.md`** — coding conventions section

Update to reflect Svelte:
- Replace "TypeScript only — all source files use `.ts` or `.tsx`" with "TypeScript only — components use `.svelte` with `<script lang="ts">`, utilities use `.ts`"
- Replace "define props as inline interface" with "define props via `$props()` rune"
- Add: "Reactivity uses Svelte 5 runes: `$state`, `$derived`, `$effect`, `$props`. Do not use Svelte 4 `$:` reactive statements."
- Update context/hook references to store references

- [ ] **Step 14: Update devlog**

Add entry at the top of `doc/devlog/_devlog.md`:

```
**DD/MM/YYYY, Claude**: [FEAT] Migrate frontend from React 19 to Svelte 5.

- Replaced React contexts with Svelte writable stores; replaced hooks with $state/$derived/$effect runes
- Replaced React Router v7 with svelte-spa-router (hash-based routing; all existing links remain shareable)
- Implemented Leaflet map as a use:leafletMap action; swipe gesture as use:swipe action
- Worker backend (worker.ts, auth, GitHub, R2) untouched throughout
- All 3 worker test files pass; component/page test suite rewritten with @testing-library/svelte
```

- [ ] **Step 15: Final commit**

```bash
git add -A
git commit -m "chore: complete React → Svelte 5 migration; delete all React source files"
```

- [ ] **Step 16: Merge to main**

Create PR or merge directly, per your team process. The migration branch is now production-ready.
