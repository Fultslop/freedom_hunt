# Task 05: Gallery API Routes — List, Random, Serving

**Depends on:** Task 02 (D1 photo helpers), Task 03 (`photoKeys.ts`).

**Files:**
- Create: `src/types/gallery.ts`
- Create: `src/worker/routes/galleryRoutes.ts`
- Modify: `src/worker.ts`
- Create: `src/test/worker.gallery.test.ts`

**Interfaces:**
- Consumes: `listPhotos`, `randomPhotos`, `getPhotoById`, `DbPhoto` from `../db`; `buildVariantKey`, `PHOTO_VARIANTS`, `PhotoVariant` from `../photoKeys`; `requireAuth` from `../auth`.
- Produces: `handleGalleryRoutes(request, url, env)` wired into `worker.ts`'s fetch chain; `GalleryPhoto` type from `src/types/gallery.ts`, consumed by Task 06 (frontend API client) and every gallery component.

All three routes require any authenticated session (participant or editor) — access is "logged in," not role-gated, per the design spec.

---

- [ ] **Step 1: Write the shared `GalleryPhoto` type**

Create `src/types/gallery.ts`:

```ts
/** Gallery-facing photo DTO — shared between worker routes and frontend consumers. */
export interface GalleryPhoto {
  id: string;
  locationId: string;
  taskTitle: string;
  teamName: string;
  uploadedAt: number;
  thumbUrl: string;
  mediumUrl: string;
  fullUrl: string;
}
```

---

- [ ] **Step 2: Write the failing tests**

Create `src/test/worker.gallery.test.ts`:

