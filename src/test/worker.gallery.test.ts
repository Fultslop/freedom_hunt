// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../worker";
import { createToken } from "../worker/auth";
import type { TokenPayload } from "../types/auth";
import type { Env } from "../types/worker";

// worker.ts → uploadRoute.ts → imageProcessing.ts → @cf-wasm/photon/workerd
vi.mock("@cf-wasm/photon/workerd", () => ({
  PhotonImage: { new_from_byteslice: vi.fn() },
  resize: vi.fn(),
  rotate: vi.fn(),
  fliph: vi.fn(),
  flipv: vi.fn(),
  SamplingFilter: { Lanczos3: 5 },
}));

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
