# Task 01 — Types + image discovery utility

**Files:**
- Modify: `src/types/data.ts`
- Create: `src/utils/images.ts`
- Create: `src/test/images.test.ts`

**Context:**
`FormFieldType` in `src/types/data.ts` is the discriminated union of all field types used by `AppForm.svelte`. We add `"image-picker"` to it. We also create a new utility `src/utils/images.ts` that discovers image files using Vite's `import.meta.glob`. To keep the glob call out of the test environment (where it can't resolve `?url` queries), we split the function into `parseImageModules` (pure, testable) and `getAvailableImages` (calls the glob). Tests call `parseImageModules` directly with a fake modules object.

---

- [ ] **Step 1: Write failing tests**

Create `src/test/images.test.ts`:

```ts
import { parseImageModules } from "../utils/images";

test("parseImageModules returns filename and url pairs for allowed extensions", () => {
  const modules: Record<string, unknown> = {
    "/src/data/img/logo.jpg": "/assets/logo-abc.jpg",
    "/src/data/img/photo.png": "/assets/photo-def.png",
    "/src/data/img/banner.webp": "/assets/banner-ghi.webp",
  };
  const result = parseImageModules(modules);
  expect(result).toHaveLength(3);
  expect(result[0]).toEqual({ filename: "logo.jpg", url: "/assets/logo-abc.jpg" });
  expect(result[1]).toEqual({ filename: "photo.png", url: "/assets/photo-def.png" });
  expect(result[2]).toEqual({ filename: "banner.webp", url: "/assets/banner-ghi.webp" });
});

test("parseImageModules excludes non-image files", () => {
  const modules: Record<string, unknown> = {
    "/src/data/img/logo.jpg": "/assets/logo.jpg",
    "/src/data/img/.gitkeep": "",
    "/src/data/img/source.svg": "/assets/source.svg",
    "/src/data/img/readme.txt": "",
  };
  const result = parseImageModules(modules);
  expect(result).toHaveLength(1);
  expect(result[0].filename).toBe("logo.jpg");
});

test("parseImageModules is case-insensitive for extensions", () => {
  const modules: Record<string, unknown> = {
    "/src/data/img/PHOTO.JPG": "/assets/PHOTO.jpg",
  };
  const result = parseImageModules(modules);
  expect(result).toHaveLength(1);
  expect(result[0].filename).toBe("PHOTO.JPG");
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- src/test/images.test.ts
```

Expected: 3 tests fail with `Cannot find module '../utils/images'`.

- [ ] **Step 3: Add `"image-picker"` to `FormFieldType`**

Open `src/types/data.ts`. Find:

```ts
export type FormFieldType =
  | "boolean"
  | "string"
  | "number"
  | "radio"
  | "multiple"
  | "photo"
  | "textarea"
  | "section";
```

Replace with:

```ts
export type FormFieldType =
  | "boolean"
  | "string"
  | "number"
  | "radio"
  | "multiple"
  | "photo"
  | "textarea"
  | "section"
  | "image-picker";
```

- [ ] **Step 4: Create `src/utils/images.ts`**

```ts
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export interface ImageEntry {
  filename: string;
  url: string;
}

export function parseImageModules(modules: Record<string, unknown>): ImageEntry[] {
  return Object.entries(modules)
    .filter(([path]) =>
      ALLOWED_EXTENSIONS.has(path.slice(path.lastIndexOf(".")).toLowerCase()),
    )
    .map(([path, url]) => ({
      filename: path.split("/").at(-1)!,
      url: url as string,
    }));
}

export function getAvailableImages(): ImageEntry[] {
  return parseImageModules(
    import.meta.glob("/src/data/img/*", {
      eager: true,
      query: "?url",
      import: "default",
    }) as Record<string, unknown>,
  );
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```
npm test -- src/test/images.test.ts
```

Expected: all 3 tests pass.

- [ ] **Step 6: Run the full test suite and linter**

```
npm test
npm run lint
```

Expected: all existing tests still pass, no lint errors.

- [ ] **Step 7: Commit**

```
git add src/types/data.ts src/utils/images.ts src/test/images.test.ts
git commit -m "feat: add image-picker FormFieldType and image discovery utility"
```
