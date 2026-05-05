# Task 01 — Infrastructure

**Files:**
- Modify: `package.json`
- Create: `svelte.config.js`
- Modify: `vite.config.ts`
- Modify: `tsconfig.json`
- Modify: `eslint.config.js`

This task has no tests — the verification is that `npm run build`, `npm run lint`, and `npm run typecheck` all pass on an empty Svelte project before any components are written.

---

- [ ] **Step 1: Remove React packages, add Svelte packages**

```bash
npm remove react react-dom react-router-dom react-leaflet @vitejs/plugin-react \
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh \
  @types/react @types/react-dom

npm install svelte@^5 svelte-spa-router lucide-svelte

npm install --save-dev @sveltejs/vite-plugin-svelte svelte-check \
  eslint-plugin-svelte svelte-eslint-parser \
  @testing-library/svelte prettier-plugin-svelte
```

- [ ] **Step 2: Create `svelte.config.js`**

```javascript
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
}
```

- [ ] **Step 3: Update `vite.config.ts`** — replace `react()` with `svelte()`

```typescript
import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
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
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/assets/img/", (req, res) => {
        const file = (req.url ?? "").replace(/^\//, "");
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

const plugins = [svelte(), yaml()];
if (!process.env["VITEST"]) {
  plugins.push(cloudflare());
  plugins.push(devImageServer());
  plugins.push(copyImagesPlugin());
}

export default defineConfig({
  plugins,
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    passWithNoTests: true,
  },
});
```

- [ ] **Step 4: Update `tsconfig.json`** — remove JSX, add Svelte

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "allowJs": false,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src/**/*.ts", "src/**/*.svelte"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Replace `eslint.config.js`** — remove React plugins, add Svelte

```javascript
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import svelteParser from "svelte-eslint-parser";
import { defineConfig, globalIgnores } from "eslint/config";
import prettierConfig from "eslint-config-prettier";

const sharedRules = {
  "complexity": ["error", 10],
  "max-len": ["error", { "code": 100, "ignorePattern": "^\\s*<" }],
  "@typescript-eslint/no-confusing-void-expression": ["error", {
    "ignoreArrowShorthand": true,
  }],
  "curly": ["error", "all"],
  "brace-style": ["error", "1tbs", { "allowSingleLine": false }],
  "id-length": ["error", { "min": 3, "exceptions": ["id", "to", "ok", "fs"] }],
  "no-useless-return": "error",
  "@typescript-eslint/no-unused-vars": [
    "error",
    { "varsIgnorePattern": "^[A-Z_]", "argsIgnorePattern": "^_" },
  ],
  "no-restricted-syntax": [
    "error",
    {
      "selector": "ForOfStatement > BlockStatement > IfStatement[test.operator='!'] > ReturnStatement[argument.value=false]",
      "message": "This manual guard loop can be replaced with .every() or .isSubsetOf().",
    },
    {
      "selector": "ReturnStatement[argument=null]",
      "message": "Early returns (naked returns) are disallowed.",
    },
    {
      "selector": "BinaryExpression[operator='==='] > Literal[value=/./]",
      "message": "Don't compare against raw strings. Use a constant or Type.",
    },
    {
      "selector": "BinaryExpression[operator='!=='] > Literal[value=/./]",
      "message": "Don't compare against raw strings. Use a constant or Type.",
    },
  ],
};

export default defineConfig([
  globalIgnores(["dist", "build", "node_modules"]),
  {
    files: ["**/*.{js,ts}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: "latest",
      globals: { ...globals.browser, ...globals.es2020, ...globals.node },
    },
    rules: sharedRules,
  },
  {
    files: ["**/*.svelte"],
    plugins: { svelte },
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
      },
      globals: { ...globals.browser },
    },
    rules: {
      ...svelte.configs.recommended.rules,
      "svelte/require-each-key": "error",
      "svelte/no-at-html-tags": "error",
      "svelte/no-unused-svelte-ignore": "error",
      "svelte/no-reactive-reassign": "error",
      ...sharedRules,
    },
  },
  {
    files: ["src/test/**/*.{ts}", "**/*.test.{ts}"],
    languageOptions: {
      globals: { ...globals.vitest, vi: "readonly", global: "readonly" },
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  prettierConfig,
]);
```

- [ ] **Step 6: Add `prettier.config.js`** — enable Svelte plugin

```javascript
export default {
  plugins: ["prettier-plugin-svelte"],
  overrides: [{ files: "*.svelte", options: { parser: "svelte" } }],
};
```

- [ ] **Step 7: Update `package.json` scripts** — add svelte-check, fix format glob

In `package.json`, update the `scripts` block:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "lint:fix": "eslint . --fix",
  "preview": "npm run build && wrangler dev",
  "deploy": "npm run build && wrangler deploy",
  "test": "vitest",
  "test:run": "vitest run",
  "format": "prettier --write \"src/**/*.{ts,svelte,css,md}\"",
  "format:check": "prettier --check \"src/**/*.{ts,svelte,css,md}\"",
  "typecheck": "tsc --noEmit && svelte-check --tsconfig ./tsconfig.json"
}
```

- [ ] **Step 8: Create a minimal `src/App.svelte` so the build has an entry point**

```svelte
<script lang="ts">
</script>

<p>Migrating to Svelte…</p>
```

- [ ] **Step 9: Update `src/main.ts`** (rename from `main.tsx`) — minimal Svelte mount

Delete `src/main.tsx`. Create `src/main.ts`:

```typescript
import { mount } from "svelte";
import App from "./App.svelte";
import "./styles/global.css";

const app = mount(App, { target: document.getElementById("root")! });
export default app;
```

- [ ] **Step 10: Update `index.html`** — the entry point is now `main.ts` not `main.tsx`

In `index.html`, change:
```html
<script type="module" src="/src/main.tsx"></script>
```
to:
```html
<script type="module" src="/src/main.ts"></script>
```

- [ ] **Step 11: Verify build passes**

```bash
npm run build
```

Expected: build succeeds (may warn about unused CSS vars — that's fine).

- [ ] **Step 12: Verify lint passes**

```bash
npm run lint
```

Expected: 0 errors. If `@typescript-eslint/no-confusing-void-expression` errors appear on `.ts` files, add `"@typescript-eslint/no-confusing-void-expression": "off"` temporarily and revisit after migration.

- [ ] **Step 13: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: `tsc` passes; `svelte-check` reports 0 errors on the stub `App.svelte`.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json svelte.config.js vite.config.ts \
  tsconfig.json eslint.config.js prettier.config.js src/main.ts src/App.svelte \
  index.html
git commit -m "chore: migrate build toolchain from React to Svelte 5"
```
