import '@testing-library/jest-dom/vitest'

// Mock localStorage for all tests (ThemeContext, FontSizeContext, etc.)
globalThis.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
