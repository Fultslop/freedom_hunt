# Task 14 — architecture.md: update styling documentation

**Depends on:** [Task 13 — CLAUDE.md](2026-05-01-styling-refactor-13-claude-md.md)

**Files:**
- Modify: `doc/architecture.md`

---

- [ ] **Step 1: Update the Tech Stack table in `doc/architecture.md`**

Find the Styling row:

```
| Styling | Inline styles throughout (no CSS modules, no Tailwind) |
```

Replace with:

```
| Styling | Co-located `.css` files + CSS custom properties (no CSS modules, no Tailwind) |
```

- [ ] **Step 2: Update the Key Design Decisions section**

Find this paragraph:

```
**Inline styles throughout.** No CSS modules, no Tailwind. Styles are co-located as JS objects. Each page component injects a `<style>` tag for `html, body, #root` resets — follow this pattern for new pages.
```

Replace with:

```
**CSS custom properties for theming.** No CSS modules, no Tailwind. Each component and page has a co-located `.css` file. Colours are expressed as `var(--color-*)` CSS custom properties. The token set is defined in `src/styles/tokens.css` and synced at runtime by `src/hooks/useCssVars.js`, which writes the active JS theme object onto `<html>` as CSS custom properties on every theme change. Global resets and `@keyframes` live in `src/styles/global.css`. Inline styles are reserved for values that are unavoidably dynamic (computed pixel offsets, runtime-state-driven widths, per-record colour values from data).
```

- [ ] **Step 3: Run the test suite**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```
git add doc/architecture.md
git commit -m "docs: update architecture.md to reflect CSS custom property styling approach"
```
