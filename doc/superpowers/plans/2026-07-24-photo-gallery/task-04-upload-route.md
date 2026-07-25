# Task 04: Upload Route Rewrite

**Depends on:** Task 02 (D1 photo helpers), Task 03 (image processing).

**Files:**
- Modify: `src/worker/routes/uploadRoute.ts`
- Modify: `src/test/worker.test.ts` (`buildR2Key` describe block removed; `/upload` describe block rewritten)

**Interfaces:**
- Consumes: `generateVariants(bytes, mimeType)` from `../imageProcessing`; `buildR2KeyPrefix`, `buildVariantKey` from `../photoKeys`; `insertPhoto` from `../db`; `isParticipantToken` from `../../types/auth` (already exists).
- Produces: `handleUploadRoute` now returns `{ ok: true, id, key }` on success (was `{ ok: true, key }`) — Task 06 (frontend) depends on the `id` field being present.

`buildR2Key` is removed — the old single-file, mime-based-extension key scheme is replaced entirely by `buildR2KeyPrefix`/`buildVariantKey` from Task 03. Anything that imported `buildR2Key` must be updated (only `worker.test.ts` does).

---

- [ ] **Step 1: Write the failing tests**

In `src/test/worker.test.ts`:

1. Remove the `import { buildR2Key } from "../worker/routes/uploadRoute";` line and the entire `describe("buildR2Key", ...)` block (lines 5, 24-36) — that behavior no longer exists.
2. Replace the entire `describe("/upload", ...)` block with:

```ts
describe("/upload", () => {
  afterEach(() => vi.restoreAllMocks());

  function makePhotoFormData() {
    return {
      get: (key: string) => {
        const values: Record<string, unknown> = {
          photo: { type: "image/jpeg", arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer },
          locationId: "1",
          cityId: "den_haag",
          routeId: "short_loop",
          taskTitle: "The Final Civic Act",
        };
        return values[key] ?? null;
      },
    };
  }

  it("returns 401 when not authenticated", async () => {
    const env = {
      AUTH_SECRET: TEST_SECRET,
      AUTH_STORE: { get: async () => null },
      PHOTOS: { put: vi.fn() },
      AUTH_DB: {},
    } as unknown as Env;
    const request = new Request("https://example.com/upload", {
      method: "POST",
      body: makePhotoFormData(),
      headers: {},
    });
    request.formData = vi.fn().mockResolvedValue(makePhotoFormData());
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
  });

  it("returns 401 for a non-participant (editor) session", async () => {
    const editorToken = await createToken({ user_id: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }, TEST_SECRET);
    const env = {
      AUTH_SECRET: TEST_SECRET,
      PHOTOS: { put: vi.fn() },
      AUTH_DB: {},
    } as unknown as Env;
    const request = new Request("https://example.com/upload", {
      method: "POST",
      body: makePhotoFormData(),
      headers: { Cookie: `freedom_hunt_auth=${editorToken}` },
    });
    request.formData = vi.fn().mockResolvedValue(makePhotoFormData());
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
  });

  it("generates 3 variants, stores them in R2, and inserts a photos row", async () => {
    vi.doMock("../worker/imageProcessing", () => ({
      generateVariants: vi.fn(() => ({
        thumb: new Uint8Array([1]),
        medium: new Uint8Array([2]),
        full: new Uint8Array([3]),
        mimeType: "image/jpeg",
      })),
    }));
    const putMock = vi.fn().mockResolvedValue(undefined);
    const runMock = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const env = {
      AUTH_SECRET: TEST_SECRET,
      PHOTOS: { put: putMock },
      AUTH_DB: { prepare: () => ({ bind: () => ({ run: runMock }) }) },
    } as unknown as Env;
    const request = new Request("https://example.com/upload", {
      method: "POST",
      body: makePhotoFormData(),
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    request.formData = vi.fn().mockResolvedValue(makePhotoFormData());
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(typeof data.id).toBe("string");
    expect(putMock).toHaveBeenCalledTimes(3);
    expect(runMock).toHaveBeenCalledOnce();
  });

  it("falls back to storing only the full variant when image processing throws", async () => {
    vi.doMock("../worker/imageProcessing", () => ({
      generateVariants: vi.fn(() => {
        throw new Error("unsupported format");
      }),
    }));
    const putMock = vi.fn().mockResolvedValue(undefined);
    const runMock = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const env = {
      AUTH_SECRET: TEST_SECRET,
      PHOTOS: { put: putMock },
      AUTH_DB: { prepare: () => ({ bind: () => ({ run: runMock }) }) },
    } as unknown as Env;
    const request = new Request("https://example.com/upload", {
      method: "POST",
      body: makePhotoFormData(),
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    request.formData = vi.fn().mockResolvedValue(makePhotoFormData());
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    expect(putMock).toHaveBeenCalledTimes(1); // only "full"
    expect(runMock).toHaveBeenCalledOnce(); // photos row is still written
  });

  it("returns 500 when R2 put throws", async () => {
    vi.doMock("../worker/imageProcessing", () => ({
      generateVariants: vi.fn(() => ({
        thumb: new Uint8Array([1]),
        medium: new Uint8Array([2]),
        full: new Uint8Array([3]),
        mimeType: "image/jpeg",
      })),
    }));
    const env = {
      AUTH_SECRET: TEST_SECRET,
      PHOTOS: { put: vi.fn().mockRejectedValue(new Error("R2 down")) },
      AUTH_DB: { prepare: () => ({ bind: () => ({ run: vi.fn() }) }) },
    } as unknown as Env;
    const request = new Request("https://example.com/upload", {
      method: "POST",
      body: makePhotoFormData(),
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    request.formData = vi.fn().mockResolvedValue(makePhotoFormData());
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(500);
  });
});
```

