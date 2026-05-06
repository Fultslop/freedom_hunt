# Task 4: RoutePage CSS strip layout

Status: Completed

**Previous:** [Task 3 — Commit/elastic helpers](task-03-helpers.md)  
**Next:** [Task 5 — Static three-card strip](task-05-strip-render.md)

**Files:**
- Modify: `src/pages/RoutePage.css`

---

Add the strip and slot classes. The existing `.route-page__cards` class is kept for now (snap mode still uses it); it will be removed in Task 7.

- [ ] **Step 1: Add strip/slot classes to `src/pages/RoutePage.css`**

Append to the end of the existing file:

```css
/* --- Three-card strip (peek / carousel modes) --- */

.route-page__strip {
  position: relative;
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
}

.route-page__slot {
  position: absolute;
  top: 0;
  height: 100dvh;
  overflow-y: auto;
  padding-bottom: 60px; /* clear the fixed nav bar */
  box-sizing: border-box;
}

.route-page__slot--animating {
  transition: transform 250ms ease-out;
}

.route-page__slot--empty {
  /* geometry placeholder at first/last card — no content */
  pointer-events: none;
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`

Expected: 0 errors.

- [ ] **Step 3: Commit**

```
git add src/pages/RoutePage.css
git commit -m "feat: add route-page strip and slot CSS classes"
```
