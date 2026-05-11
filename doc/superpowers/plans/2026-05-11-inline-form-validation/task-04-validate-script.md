# Task 04 — validate:yaml script + CI step

**Files:**
- Create: `scripts/validate-yaml.js`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

No unit tests — the script is verified by running it against the current (broken)
Oslo data and expecting a non-zero exit.

---

- [ ] **Step 1: Create the validate script**

Create `scripts/validate-yaml.js`:

```js
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DATA_DIR = join(ROOT, "src", "data", "text", "en", "projects");

function findLocFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return findLocFiles(fullPath);
    }
    if (/^\d+_loc_.*\.yaml$/.test(entry.name)) {
      return [fullPath];
    }
    return [];
  });
}

function validateFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const data = loadYaml(content);
  const form = data?.challenge?.form;
  if (form !== undefined && typeof form !== "string") {
    return "challenge.form must be a filename string, not an inline array";
  }
  return null;
}

const locFiles = findLocFiles(DATA_DIR);
const violations = locFiles.flatMap((filePath) => {
  const msg = validateFile(filePath);
  if (msg === null) {
    return [];
  }
  return [{ filePath, msg }];
});

violations.forEach(({ filePath, msg }) => {
  const rel = filePath.slice(ROOT.length);
  console.error(`ERROR: ${rel}: ${msg}`);
});

if (violations.length > 0) {
  process.exit(1);
}
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add `"validate:yaml"` to the `"scripts"` object:

```json
"validate:yaml": "node scripts/validate-yaml.js",
```

Place it after `"typecheck"` for readability.

- [ ] **Step 3: Verify the script fails for Oslo**

```
npm run validate:yaml
```

Expected: exits with code 1. Stderr should list all 7 Oslo `*_loc_*.yaml` files
with the message `challenge.form must be a filename string, not an inline array`.

Example output:
```
ERROR: src\data\text\en\projects\democrats_abroad\oslo\001_loc_royal_palace.yaml: challenge.form must be a filename string, not an inline array
ERROR: src\data\text\en\projects\democrats_abroad\oslo\002_loc_stortinget.yaml: challenge.form must be a filename string, not an inline array
... (7 lines total)
```

- [ ] **Step 4: Verify Den Haag passes**

The script should exit 0 if only Den Haag files exist (they already use string
references). Oslo will make it fail until Task 05 is complete — that is expected.

- [ ] **Step 5: Run lint on the script**

```
npm run lint -- scripts/validate-yaml.js
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Add CI step**

In `.github/workflows/ci.yml`, add a `Validate YAML` step after
`Install dependencies` and before `Run Typecheck`:

```yaml
      - name: Validate YAML
        run: npm run validate:yaml
```

Full updated `ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  quality-assurance:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '25.8.1'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Validate YAML
        run: npm run validate:yaml

      - name: Run Typecheck
        run: npm run typecheck

      - name: Run Linter
        run: npm run lint

      - name: Run Tests
        run: npm run test
```

- [ ] **Step 7: Commit**

```
git add scripts/validate-yaml.js package.json .github/workflows/ci.yml
git commit -m "feat: add validate:yaml script; wire to npm script and CI"
```

Note: CI will fail on this branch until Task 05 (Oslo migration) is complete.
That is the expected and desired behaviour — the guard is working.
