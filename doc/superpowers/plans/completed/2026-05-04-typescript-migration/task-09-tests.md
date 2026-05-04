# Task 09: Test Files

**Files (rename, 13 files):**
- `src/test/setup.js` → `src/test/setup.ts`
- `src/test/AuthContext.test.jsx` → `.tsx`
- `src/test/ChallengeCard.test.jsx` → `.tsx`
- `src/test/ChallengeForm.test.jsx` → `.tsx`
- `src/test/LanguageContext.test.jsx` → `.tsx`
- `src/test/LoginPage.test.jsx` → `.tsx`
- `src/test/ThemeContext.test.jsx` → `.tsx`
- `src/test/TitleBar.test.jsx` → `.tsx`
- `src/test/TitleBarContext.test.jsx` → `.tsx`
- `src/test/RoutePage.test.jsx` → `.tsx`
- `src/test/useLocations.test.jsx` → `.tsx`
- `src/test/useText.test.jsx` → `.tsx`
- `src/test/RoutePage.swipe.test.js` → `.ts`
- `src/test/worker.auth.test.js` → `.ts`
- `src/test/worker.github.test.js` → `.ts`
- `src/test/worker.test.js` → `.ts`

Modify: `vite.config.js` — update `setupFiles` path.

---

- [ ] **Step 1: Convert `src/test/setup.ts`**

```typescript
/// <reference types="vitest/globals" />
import "@testing-library/jest-dom/vitest";

globalThis.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
} as unknown as Storage;
```

The `/// <reference>` directive makes `vi`, `describe`, `it`, `expect`, etc. available globally in all test files without explicit imports, matching the existing `globals: true` vitest config.

The `as unknown as Storage` cast is required because the mock object doesn't implement all `Storage` methods (`key`, `length`). The cast is safe — tests only call `getItem`/`setItem`/`removeItem`/`clear`.

---

- [ ] **Step 2: Update `vite.config.js` setupFiles path**

In `vite.config.js`, change the test setup path from `.js` to `.ts`:

```javascript
// Before
setupFiles: "./src/test/setup.js",

// After
setupFiles: "./src/test/setup.ts",
```

---

- [ ] **Step 3: Convert test files — pattern for JSX test files**

For each `.test.jsx` → `.test.tsx`:
1. Rename with `git mv`
2. Remove `import PropTypes from "prop-types"` and all `.propTypes = { ... }` blocks
3. Remove `/* eslint-disable react/prop-types */` comment blocks (no longer needed)
4. Add explicit types to inline wrapper components:

   ```typescript
   // Before (JSX)
   function Wrapper({ children }) {
     return <ThemeProvider>{children}</ThemeProvider>;
   }

   // After (TSX)
   function Wrapper({ children }: { children: React.ReactNode }) {
     return <ThemeProvider>{children}</ThemeProvider>;
   }
   ```

5. Type `vi.fn()` return values where TypeScript cannot infer them:
   ```typescript
   // If a mock needs a specific return type:
   vi.mock("../auth/AuthContext", () => ({
     useAuth: vi.fn(() => ({ activeAuth: null })),
   }));
   // This is fine as-is — TypeScript infers from the factory function.
   ```

6. The fixture objects in test files (e.g. `const location = { ... }`) should be annotated:
   ```typescript
   import type { Location } from "../types/data";

   const location: Location = {
     locationId: 1,
     title: "The Final Civic Act",
     name: { label: "", value: "Binnenhof / Het Plein" },
     address: "Binnenhof 1",
     storyline: "The Binnenhof is the oldest seat of parliament.",
     breadcrumb: "Find the inner courtyard.",
     coordinates: { latitude: 52.0799, longitude: 4.3133 },
     challenge: { name: "", description: "Register to vote.", form: [] },
   };
   ```

---

- [ ] **Step 4: Convert `src/test/RoutePage.swipe.test.ts`**

This file tests pure functions `clampedNext` and `clampedPrev`. Rename and update the import path:

```typescript
import { clampedNext, clampedPrev } from "../pages/RoutePage";

// All test cases unchanged
```

---

- [ ] **Step 5: Convert worker test files**

`worker.auth.test.ts`, `worker.github.test.ts`, `worker.test.ts` are plain TS (no JSX). Key changes per file:

**`worker.auth.test.ts`** — update imports, type the mock env:

```typescript
import { createToken, verifyToken, checkRateLimit } from "../worker/auth";
import type { Env } from "../types/worker";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    AUTH_STORE: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => undefined),
    } as unknown as KVNamespace,
    AUTH_SECRET: "test-secret",
    PHOTOS: {} as R2Bucket,
    ASSETS: {} as Fetcher,
    GITHUB_REPO: "",
    GITHUB_PAT: "",
    FORM_SCRIPT_URL: "",
    ...overrides,
  };
}
```

**`worker.github.test.ts`** — update imports:

```typescript
import {
  decodeGitHubContent,
  encodeGitHubContent,
  locationFilePath,
} from "../worker/github";
// All test cases unchanged
```

**`worker.test.ts`** — update imports:

```typescript
import { buildR2Key } from "../worker/routes/uploadRoute";
import { createToken } from "../worker/auth";
import type { Env } from "../types/worker";
// All test cases unchanged, use makeEnv() pattern from worker.auth.test.ts
```

---

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors. Common issues:
- `vi` not found: ensure `/// <reference types="vitest/globals" />` is in `setup.ts` (the directive applies to all test files because they all import the setup via `setupFiles`). If TypeScript still doesn't see `vi`, add `"types": ["vitest/globals"]` to `tsconfig.json`'s `compilerOptions`.
- `KVNamespace` not found in test files: add `/// <reference types="@cloudflare/workers-types" />` to `worker.auth.test.ts` or add `"@cloudflare/workers-types"` to `tsconfig.json` `types` array.

---

- [ ] **Step 7: Run tests**

```bash
npm run test:run
```

Expected: all tests pass with the same count as before this task.

---

- [ ] **Step 8: Commit**

Stage: all converted test files + `vite.config.js` setupFiles change
Message: `refactor: convert test files to TypeScript`
