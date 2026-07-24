// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../worker";
import { createToken } from "../worker/auth";
import type { TokenPayload } from "../types/auth";
import type { Env } from "../types/worker";

// Hoisted mock: the upload route statically imports imageProcessing which
// imports @cf-wasm/photon/workerd.  We also mock imageProcessing itself so
// each test controls generateVariants behaviour without a real WASM runtime.
class FakePhotonImage {
  width: number; height: number;
  constructor(width: number, height: number) { this.width = width; this.height = height; }
  get_width() { return this.width; }
  get_height() { return this.height; }
  get_bytes_jpeg(_quality: number) { return new Uint8Array([this.width, this.height]); }
  free() {}
}
vi.mock("@cf-wasm/photon/workerd", () => ({
  PhotonImage: { new_from_byteslice: vi.fn(() => new FakePhotonImage(4000, 3000)) },
  resize: vi.fn((_img: unknown, w: number, h: number) => new FakePhotonImage(w, h)),
  rotate: vi.fn((img: FakePhotonImage) => new FakePhotonImage(img.height, img.width)),
  fliph: vi.fn(),
  flipv: vi.fn(),
  SamplingFilter: { Lanczos3: 5 },
}));
vi.mock("../worker/imageProcessing", () => ({
  generateVariants: vi.fn(),
}));

import { generateVariants } from "../worker/imageProcessing";

const TEST_SECRET = "test-secret";
const TEST_PAYLOAD: TokenPayload = {
  project: "test_project",
  teamName: "Team A",
  contact: "a@b.com",
  isAdmin: false,
  exp: Math.floor(Date.now() / 1000) + 3600,
};

let authToken: string;
beforeEach(async () => {
  authToken = await createToken(TEST_PAYLOAD, TEST_SECRET);
  vi.mocked(generateVariants).mockReset();
});

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

describe("/upload", () => {
  afterEach(() => vi.restoreAllMocks());

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
    vi.mocked(generateVariants).mockReturnValue({
      thumb: new Uint8Array([1]),
      medium: new Uint8Array([2]),
      full: new Uint8Array([3]),
      mimeType: "image/jpeg",
    });
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
    vi.mocked(generateVariants).mockImplementation(() => {
      throw new Error("unsupported format");
    });
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
    expect(putMock).toHaveBeenCalledTimes(1);
    expect(runMock).toHaveBeenCalledOnce();
  });

  it("returns 500 when R2 put throws", async () => {
    vi.mocked(generateVariants).mockReturnValue({
      thumb: new Uint8Array([1]),
      medium: new Uint8Array([2]),
      full: new Uint8Array([3]),
      mimeType: "image/jpeg",
    });
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
