# Svelte Migration Design

**Date:** 2026-05-05
**Author:** Claude
**Status:** Approved

## Summary

Full rewrite of the freedom_hunt frontend from React 19 to Svelte, driven by fundamental friction with React's component model (hooks, context boilerplate, `useEffect` crutch). The worker backend is untouched. Migration proceeds on a dedicated git branch with Cloudflare preview deployments used for page-by-page smoke testing before cutover.

---

## 1. Stack Changes

**Svelte version: 5** — the current major release, using runes syntax (`$state`, `$derived`, `$effect`, `$props`). Svelte 4 syntax still compiles under Svelte 5 but is deprecated; all new code uses runes from the start.

### Removed

| Package | Replaced by |
|---|---|
| `react`, `react-dom` | `svelte` |
| `react-router-dom` v7 | `svelte-spa-router` |
| `@vitejs/plugin-react` | `@sveltejs/vite-plugin-svelte` |
| `react-leaflet` | `leaflet` directly (via Svelte `use:` action) |
| `lucide-react` | `lucide-svelte` |
| `@testing-library/react` | `@testing-library/svelte` |

### Unchanged

- `vite`, `typescript`, `vitest`
- `@cloudflare/vite-plugin`, `wrangler`
- `@modyfi/vite-plugin-yaml`
- `marked`
- `leaflet` (core library)
- `src/worker.ts` and all of `src/worker/` — zero changes

### File extensions

All `.tsx` files become `.svelte` (components/pages) or `.ts` (stores, utilities). No `.jsx` files exist post-migration.

---

## 2. Routing

`svelte-spa-router` with hash-based URLs. The four routes map directly:

| Current (React Router) | Svelte |
|---|---|
| `/` | `#/` |
| `/:project` | `#/:project` |
| `/:project/:city` | `#/:project/:city` |
| `/:project/:city/:route` | `#/:project/:city/:route` |

Hash-based URLs are fully shareable (organizers can link directly to a project or city). The `#` fragment is visible in the address bar; this is acceptable for this use case.

The router is configured as a plain route map object in `App.svelte` — no JSX, no `<Route>` components, no nested providers. Route params are passed as a `params` prop directly into each page component.

`App.svelte` replaces `App.tsx` as the app shell: mounts the router and initialises store subscriptions (CSS var syncing).

---

## 3. State Management

The five React contexts become Svelte writable stores. Any component imports and reads/writes a store directly — no Provider components, no hook rules.

| React context | Svelte store | Notes |
|---|---|---|
| `ThemeContext` | `src/stores/themeStore.ts` | Persisted to `localStorage` |
| `FontSizeContext` | `src/stores/fontSizeStore.ts` | Persisted to `localStorage` |
| `TitleBarContext` | `src/stores/titleBarStore.ts` | Pages assign directly: `$titleBar = { title, progress, backPath }` |
| `LanguageContext` | `src/stores/languageStore.ts` | Trivial for now, easy to extend |
| `AuthContext` | `src/stores/authStore.ts` | Persisted to `localStorage` |

`useCssVars.ts` is replaced by a single `themeStore.subscribe(...)` call in `App.svelte` that writes `--color-*` and `--font-family` properties onto `<html>` whenever the theme changes.

The `TitleBarContext` simplification is significant: pages currently call `setTitleBar(...)` inside a `useEffect`. In Svelte, a page assigns `$titleBar = { ... }` in its script block — no effect, no dependency array.

---

## 4. Component Idioms

Migration targets idiomatic Svelte, not a line-for-line React translation.

| React pattern | Svelte 5 equivalent |
|---|---|
| `useState(x)` | `let x = $state(x)` |
| `useMemo(() => expr, [deps])` | `let y = $derived(expr)` |
| `useEffect(() => {}, [deps])` | `$effect(() => { ... })` |
| Props destructuring | `let { title, onSubmit } = $props()` |
| Controlled inputs (`value` + `onChange`) | `bind:value` |
| `useContext(ThemeContext)` | `$themeStore` — auto-subscribes and auto-unsubscribes |
| `children` prop | `<slot />` (Svelte 5: `{@render children()}`) |
| `.map(() => <Component />)` | `{#each items as item}<Component />{/each}` |
| `condition && <Component />` | `{#if condition}<Component />{/if}` |
| `useRef` | `bind:this` |
| Custom hook (pointer events) | Svelte `use:` action |

### Specific component notes

**`ChallengeCard`** — image loading via `AssetManager` currently uses a `useEffect` + `useState` pattern. In Svelte 5: `let imageUrl = $state('')` at the top of the script block, `$effect(() => { AssetManager.fetchImage(filename).then(u => imageUrl = u) })`. No hook rules, no dependency array.

**`RoutePage` swipe gesture** — currently a custom React hook managing pointer event listeners. Becomes a `use:swipe` Svelte action: a plain function that attaches and detaches its own listeners, self-contained and reusable.

**`TitleBar`** — reads from `$titleBarStore` directly, no context consumer needed.

---

## 5. Testing