```ts
// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../worker";
import { createToken } from "../worker/auth";
import type { TokenPayload } from "../types/auth";
import type { Env } from "../types/worker";

const TEST_SECRET = "test-secret";
const TEST_PAYLOAD: TokenPayload = {
  project: "democrats_abroad",
  teamName: "Team A",
  contact: "a@b.com",
  isAdmin: false,
  exp: Math.floor(Date.now() / 1000) + 3600,
};

let authToken: string;
beforeEach(async () => {
  authToken = await createToken(TEST_PAYLOAD, TEST_SECRET);
});

const SAMPLE_PHOTOS = [
  {
    id: "p1", project_id: "democrats_abroad", city_id: "den_haag", route_id: "short_loop",
    location_id: "1", task_title: "The Final Civic Act", team_name: "Team A",
    contact: "a@b.com", r2_key: "1_1000", mime_type: "image/jpeg", uploaded_at: 1000,
  },
  {
    id: "p2", project_id: "democrats_abroad", city_id: "den_haag", route_id: "short_loop",
    location_id: "2", task_title: "Vredespaleis", team_name: "Team B",
    contact: null, r2_key: "2_2000", mime_type: "image/jpeg", uploaded_at: 2000,
  },
];

function makeDb(photos = SAMPLE_PHOTOS) {
  return {
    prepare: (sql: string) => {
      const args: unknown[] = [];
      const stmt = {
        bind: (...values: unknown[]) => { args.push(...values); return stmt; },
        first: async () => photos.find((p) => p.id === args[0]) ?? null,
        all: async () => {
          if (sql.includes("WHERE project_id = ? AND city_id = ?")) {
            const [project, city] = args;
            return { results: photos.filter((p) => p.project_id === project && p.city_id === city) };
          }
          return { results: [] };
        },
      };
      return stmt;
    },
  };
}

describe("GET /gallery/:project/:city/photos", () => {
  it("returns 401 when not authenticated", async () => {
    const request = new Request("https://example.com/gallery/democrats_abroad/den_haag/photos");
    const response = await worker.fetch(request, { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb() } as unknown as Env);
    expect(response.status).toBe(401);
  });

  it("returns all photos for the project+city with derived variant URLs", async () => {
    const request = new Request("https://example.com/gallery/democrats_abroad/den_haag/photos", {
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(request, { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb() } as unknown as Env);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.photos).toHaveLength(2);
    expect(data.photos[0]).toMatchObject({
      id: "p1",
      teamName: "Team A",
      taskTitle: "The Final Civic Act",
      thumbUrl: "/photos/p1/thumb",
      mediumUrl: "/photos/p1/medium",
      fullUrl: "/photos/p1/full",
    });
  });

  it("filters by ?team=", async () => {
    const request = new Request("https://example.com/gallery/democrats_abroad/den_haag/photos?team=Team%20B", {
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(request, { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb() } as unknown as Env);
    const data = await response.json();
    expect(data.photos).toHaveLength(1);
    expect(data.photos[0].id).toBe("p2");
  });
});

describe("GET /gallery/:project/:city/photos/random", () => {
  it("returns 401 when not authenticated", async () => {
    const request = new Request("https://example.com/gallery/democrats_abroad/den_haag/photos/random");
    const response = await worker.fetch(request, { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb() } as unknown as Env);
    expect(response.status).toBe(401);
  });

  it("returns photos for the project+city", async () => {
    const request = new Request("https://example.com/gallery/democrats_abroad/den_haag/photos/random", {
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(request, { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb() } as unknown as Env);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.photos.length).toBeGreaterThan(0);
  });
});

describe("GET /photos/:id/:variant", () => {
  it("returns 401 when not authenticated", async () => {
    const request = new Request("https://example.com/photos/p1/thumb");
    const response = await worker.fetch(request, { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb(), PHOTOS: { get: vi.fn() } } as unknown as Env);
    expect(response.status).toBe(401);
  });

  it("returns 400 for an unknown variant", async () => {
    const request = new Request("https://example.com/photos/p1/huge", {
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(request, { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb(), PHOTOS: { get: vi.fn() } } as unknown as Env);
    expect(response.status).toBe(400);
  });

  it("returns 404 when the photo id is unknown", async () => {
    const request = new Request("https://example.com/photos/missing/thumb", {
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(request, { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb(), PHOTOS: { get: vi.fn() } } as unknown as Env);
    expect(response.status).toBe(404);
  });

  it("returns 404 when the R2 object is missing", async () => {
    const request = new Request("https://example.com/photos/p1/thumb", {
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(request, {
      AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb(), PHOTOS: { get: vi.fn().mockResolvedValue(null) },
    } as unknown as Env);
    expect(response.status).toBe(404);
  });

  it("streams the R2 object body with the correct content type and cache headers for 'full'", async () => {
    const getMock = vi.fn().mockResolvedValue({ body: "fake-body" });
    const request = new Request("https://example.com/photos/p1/full", {
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    const response = await worker.fetch(request, { AUTH_SECRET: TEST_SECRET, AUTH_DB: makeDb(), PHOTOS: { get: getMock } } as unknown as Env);
    expect(response.status).toBe(200);
    expect(getMock).toHaveBeenCalledWith("1_1000/full.jpg");
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toContain("immutable");
  });
});
```

