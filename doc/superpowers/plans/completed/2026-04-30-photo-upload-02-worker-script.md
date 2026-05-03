# Task 2: Create Worker script

**Part of:** [Photo Upload](2026-04-30-photo-upload.md)
**Depends on:** [Task 1 — Configure wrangler.jsonc](2026-04-30-photo-upload-01-wrangler-config.md)
**Next:** [Task 3 — Add camera button to ChallengeCard](2026-04-30-photo-upload-03-camera-button.md)

**Files:**

- Create: `src/worker.js`
- Create: `src/test/worker.test.js`

---

- [ ] **Step 1: Write the failing tests**

Create `src/test/worker.test.js`:

```js
import { describe, it, expect } from "vitest";
import { buildR2Key } from "../worker.js";

describe("buildR2Key", () => {
  it("uses jpg extension for jpeg mime type", () => {
    expect(buildR2Key("001", "image/jpeg", 1000000)).toBe("001_1000000.jpg");
  });

  it("uses png extension for png mime type", () => {
    expect(buildR2Key("001", "image/png", 1000000)).toBe("001_1000000.png");
  });

  it("falls back to jpg for unknown mime type", () => {
    expect(buildR2Key("001", "image/webp", 1000000)).toBe("001_1000000.jpg");
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm run test:run
```

Expected: 3 new tests FAIL with `Cannot find module '../worker.js'` or similar. All pre-existing tests still pass.

- [ ] **Step 3: Create `src/worker.js`**

```js
export function buildR2Key(locationId, mimeType, timestamp) {
  const ext = mimeType === "image/png" ? "png" : "jpg";
  return `${locationId}_${timestamp}.${ext}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/upload") {
      try {
        const formData = await request.formData();
        const photo = formData.get("photo");
        const locationId = formData.get("locationId") || "unknown";
        const key = buildR2Key(locationId, photo.type, Date.now());
        await env.PHOTOS.put(key, photo.stream(), {
          httpMetadata: { contentType: photo.type },
        });
        return new Response(JSON.stringify({ ok: true, key }), {
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        return new Response(
          JSON.stringify({ ok: false, error: "Upload failed" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    return env.ASSETS.fetch(request);
  },
};
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm run test:run
```

Expected: all tests pass, including the 3 new `buildR2Key` tests.

- [ ] **Step 5: Verify the wrangler preview builds and starts**

```bash
npm run preview
```

Expected: build succeeds, wrangler dev server starts (simulates R2 locally — no bucket needs to exist yet). Stop it with Ctrl+C.

> **Before first production deploy:** create the R2 bucket once with:
>
> ```bash
> npx wrangler r2 bucket create gwc-2026-photos
> ```
>
> Or create it via the Cloudflare dashboard → R2 → Create bucket.

- [ ] **Step 6: Commit**

```bash
git add src/worker.js src/test/worker.test.js
git commit -m "feat: add Worker upload endpoint with R2 storage"
```
