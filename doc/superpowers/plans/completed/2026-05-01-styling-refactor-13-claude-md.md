# Task 13 — CLAUDE.md: update coding conventions

**Depends on:** All previous tasks (this is the docs-update at the end)
**Next:** [Task 14 — architecture.md](2026-05-01-styling-refactor-14-architecture-md.md)

**Files:**

- Modify: `.claude/CLAUDE.md`

---

- [ ] **Step 1: Update the Coding Conventions section in `.claude/CLAUDE.md`**

Find the **Coding Conventions** section. Replace these two bullets:

```
- **Inline styles** — all styling via JS style objects on elements. No CSS modules, no Tailwind, no external stylesheets
- **Global resets** — each page component injects a `<style>` tag for `html, body, #root` resets at the top of its return. Follow this pattern for new pages
```

With:

```
- **CSS custom properties** — all styling via co-located `.css` files imported into each component/page. Use CSS `var(--color-*)` tokens for all colours. No CSS modules, no Tailwind.
- **Global resets and keyframes** — live in `src/styles/global.css`, imported once in `App.jsx`. Do not inject `<style>` reset tags in page components.
- **Inline styles** — permitted only for truly dynamic values that cannot be expressed as a static CSS rule (e.g. computed pixel offsets, `width` percentage driven by runtime state, per-record colour values from data). Theme colours are not dynamic — always use CSS custom properties.
- **Token sync** — `src/hooks/useCssVars.js` syncs the JS theme object to `--color-*` CSS custom properties on `<html>` on every theme change. Called once inside `ThemeBodySync` in `App.jsx`.
- **New components** — create a co-located `ComponentName.css` file. Use BEM-like class names (`component-name__element--modifier`). Import the CSS file at the top of the JSX file.
```

- [ ] **Step 2: Run the test suite to confirm no accidental file changes**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```
git add .claude/CLAUDE.md
git commit -m "docs: update CLAUDE.md coding conventions for CSS custom property styling"
```
