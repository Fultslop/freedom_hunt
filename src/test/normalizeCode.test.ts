import { describe, it, expect } from "vitest";
import { normalizeCode } from "../utils/normalizeCode";

describe("normalizeCode", () => {
  it("uppercases", () => {
    expect(normalizeCode("abc123")).toBe("ABC123");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeCode("  abc123  ")).toBe("ABC123");
  });

  it("strips internal dashes, underscores, and spaces", () => {
    expect(normalizeCode("da-hague")).toBe("DAHAGUE");
    expect(normalizeCode("da_hague")).toBe("DAHAGUE");
    expect(normalizeCode("da hague")).toBe("DAHAGUE");
  });

  it("treats all separator variants of the same code as equal", () => {
    expect(normalizeCode("DA-HAGUE")).toBe(normalizeCode("da_hague"));
    expect(normalizeCode(" Da Hague ")).toBe(normalizeCode("DAHAGUE"));
  });

  it("returns an empty string for empty or whitespace-only input", () => {
    expect(normalizeCode("")).toBe("");
    expect(normalizeCode("   ")).toBe("");
  });
});