Note: `vi.doMock` (not `vi.mock`) is used because it must apply per-test after `worker.ts`'s static imports have already resolved once in this file — `worker.test.ts` imports the whole `worker.ts` module graph once at the top of the file, so a hoisted `vi.mock` would apply globally to every test in the file, including unrelated ones. If this pattern proves awkward in practice, an acceptable alternative is moving these 3 new tests into their own file (e.g. `src/test/worker.upload.test.ts`) with a top-level `vi.mock("../worker/imageProcessing", ...)` — use whichever keeps the mock scoped correctly; verify with Step 2 either way.

---

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/worker.test.ts`
Expected: FAIL — current `uploadRoute.ts` doesn't read `cityId`/`taskTitle`, doesn't call `generateVariants`, doesn't insert into `AUTH_DB`, and current auth check doesn't reject editor tokens.

---

- [ ] **Step 3: Rewrite `uploadRoute.ts`**

Full replacement of `src/worker/routes/uploadRoute.ts`:

```ts
import type { Env } from "../../types/worker";
import { requireAuth } from "../auth";
import { json } from "../utils";
import { isParticipantToken } from "../../types/auth";
import { generateVariants } from "../imageProcessing";
import { buildR2KeyPrefix, buildVariantKey } from "../photoKeys";
import { insertPhoto } from "../db";

function generateId(): string {
  return crypto.randomUUID();
}

export async function handleUploadRoute(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method !== "POST" || url.pathname !== "/upload") {
    return null;
  }

  const authPayload = await requireAuth(request, env);
  if (!authPayload || !isParticipantToken(authPayload)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  try {
    const formData = await request.formData();
    const photo = formData.get("photo") as File | null;
    if (!photo) {
      return json({ ok: false, error: "No photo provided" }, 400);
    }
    const locationId = (formData.get("locationId") as string) || "unknown";
    const cityId = (formData.get("cityId") as string) || "unknown";
    const routeId = (formData.get("routeId") as string) || null;
    const taskTitle = (formData.get("taskTitle") as string) || "Untitled challenge";

    const originalBytes = new Uint8Array(await photo.arrayBuffer());
    const timestamp = Date.now();
    const keyPrefix = buildR2KeyPrefix(locationId, timestamp);

    let mimeType = photo.type || "image/jpeg";
    let fullBytes: Uint8Array = originalBytes;
    let mediumBytes: Uint8Array | null = null;
    let thumbBytes: Uint8Array | null = null;

    try {
      const variants = generateVariants(originalBytes, mimeType);
      fullBytes = variants.full;
      mediumBytes = variants.medium;
      thumbBytes = variants.thumb;
      mimeType = variants.mimeType;
    } catch {
      // Corrupt file or unsupported format — fall back to storing the raw
      // upload as the "full" variant only; the photos row is still written.
    }

    await env.PHOTOS.put(buildVariantKey(keyPrefix, "full"), fullBytes, {
      httpMetadata: { contentType: mimeType },
    });
    if (mediumBytes) {
      await env.PHOTOS.put(buildVariantKey(keyPrefix, "medium"), mediumBytes, {
        httpMetadata: { contentType: "image/jpeg" },
      });
    }
    if (thumbBytes) {
      await env.PHOTOS.put(buildVariantKey(keyPrefix, "thumb"), thumbBytes, {
        httpMetadata: { contentType: "image/jpeg" },
      });
    }

    const photoId = generateId();
    await insertPhoto(env.AUTH_DB, {
      id: photoId,
      project_id: authPayload.project,
      city_id: cityId,
      route_id: routeId,
      location_id: locationId,
      task_title: taskTitle,
      team_name: authPayload.teamName,
      contact: authPayload.contact || null,
      r2_key: keyPrefix,
      mime_type: mimeType,
      uploaded_at: Math.floor(timestamp / 1000),
    });

    return json({ ok: true, id: photoId, key: keyPrefix });
  } catch {
    return json({ ok: false, error: "Upload failed" }, 500);
  }
}
```

---

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/worker.test.ts`
Expected: PASS, all tests in the file.

---

- [ ] **Step 5: Run full suite, lint, typecheck**

```bash
npm run test:run
npm run lint
npm run typecheck
```

Expected: all pass, 0 errors.

---

- [ ] **Step 6: Commit**

```bash
git add src/worker/routes/uploadRoute.ts src/test/worker.test.ts
git commit -m "feat: upload route generates capped image variants and records photo metadata"
```
