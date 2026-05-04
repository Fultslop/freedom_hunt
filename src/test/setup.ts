/// <reference types="vitest/globals" />
import "@testing-library/jest-dom/vitest";

globalThis.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
} as unknown as Storage;
