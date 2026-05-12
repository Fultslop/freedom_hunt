/// <reference types="vitest/globals" />
import "@testing-library/jest-dom/vitest";
import { Request as NodeRequest } from "undici";
import { cleanup } from "@testing-library/svelte/svelte5";

// happy-dom v20 enforces the Fetch spec's forbidden request headers, silently
// dropping Cookie from new Request(). Cloudflare Workers have no such restriction,
// so restore the Node.js-native undici Request for the worker auth tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).Request = NodeRequest;

// With isolate: false, @testing-library/svelte's auto-cleanup doesn't run between
// test files, so rendered components accumulate in document.body. Force cleanup after
// every test to prevent DOM pollution across file boundaries.
afterEach(cleanup);

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
