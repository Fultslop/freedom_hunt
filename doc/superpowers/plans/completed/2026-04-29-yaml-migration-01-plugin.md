# Task 1: Add YAML Plugin

**Files:**

- Modify: `vite.config.js`

---

- [ ] **Step 1: Install the YAML plugin**

```bash
npm install --save-dev @modyfi/vite-plugin-yaml
```

Expected output: package added to `devDependencies` in `package.json`, no errors.

- [ ] **Step 2: Add the plugin to `vite.config.js`**

Current `vite.config.js`:

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    historyApiFallback: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    passWithNoTests: true,
  },
});
```

Replace with:

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import yaml from "@modyfi/vite-plugin-yaml";

export default defineConfig({
  plugins: [react(), cloudflare(), yaml()],
  server: {
    historyApiFallback: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    passWithNoTests: true,
  },
});
```

- [ ] **Step 3: Run tests to verify nothing broke**

```bash
npm run test:run
```

Expected: all 15 tests pass. The plugin is inert at this point — no YAML files exist yet and the hooks still glob `.json`.

- [ ] **Step 4: Commit**

```bash
git add vite.config.js package.json package-lock.json
git commit -m "feat: add @modyfi/vite-plugin-yaml"
```
