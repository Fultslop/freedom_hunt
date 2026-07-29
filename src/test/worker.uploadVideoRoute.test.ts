// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../worker";
import { createToken } from "../worker/auth";
import type { TokenPayload } from "../types/auth";
import type { Env } from "../types/worker";

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

function makeVideoFormData(videoBytes = new Uint8Array([1, 2, 3])) {
  return {
    get: (key: string) => {
      const values: Record<string, unknown> = {
        video: { type: "video/webm", arrayBuffer: async () => videoBytes.buffer },
        poster: { type: "image/jpeg", arrayBuffer: async () => new Uint8Array([9, 9]).buffer },
        locationId: "5",
        cityId: "den_haag",
        routeId: "short_loop",
        taskTitle: "Hear the Voices",
      };
      return values[key] ?? null;
    },
  };
}

describe("/upload-video", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns 401 when not authenticated", async () => {
    const env = {
      AUTH_SECRET: TEST_SECRET,
      PHOTOS: { put: vi.fn() },
      AUTH_DB: {},
    } as unknown as Env;
    const request = new Request("https://example.com/upload-video", {
      method: "POST",
      body: makeVideoFormData(),
      headers: {},
    });
    request.formData = vi.fn().mockResolvedValue(makeVideoFormData());
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(401);
  });

  it("stores the poster variants and the raw video, and inserts a photos row with kind='video'", async () => {
    vi.mocked(generateVariants).mockReturnValue({
      thumb: new Uint8Array([1]),
      medium: new Uint8Array([2]),
      full: new Uint8Array([3]),
      mimeType: "image/jpeg",
    });
    const putMock = vi.fn().mockResolvedValue(undefined);
    const runMock = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const bindArgs: unknown[] = [];
    const env = {
      AUTH_SECRET: TEST_SECRET,
      PHOTOS: { put: putMock },
      AUTH_DB: {
        prepare: () => ({
          bind: (...args: unknown[]) => {
            bindArgs.push(...args);
            return { run: runMock };
          },
        }),
      },
    } as unknown as Env;
    const request = new Request("https://example.com/upload-video", {
      method: "POST",
      body: makeVideoFormData(),
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    request.formData = vi.fn().mockResolvedValue(makeVideoFormData());
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    // 3 poster variants (thumb/medium/full) + 1 raw video object
    expect(putMock).toHaveBeenCalledTimes(4);
    expect(putMock.mock.calls.some(([key]: [string]) => key.endsWith("video.webm"))).toBe(true);
    expect(runMock).toHaveBeenCalledOnce();
    expect(bindArgs[bindArgs.length - 1]).toBe("video");
  });

  it("rejects an oversized video before writing anything to R2", async () => {
    const hugeBytes = new Uint8Array(16 * 1024 * 1024);
    const putMock = vi.fn();
    const env = {
      AUTH_SECRET: TEST_SECRET,
      PHOTOS: { put: putMock },
      AUTH_DB: { prepare: () => ({ bind: () => ({ run: vi.fn() }) }) },
    } as unknown as Env;
    const request = new Request("https://example.com/upload-video", {
      method: "POST",
      body: makeVideoFormData(hugeBytes),
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    request.formData = vi.fn().mockResolvedValue(makeVideoFormData(hugeBytes));
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(400);
    expect(putMock).not.toHaveBeenCalled();
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
    const request = new Request("https://example.com/upload-video", {
      method: "POST",
      body: makeVideoFormData(),
      headers: { Cookie: `freedom_hunt_auth=${authToken}` },
    });
    request.formData = vi.fn().mockResolvedValue(makeVideoFormData());
    const response = await worker.fetch(request, env);
    expect(response.status).toBe(500);
  });
});