---

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/test/worker.gallery.test.ts`
Expected: FAIL — `/gallery/*` and `/photos/*` routes don't exist yet (fall through to the 404 `ASSETS`/`Not found` branch in `worker.ts`).

---

- [ ] **Step 4: Implement `galleryRoutes.ts`**

Create `src/worker/routes/galleryRoutes.ts`:

```ts
import type { Env } from "../../types/worker";
import type { DbPhoto } from "../db";
import type { GalleryPhoto } from "../../types/gallery";
import { requireAuth } from "../auth";
import { json } from "../utils";
import { listPhotos, randomPhotos, getPhotoById } from "../db";
import { buildVariantKey, PHOTO_VARIANTS, type PhotoVariant } from "../photoKeys";

const RANDOM_SAMPLE_SIZE = 12;

function toGalleryPhoto(photo: DbPhoto): GalleryPhoto {
  return {
    id: photo.id,
    locationId: photo.location_id,
    taskTitle: photo.task_title,
    teamName: photo.team_name,
    uploadedAt: photo.uploaded_at,
    thumbUrl: `/photos/${photo.id}/thumb`,
    mediumUrl: `/photos/${photo.id}/medium`,
    fullUrl: `/photos/${photo.id}/full`,
  };
}

export async function handleGalleryRoutes(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  if (request.method !== "GET") {
    return null;
  }

  const randomMatch = url.pathname.match(/^\/gallery\/([^/]+)\/([^/]+)\/photos\/random$/);
  const listMatch = url.pathname.match(/^\/gallery\/([^/]+)\/([^/]+)\/photos$/);
  const photoMatch = url.pathname.match(/^\/photos\/([^/]+)\/([^/]+)$/);

  if (randomMatch) {
    const authPayload = await requireAuth(request, env);
    if (!authPayload) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const [, project, city] = randomMatch;
    const photos = await randomPhotos(env.AUTH_DB, project, city, RANDOM_SAMPLE_SIZE);
    return json({ ok: true, photos: photos.map(toGalleryPhoto) });
  }

  if (listMatch) {
    const authPayload = await requireAuth(request, env);
    if (!authPayload) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const [, project, city] = listMatch;
    let photos = await listPhotos(env.AUTH_DB, project, city);
    const team = url.searchParams.get("team");
    const task = url.searchParams.get("task");
    if (team) {
      photos = photos.filter((photo) => photo.team_name === team);
    }
    if (task) {
      photos = photos.filter((photo) => photo.task_title === task);
    }
    return json({ ok: true, photos: photos.map(toGalleryPhoto) });
  }

  if (photoMatch) {
    const authPayload = await requireAuth(request, env);
    if (!authPayload) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
    const [, id, variantParam] = photoMatch;
    if (!(PHOTO_VARIANTS as readonly string[]).includes(variantParam)) {
      return json({ ok: false, error: "Unknown variant" }, 400);
    }
    const variant = variantParam as PhotoVariant;
    const photo = await getPhotoById(env.AUTH_DB, id);
    if (!photo) {
      return json({ ok: false, error: "Not found" }, 404);
    }
    const key = buildVariantKey(photo.r2_key, variant);
    const object = await env.PHOTOS.get(key);
    if (!object) {
      return json({ ok: false, error: "Not found" }, 404);
    }
    const contentType = variant === "full" ? photo.mime_type : "image/jpeg";
    return new Response(object.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  return null;
}
```

---

- [ ] **Step 5: Wire the route into `worker.ts`**

In `src/worker.ts`, add the import and chain call:

```ts
import type { Env } from "./types/worker";
import { handleAuthRoutes } from "./worker/routes/authRoutes";
import { handleInviteRoutes } from "./worker/routes/inviteRoutes";
import { handleUploadRoute } from "./worker/routes/uploadRoute";
import { handleFormSubmitRoute } from "./worker/routes/formSubmitRoute";
import { handleGalleryRoutes } from "./worker/routes/galleryRoutes";
import { handleEditorRoutes } from "./worker/routes/editorRoutes";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    return (
      (await handleAuthRoutes(request, url, env)) ??
      (await handleInviteRoutes(request, url, env)) ??
      (await handleUploadRoute(request, url, env)) ??
      (await handleFormSubmitRoute(request, url, env)) ??
      (await handleGalleryRoutes(request, url, env)) ??
      (await handleEditorRoutes(request, url, env)) ??
      (env.ASSETS
        ? env.ASSETS.fetch(request)
        : new Response("Not found", { status: 404 }))
    );
  },
};
```

---

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/test/worker.gallery.test.ts`
Expected: PASS, all tests.

---

- [ ] **Step 7: Run full suite, lint, typecheck**

```bash
npm run test:run
npm run lint
npm run typecheck
```

Expected: all pass, 0 errors.

---

- [ ] **Step 8: Commit**

```bash
git add src/types/gallery.ts src/worker/routes/galleryRoutes.ts src/worker.ts src/test/worker.gallery.test.ts
git commit -m "feat: add gallery list, random sample, and photo-serving routes"
```
