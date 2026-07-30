import { describe, it, expect } from "vitest";
import { pickPlaceName, PLACE_NAMES } from "../utils/placeNames";

describe("pickPlaceName", () => {
  it("returns a name from PLACE_NAMES", () => {
    const name = pickPlaceName(new Set());
    expect(PLACE_NAMES).toContain(name);
  });

  it("avoids names already in the `used` set when an unused one exists", () => {
    const used = new Set(PLACE_NAMES.slice(0, PLACE_NAMES.length - 1));
    const name = pickPlaceName(used);
    expect(name).toBe(PLACE_NAMES[PLACE_NAMES.length - 1]);
  });

  it("falls back to a repeat once every name is used", () => {
    const used = new Set(PLACE_NAMES);
    const name = pickPlaceName(used);
    expect(PLACE_NAMES).toContain(name);
  });
});
