// @ts-nocheck
import { describe, it, expect } from "vitest";
import { createToken, verifyToken, checkRateLimit } from "../worker/auth";
import type { TokenPayload } from "../types/auth";

const SECRET = "test-secret";
const now = () => Math.floor(Date.now() / 1000);

describe("createToken / verifyToken", () => {
  it("round-trips a payload", async () => {
    const payload: TokenPayload = {
      project: "p",
      teamName: "t",
      contact: "c",
      isAdmin: false,
      exp: now() + 3600,
    };
    const token = await createToken(payload, SECRET);
    const result = await verifyToken(token, SECRET);
    expect(result?.project).toBe("p");
  });

  it("returns null for an expired token", async () => {
    const payload: TokenPayload = {
      project: "p",
      teamName: "t",
      contact: "c",
      isAdmin: false,
      exp: now() - 1,
    };
    const token = await createToken(payload, SECRET);
    expect(await verifyToken(token, SECRET)).toBeNull();
  });

  it("returns null for a tampered token", async () => {
    const payload: TokenPayload = {
      project: "p",
      teamName: "t",
      contact: "c",
      isAdmin: false,
      exp: now() + 3600,
    };
    const token = await createToken(payload, SECRET);
    const tampered = token.slice(0, -4) + "xxxx";
    expect(await verifyToken(tampered, SECRET)).toBeNull();
  });

  it("returns null when signed with the wrong secret", async () => {
    const payload: TokenPayload = {
      project: "p",
      teamName: "t",
      contact: "c",
      isAdmin: false,
      exp: now() + 3600,
    };
    const token = await createToken(payload, SECRET);
    expect(await verifyToken(token, "wrong-secret")).toBeNull();
  });

  it("returns null for a token without a dot separator", async () => {
    expect(await verifyToken("nodot", SECRET)).toBeNull();
  });
});

describe("checkRateLimit", () => {
  const makeStore = () => {
    const data = {};
    return {
      get: async (k) => data[k] ?? null,
      put: async (k, v) => {
        data[k] = v;
      },
    };
  };

  it("allows the first 5 requests within the window", async () => {
    const env = { AUTH_STORE: makeStore() };
    for (let i = 0; i < 5; i++) {
      expect(await checkRateLimit("10.0.0.1", env)).toBe(false);
    }
  });

  it("blocks the 6th request within the window", async () => {
    const env = { AUTH_STORE: makeStore() };
    for (let i = 0; i < 5; i++) await checkRateLimit("10.0.0.2", env);
    expect(await checkRateLimit("10.0.0.2", env)).toBe(true);
  });

  it("resets the counter after the 60-second window expires", async () => {
    const store = makeStore();
    await store.put(
      "rl:10.0.0.3",
      JSON.stringify({ count: 5, windowStart: Date.now() - 61_000 }),
    );
    const env = { AUTH_STORE: store };
    expect(await checkRateLimit("10.0.0.3", env)).toBe(false);
  });
});
