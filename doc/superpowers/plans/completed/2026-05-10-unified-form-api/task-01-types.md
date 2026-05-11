# Task 01: Extend FormField Types

**Files:**
- Modify: `src/types/data.ts`

---

- [ ] **Step 1: Add `textarea` and `section` to `FormFieldType` and make `id` optional**

Open `src/types/data.ts`. Replace lines 1–16:

```typescript
export type FormFieldType =
  | "boolean"
  | "string"
  | "number"
  | "radio"
  | "multiple"
  | "photo"
  | "textarea"
  | "section";

export interface FormField {
  id?: string;
  type: FormFieldType;
  label: string;
  options?: string[];
  min?: number;
  max?: number;
}
```

> `id` is optional because `section` pseudo-fields render a heading only — they collect no value and need no identifier. All other field types still require an `id` in practice; the YAML author is responsible for providing one.

- [ ] **Step 2: Run lint to confirm no TypeScript errors**

```
npm run lint
```

Expected: passes cleanly. If there are errors in other files due to `field.id` possibly being undefined, they will surface and be fixed in the tasks that touch those files.

- [ ] **Step 3: Commit**

```
git add src/types/data.ts
git commit -m "feat: extend FormFieldType with textarea and section; make id optional"
```
