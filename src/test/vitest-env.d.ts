/// <reference types="vitest/globals" />

declare const fetch: ReturnType<typeof vi.fn>;
declare function globalThisfetch(_input: RequestInfo | URL, _init?: RequestInit): Promise<unknown>;
declare namespace globalThis {
  const fetch: typeof globalThisfetch;
}
