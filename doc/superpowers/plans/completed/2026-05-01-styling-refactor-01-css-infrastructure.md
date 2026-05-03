# Task 01 — CSS infrastructure

**Next:** [Task 02 — App wiring](2026-05-01-styling-refactor-02-app-wiring.md)

**Files:**

- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `src/hooks/useCssVars.js`

---

- [ ] **Step 1: Create `src/styles/tokens.css`**

This file declares all 15 CSS custom properties for each theme. The `:root` block is the wireframe fallback. Runtime values are always overridden by `useCssVars()` — these blocks are fallbacks for SSR/first-paint.

```css
/* src/styles/tokens.css */

:root {
  --color-background: #ffffff;
  --color-surface: #f9f9f9;
  --color-border: #dddddd;
  --color-text: #111111;
  --color-text-secondary: #666666;
  --color-text-muted: #aaaaaa;
  --color-accent: #555555;
  --color-bar-background: #ffffff;
  --color-bar-border: #dddddd;
  --color-bar-text: #333333;
  --color-bar-text-secondary: #888888;
  --color-progress-track: #eeeeee;
  --color-progress-fill: #555555;
  --color-clue-background: transparent;
  --color-clue-border: transparent;
  --color-error: #bf0a30;
  --color-success: #2d7a2d;
}

:root[data-theme="app"] {
  --color-background: #0f172a;
  --color-surface: #1e293b;
  --color-border: #334155;
  --color-text: #f8fafc;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
  --color-accent: #f59e0b;
  --color-bar-background: #1e293b;
  --color-bar-border: #334155;
  --color-bar-text: #f8fafc;
  --color-bar-text-secondary: #94a3b8;
  --color-progress-track: #0f172a;
  --color-progress-fill: #f59e0b;
  --color-clue-background: #1a2744;
  --color-clue-border: transparent;
}

:root[data-theme="GWC"] {
  --color-background: #ffffff;
  --color-surface: #f0f4ff;
  --color-border: #e5e7eb;
  --color-text: #002868;
  --color-text-secondary: #374151;
  --color-text-muted: #6b7280;
  --color-accent: #bf0a30;
  --color-bar-background: #002868;
  --color-bar-border: #002868;
  --color-bar-text: #ffffff;
  --color-bar-text-secondary: #93c5fd;
  --color-progress-track: #001a4d;
  --color-progress-fill: #bf0a30;
  --color-clue-background: #f0f4ff;
  --color-clue-border: #002868;
}
```

- [ ] **Step 2: Create `src/styles/global.css`**

This replaces all per-page `<style>` reset tags and centralises keyframe animations.

```css
/* src/styles/global.css */

html,
body,
#root {
  margin: 0;
  padding: 0;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInFromRight {
  from {
    transform: translateX(40px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideInFromLeft {
  from {
    transform: translateX(-40px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

- [ ] **Step 3: Create `src/hooks/useCssVars.js`**

The hook converts camelCase theme keys (`barBackground`) to kebab-case CSS var names (`--color-bar-background`) before setting them. It also sets `data-theme` on `<html>` so the static `:root[data-theme]` blocks in tokens.css match.

```js
// src/hooks/useCssVars.js
import { useEffect } from "react";
import { useTheme } from "../theme/ThemeContext";

function toKebab(key) {
  return key.replace(/([A-Z])/g, "-$1").toLowerCase();
}

export function useCssVars() {
  const { theme, themeName } = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = themeName;
    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(`--color-${toKebab(key)}`, value);
    });
  }, [theme, themeName]);
}
```

Note: `root.style.setProperty` (inline style on `:root`) takes precedence over the static `:root[data-theme]` blocks, so the JS runtime values always win. The CSS blocks in `tokens.css` act as SSR/first-paint fallbacks only.

- [ ] **Step 4: Run the test suite to confirm nothing is broken yet**

```
npm test
```

Expected: all tests pass. No code changes to JSX yet, so there should be zero regressions.

- [ ] **Step 5: Commit**

```
git add src/styles/tokens.css src/styles/global.css src/hooks/useCssVars.js
git commit -m "feat: add CSS custom property infrastructure (tokens, global, useCssVars)"
```
