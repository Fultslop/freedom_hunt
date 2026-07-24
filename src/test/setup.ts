/// <reference types="vitest/globals" />
import "@testing-library/jest-dom/vitest";
import { Request as NodeRequest } from "undici";
import { cleanup } from "@testing-library/svelte/svelte5";

// happy-dom v20 enforces the Fetch spec's forbidden request headers, silently
// dropping Cookie from new Request(). Cloudflare Workers have no such restriction,
// so restore the Node.js-native undici Request for the worker auth tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).Request = NodeRequest;

// Force DOM cleanup after every test (belt-and-suspenders alongside
// @testing-library/svelte's own auto-cleanup).
afterEach(cleanup);

// @cf-wasm/photon/workerd can't load in plain Node (WASM import). Registered
// once here (rather than duplicated per-file) since every Worker test file
// that imports imageProcessing.ts, directly or transitively, needs it.
class FakePhotonImage {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
  get_width() {
    return this.width;
  }
  get_height() {
    return this.height;
  }
  get_bytes_jpeg(_quality: number) {
    return new Uint8Array([this.width, this.height, Math.round(_quality * 100)]);
  }
  free() {
    /* no-op */
  }
}

vi.mock("@cf-wasm/photon/workerd", () => ({
  PhotonImage: {
    new_from_byteslice: vi.fn(() => new FakePhotonImage(4000, 3000)),
  },
  resize: vi.fn(
    (_image: FakePhotonImage, width: number, height: number) => new FakePhotonImage(width, height),
  ),
  rotate: vi.fn(
    (image: FakePhotonImage, _angle: number) => new FakePhotonImage(image.height, image.width),
  ),
  fliph: vi.fn(),
  flipv: vi.fn(),
  SamplingFilter: { Lanczos3: 5 },
}));

const _store: Record<string, string> = {};

globalThis.localStorage = {
  getItem: vi.fn((key: string) =>
    Object.prototype.hasOwnProperty.call(_store, key) ? _store[key] : null,
  ),
  setItem: vi.fn((key: string, value: string) => {
    _store[key] = String(value);
  }),
  removeItem: vi.fn((key: string) => {
    delete _store[key];
  }),
  clear: vi.fn(() => {
    Object.keys(_store).forEach((k) => {
      delete _store[k];
    });
  }),
} as unknown as Storage;