Vitest stays. `@testing-library/svelte` is a direct swap for `@testing-library/react` — `render`, `screen`, `fireEvent`, and `waitFor` work the same way.

### Test categories

**Worker tests** (`worker.test.ts`, `worker.auth.test.ts`, `worker.github.test.ts`) — **zero changes**. These test the backend directly and have no React/Svelte dependency.

**Component and page tests** (~90 tests) — rewritten with `@testing-library/svelte`. Key simplification: no Provider wrappers. A test for a component that reads `$themeStore` sets the store value before rendering — that's all.

**Context/hook tests** (`ThemeContext.test.tsx`, `TitleBarContext.test.tsx`, `useLocations.test.tsx` etc.) — replaced by store tests. Svelte stores are plain objects; testing is import + set + assert with no render cycle.

Overall coverage target: equivalent to current 132 tests.

---

## 6. Linting

Linting is established before the first component is written (step 1 of the migration sequence).

### Packages

- `eslint-plugin-svelte` — official ESLint plugin for `.svelte` files
- `svelte-eslint-parser` — required parser for `.svelte` files
- `svelte-check` — Svelte's type-checker; validates template expressions, prop types, and store usage inside `.svelte` files. Runs in CI alongside `tsc`.

### Rules

All existing TypeScript ESLint rules carry over unchanged. Svelte-specific additions:

- `svelte/require-each-key` — error (enforces keys in `{#each}` blocks)
- `svelte/no-at-html-tags` — error (XSS guard on `{@html}`). **Exception:** `MarkdownText.svelte` must use `{@html marked(content)}` to render trusted YAML content — add a single `eslint-disable-next-line` comment on that line.
- `svelte/no-unused-svelte-ignore` — error
- `svelte/no-reactive-reassign` — error

Carried-over rules (applied to `.svelte` script blocks):

```json
"complexity": ["error", 10],
"max-len": ["error", { "code": 100, "ignorePattern": "^\\s*<" }],
"@typescript-eslint/no-confusing-void-expression": ["error", { "ignoreArrowShorthand": true }],
"curly": ["error", "all"],
"brace-style": ["error", "1tbs", { "allowSingleLine": false }],
"id-length": ["error", { "min": 3, "exceptions": ["id", "to", "ok", "fs"] }],
"no-useless-return": "error",
"no-restricted-syntax": [
  "error",
  {
    "selector": "ForOfStatement > BlockStatement > IfStatement[test.operator='!'] > ReturnStatement[argument.value=false]",
    "message": "This manual guard loop can be replaced with .every() or .isSubsetOf()."
  },
  {
    "selector": "ReturnStatement[argument=null]",
    "message": "Early returns (naked returns) are disallowed. Ensure the function logic flows to the end."
  },
  {
    "selector": "BinaryExpression[operator='==='] > Literal[value=/./]",
    "message": "Don't compare against raw strings. Use a constant or Type."
  },
  {
    "selector": "BinaryExpression[operator='!=='] > Literal[value=/./]",
    "message": "Don't compare against raw strings. Use a constant or Type."
  }
]
```

`max-len` uses `ignorePattern: "^\\s*<"` to relax the 100-character limit for Svelte template lines (attribute lists and bindings can run long) while keeping it strict for all logic.

---

## 7. Migration Sequence

Work on a dedicated branch. Cloudflare preview deployments are used for smoke testing at each page milestone before the final cutover to main.

1. **Infrastructure** — swap deps; update `vite.config.ts` for `@sveltejs/vite-plugin-svelte`; update `tsconfig` for `.svelte` files; configure ESLint with `eslint-plugin-svelte` + `svelte-check` + all rules above. Confirm `npm run lint` and `npm run build` pass on an empty project before proceeding.

2. **App shell** — `App.svelte` and `main.ts` with `svelte-spa-router` wired up; pages as stubs. App loads and all four routes resolve before any real component is built.

3. **Stores** — `themeStore`, `fontSizeStore`, `titleBarStore`, `languageStore`, `authStore`. CSS var and font-family syncing via `themeStore.subscribe` in `App.svelte`.

4. **Leaf components** — `MarkdownText`, `CitySelector`, `RouteSelector`.

5. **Complex components** — `ChallengeForm`, `ChallengeCard`, `TitleBar` (including `use:swipe` action).

6. **Auth** — `AdminRoute`, `ProtectedRoute`.

7. **Hunt pages** — `AppPage` → `LoginPage` → `ProjectPage` → `CityPage` → `RoutePage`.

8. **Editor pages** — `EditorLoginPage` → `EditorPage` → `EditorLocationList` → `EditorLocationForm`.

9. **Tests** — rewrite component and page tests with `@testing-library/svelte`; confirm worker tests pass untouched; confirm overall coverage is equivalent.

10. **Smoke test + cutover** — deploy to Cloudflare preview URL; walk through each page; merge to main when satisfied.

---

## Out of Scope

- `src/worker.ts` and `src/worker/` — no changes
- YAML data files — no changes
- CSS custom properties and token system — no changes
- Cloudflare deployment configuration — no changes
