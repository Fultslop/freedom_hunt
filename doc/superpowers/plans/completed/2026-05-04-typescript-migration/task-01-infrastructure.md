# Task 01: TypeScript Infrastructure

**Files:**
- Create: `tsconfig.json`
- Create: `src/types/yaml.d.ts`
- Modify: `package.json`

---

- [ ] **Step 1: Install TypeScript and Cloudflare Workers types**

```bash
npm install --save-dev typescript @cloudflare/workers-types
```

Expected: both packages added to `devDependencies` in `package.json`.

---

- [ ] **Step 2: Create `tsconfig.json`**

Create `tsconfig.json` in the project root:

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
    "allowJs": true,
    "skipLibCheck": true,
    "isolatedModules": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

Notes:
- `allowJs: true` — JS files continue to compile during migration; remove at the end of Task 10.
- `noEmit: true` — Vite handles compilation; `tsc` is type-checking only.
- `moduleResolution: "Bundler"` — required for Vite 3+ bare specifier resolution.
- `isolatedModules: true` — matches Vite's per-file transform model.

---

- [ ] **Step 3: Create YAML module declaration**

Create `src/types/yaml.d.ts`:

```typescript
declare module "*.yaml" {
  const value: unknown;
  export default value;
}
```

This tells TypeScript that any `import foo from "something.yaml"` returns `unknown`. Callers cast to specific types from `src/types/data.ts`.

---

- [ ] **Step 4: Add `typecheck` script to `package.json`**

In the `"scripts"` section of `package.json`, add:

```json
"typecheck": "tsc --noEmit"
```

---

- [ ] **Step 5: Run typecheck to verify baseline**

```bash
npm run typecheck
```

Expected: 0 errors. No TypeScript files exist yet; `allowJs: true` means JS files are checked permissively without type annotations required.

---

- [ ] **Step 6: Run tests to verify nothing broke**

```bash
npm run test:run
```

Expected: all tests pass (same count as before this task).

---

- [ ] **Step 7: Commit**

Stage: `tsconfig.json`, `src/types/yaml.d.ts`, `package.json`, `package-lock.json`
Message: `chore: add TypeScript infrastructure (tsconfig, yaml.d.ts)`
