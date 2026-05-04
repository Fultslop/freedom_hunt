# Task 10: Final Cleanup

**Files:**
- `vite.config.js` → `vite.config.ts`
- `eslint.config.js` (update TypeScript parser config)
- `package.json` (remove `prop-types`, disable `allowJs`)
- `CLAUDE.md` (update language conventions)
- `tsconfig.json` (disable `allowJs` now that all files are TypeScript)

---

- [ ] **Step 1: Convert `vite.config.ts`**

Rename `vite.config.js` to `vite.config.ts` with `git mv`, then replace its contents:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import yaml from "@modyfi/vite-plugin-yaml";
import {
  readdirSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  existsSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function devImageServer() {
  return {
    name: "dev-image-server",
    configureServer(server: { middlewares: { use: (path: string, handler: (req: { url: string }, res: { setHeader: (k: string, v: string) => void; end: (b: Buffer) => void }, next: () => void) => void) => void } }) {
      server.middlewares.use("/assets/img/", (req, res) => {
        const file = req.url.replace(/^\//, "");
        const src = join(
          __dirname,
          "src",
          "data",
          "img",
          decodeURIComponent(file),
        );
        if (existsSync(src)) {
          const ext = file.split(".").pop()?.toLowerCase();
          const mime =
            ext === "png"
              ? "image/png"
              : ext === "webp"
                ? "image/webp"
                : "image/jpeg";
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Content-Type", mime);
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(readFileSync(src));
        }
      });
    },
  };
}

function copyImagesPlugin() {
  return {
    name: "copy-images",
    closeBundle() {
      const src = join(__dirname, "src", "data", "img");
      const dst = join(__dirname, "dist", "client", "assets", "img");
      mkdirSync(dst, { recursive: true });
      for (const file of readdirSync(src)) {
        copyFileSync(join(src, file), join(dst, file));
      }
    },
  };
}

const plugins = [react(), yaml()];
if (!process.env["VITEST"]) {
  plugins.push(cloudflare());
  plugins.push(devImageServer());
  plugins.push(copyImagesPlugin());
}

export default defineConfig({
  plugins,
  server: {
    historyApiFallback: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    passWithNoTests: true,
  },
});
```

Note: the `configureServer` middleware type can be simplified by using `any` if the Vite plugin types are complex. Replace the inline type annotation with:

```typescript
configureServer(server: import("vite").ViteDevServer) {
```

This is cleaner and uses Vite's own types.

---

- [ ] **Step 2: Update `eslint.config.js` for type-aware rules**

Add `project: true` to the TypeScript parser so ESLint can use type information for rules like `@typescript-eslint/no-floating-promises`:

```javascript
// In the languageOptions section, add:
parserOptions: {
  ecmaFeatures: { jsx: true },
  sourceType: "module",
  project: true,
  tsconfigRootDir: import.meta.dirname,
},
```

If this causes performance issues during lint, it can be reverted — type-aware ESLint rules are optional. The minimal change is just confirming the parser still works.

---

- [ ] **Step 3: Disable `allowJs` in `tsconfig.json`**

Now that all source files are TypeScript, `allowJs` is no longer needed. Remove it (or set to `false`) so JS files are no longer silently accepted:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

---

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors. If any files were accidentally left as `.js`/`.jsx`, the error messages will point to them.

---

- [ ] **Step 5: Remove `prop-types` from dependencies**

```bash
npm uninstall prop-types
```

Verify no remaining `import PropTypes` anywhere:

```bash
grep -r "prop-types" src/
```

Expected: no matches.

---

- [ ] **Step 6: Run tests**

```bash
npm run test:run
```

Expected: all tests pass.

---

- [ ] **Step 7: Run lint**

```bash
npm run lint
```

Expected: 0 errors (there may be some new warnings from type-aware rules — address any errors, warnings can be reviewed separately).

---

- [ ] **Step 8: Update `CLAUDE.md`**

In the **Tech Stack** and **Coding Conventions** sections, update language references from JSX to TypeScript:

- Change `Language | JSX (no TypeScript)` → `Language | TypeScript + TSX`
- In Coding Conventions, replace:
  > **JSX only** — no TypeScript, no `.tsx` files

  With:
  > **TypeScript only** — all source files use `.ts` (no JSX) or `.tsx` (with JSX). No `.js` or `.jsx` files in `src/`.

- Replace the line:
  > **New components** — create a co-located `ComponentName.css` file. Use BEM-like class names (`component-name__element--modifier`). Import the CSS file at the top of the JSX file.

  With:
  > **New components** — create a co-located `ComponentName.css` file. Use BEM-like class names (`component-name__element--modifier`). Import the CSS file at the top of the TSX file. Define props as an inline interface `interface ComponentNameProps { ... }` rather than using PropTypes.

---

- [ ] **Step 9: Final smoke test**

```bash
npm run build
```

Expected: build completes with no TypeScript errors and no Vite bundling errors.

---

- [ ] **Step 10: Commit**

Stage: `vite.config.ts`, `eslint.config.js`, `tsconfig.json`, `package.json`, `package-lock.json`, `CLAUDE.md`
Message: `chore: finalize TypeScript migration — remove allowJs, prop-types, update docs`
