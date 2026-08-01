# Build Version Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a small, build-time-computed "which commit is this" string (short SHA + commit date, with a `+` suffix if the working tree was dirty at build time) in a footer line on the Landing Page.

**Architecture:** `vite.config.ts` shells out to git once at config-evaluation time (covers both `npm run dev` and `npm run build`, and Vitest since it shares the same config) to compute the string, and injects it as a global constant `__BUILD_VERSION__` via Vite's `define`. `LandingPage.svelte` renders that constant directly — no runtime fetch, no new component.

**Tech Stack:** Vite `define`, Node's built-in `child_process.execSync`. No new npm dependency.

## Global Constraints

- TypeScript only — no `.js`/`.jsx` files (CLAUDE.md).
- Styling via co-located `.css` file imported into the component, using `var(--color-*)` / `var(--font-size-*)` tokens — no inline styles for this (CLAUDE.md).
- Svelte 5 runes only — no `$:` reactive statements (CLAUDE.md).
- No abstractions for one-off things — this is small enough to live inline in `LandingPage.svelte`, not a new component (CLAUDE.md).
- **Do not run `git` commands or create commits during implementation** — the user controls git and commits manually (CLAUDE.md Limitations). Steps below stop at "verify it passes"; leave staging/committing to the user.

---

### Task 1: Compute and inject `__BUILD_VERSION__`, render it on the Landing Page

**Files:**
- Modify: `vite.config.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `src/pages/LandingPage.svelte`
- Modify: `src/pages/LandingPage.css`
- Modify: `src/test/LandingPage.test.ts`

**Interfaces:**
- Produces: global ambient constant `__BUILD_VERSION__: string`, available anywhere in `src/` (declared in `src/vite-env.d.ts`), holding a string like `"0dbcb3b · 1 Aug 2026"` (or `"0dbcb3b+ · 1 Aug 2026"` if the tree was dirty at config-evaluation time, or `"unknown"` if git isn't available).

- [ ] **Step 1: Write the failing test**

Add this test to `src/test/LandingPage.test.ts` (inside the existing `describe("LandingPage", ...)` block, alongside the other `it(...)` cases):

```ts
  it("renders the build version footer", () => {
    render(LandingPage, { props: {} });
    expect(screen.getByText(__BUILD_VERSION__)).toBeInTheDocument();
  });
```

No import changes needed — `__BUILD_VERSION__` will be an ambient global once Step 3 adds the declaration; TypeScript will error on it until then, and the test will fail to find the footer text either way.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/LandingPage.test.ts -t "renders the build version footer"`

Expected: FAIL — either a TypeScript error (`__BUILD_VERSION__` is not defined) or, once that's stubbed out, an assertion failure because no such text is on the page yet.

- [ ] **Step 3: Implement**

In `src/vite-env.d.ts`, add the ambient declaration:

```ts
/// <reference types="vite/client" />

declare const __BUILD_VERSION__: string;
```

In `vite.config.ts`, add the `execSync` import alongside the existing `fs`/`path`/`url` imports near the top:

```ts
import { execSync } from "child_process";
```

Add this helper above `const START = Date.now();` (or anywhere before `defineConfig`):

```ts
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getBuildVersion(): string {
  try {
    const sha = execSync("git rev-parse --short HEAD").toString().trim();
    const isoDate = execSync("git log -1 --format=%cI").toString().trim();
    const isDirty = execSync("git status --porcelain").toString().trim().length > 0;
    const date = new Date(isoDate);
    const formattedDate = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
    return `${sha}${isDirty ? "+" : ""} · ${formattedDate}`;
  } catch {
    return "unknown";
  }
}
```

In the `return { ... }` block inside `defineConfig(async () => { ... })`, add a `define` key alongside `plugins` and `server`:

```ts
  return {
    plugins,
    define: {
      __BUILD_VERSION__: JSON.stringify(getBuildVersion()),
    },
    server: {
      proxy: {},
    },
    test: {
      // ...unchanged
    },
  };
```

In `src/pages/LandingPage.svelte`, add the footer line right after the closing `</nav>` tag, still inside `.landing-page__controls`:

```svelte
    </nav>
    <p class="landing-page__version">{__BUILD_VERSION__}</p>
  </div>
```

In `src/pages/LandingPage.css`, add a rule for it after `.landing-page__nav-item`:

```css
.landing-page__version {
  margin-top: 0.5rem;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  opacity: 0.6;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/LandingPage.test.ts`

Expected: PASS — all `LandingPage` tests green, including the new one.

- [ ] **Step 5: Full check**

Run: `npm run lint` and `npx vitest run` (full suite) to confirm nothing else broke.

Expected: both clean.

Leave the change unstaged for the user to review and commit.
