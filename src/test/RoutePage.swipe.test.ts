import { describe, test, expect } from "vitest";
import { clampedNext, clampedPrev, shouldCommitSwipe, elasticOffset } from "../utils/routeNav";

test("clampedNext advances index", () => {
  expect(clampedNext(0, 3)).toBe(1);
});

test("clampedNext clamps at last", () => {
  expect(clampedNext(2, 3)).toBe(2);
});

test("clampedPrev retreats index", () => {
  expect(clampedPrev(2)).toBe(1);
});

test("clampedPrev clamps at zero", () => {
  expect(clampedPrev(0)).toBe(0);
});

describe("shouldCommitSwipe", () => {
  test("returns true when |delta| >= 30% of cardWidth", () => {
    expect(shouldCommitSwipe(90, 300)).toBe(true);   // exactly 30%
    expect(shouldCommitSwipe(-90, 300)).toBe(true);  // negative direction
    expect(shouldCommitSwipe(120, 300)).toBe(true);  // more than 30%
  });

  test("returns false when |delta| < 30% of cardWidth", () => {
    expect(shouldCommitSwipe(89, 300)).toBe(false);
    expect(shouldCommitSwipe(-89, 300)).toBe(false);
    expect(shouldCommitSwipe(0, 300)).toBe(false);
  });
});

describe("elasticOffset", () => {
  test("dampens to 20% of input", () => {
    expect(elasticOffset(100)).toBe(20);
    expect(elasticOffset(-50)).toBe(-10);
    expect(elasticOffset(0)).toBe(0);
  });
});
