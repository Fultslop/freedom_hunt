import { describe, it, expect } from "vitest";
import {
  HEAD_ANGLE,
  pickChildCount,
  jitterHeading,
  edgeLength,
  splitDurationMs,
  lerpCamera,
  computeChildHeadings,
  ageStep,
  FADE_AFTER_STEPS,
  removeAfterSteps,
} from "../utils/searchWalk";

function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("pickChildCount", () => {
  it("returns 1 for the bottom 15% of the random range", () => {
    expect(pickChildCount(seq([0.0]))).toBe(1);
    expect(pickChildCount(seq([0.14]))).toBe(1);
  });
  it("returns 2 for the next 25%", () => {
    expect(pickChildCount(seq([0.15]))).toBe(2);
    expect(pickChildCount(seq([0.39]))).toBe(2);
  });
  it("returns 3 for the next 35%", () => {
    expect(pickChildCount(seq([0.4]))).toBe(3);
    expect(pickChildCount(seq([0.74]))).toBe(3);
  });
  it("returns 4 for the remaining 25%", () => {
    expect(pickChildCount(seq([0.75]))).toBe(4);
    expect(pickChildCount(seq([0.999]))).toBe(4);
  });
});

describe("jitterHeading", () => {
  it("jitters within ±0.275 of the base heading", () => {
    const max = jitterHeading(HEAD_ANGLE, seq([1]));
    const min = jitterHeading(HEAD_ANGLE, seq([0]));
    expect(max - HEAD_ANGLE).toBeCloseTo(0.275, 5);
    expect(min - HEAD_ANGLE).toBeCloseTo(-0.275, 5);
  });
  it("clamps to within ±1.15 of straight-ahead even from an extreme base heading", () => {
    const extreme = HEAD_ANGLE + 2;
    const result = jitterHeading(extreme, seq([0.5]));
    expect(result).toBeLessThanOrEqual(HEAD_ANGLE + 1.15);
    expect(result).toBeGreaterThanOrEqual(HEAD_ANGLE - 1.15);
  });
});

describe("edgeLength", () => {
  it("returns a value in [68, 94]", () => {
    expect(edgeLength(seq([0]))).toBe(68);
    expect(edgeLength(seq([1]))).toBe(94);
  });
});

describe("splitDurationMs", () => {
  it("matches (k-1) * 330 + 450", () => {
    expect(splitDurationMs(1)).toBe(450);
    expect(splitDurationMs(2)).toBe(780);
    expect(splitDurationMs(3)).toBe(1110);
    expect(splitDurationMs(4)).toBe(1440);
  });
});

describe("lerpCamera", () => {
  it("moves the camera 4.5% of the remaining distance toward the target by default", () => {
    const next = lerpCamera({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(next.x).toBeCloseTo(4.5, 5);
    expect(next.y).toBeCloseTo(0, 5);
  });
  it("accepts a custom factor", () => {
    const next = lerpCamera({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.5);
    expect(next.x).toBeCloseTo(50, 5);
  });
});

describe("computeChildHeadings", () => {
  const DEG15 = (15 * Math.PI) / 180;

  it("returns exactly the parent heading for k=1 (no fork)", () => {
    const headings = computeChildHeadings(HEAD_ANGLE, 1, seq([0]));
    expect(headings).toEqual([HEAD_ANGLE]);
  });

  it("sweeps k children 15-30 degrees apart, re-centred on the parent heading", () => {
    // direction draw -> "left" (-1), then two 15deg (minimum) rotation steps.
    const headings = computeChildHeadings(HEAD_ANGLE, 3, seq([0, 0, 0]));
    expect(headings).toHaveLength(3);
    expect(headings[0]).toBeCloseTo(HEAD_ANGLE + DEG15, 5);
    expect(headings[1]).toBeCloseTo(HEAD_ANGLE, 5);
    expect(headings[2]).toBeCloseTo(HEAD_ANGLE - DEG15, 5);
  });

  it("flips the sweep direction when the direction draw crosses 0.5", () => {
    const left = computeChildHeadings(HEAD_ANGLE, 2, seq([0, 0]));
    const right = computeChildHeadings(HEAD_ANGLE, 2, seq([0.5, 0]));
    expect(left[0]).toBeCloseTo(-right[0] + 2 * HEAD_ANGLE, 5);
    expect(left[1]).toBeCloseTo(-right[1] + 2 * HEAD_ANGLE, 5);
  });

  it("still clamps to within ±1.15 of straight-ahead from an extreme parent heading", () => {
    const extreme = HEAD_ANGLE + 1.1;
    const headings = computeChildHeadings(extreme, 4, seq([1, 1, 1, 1]));
    for (const heading of headings) {
      expect(heading).toBeLessThanOrEqual(HEAD_ANGLE + 1.15);
      expect(heading).toBeGreaterThanOrEqual(HEAD_ANGLE - 1.15);
    }
  });
});

describe("removeAfterSteps", () => {
  it("is 13 by default and 18 for wide viewports", () => {
    expect(removeAfterSteps(false)).toBe(13);
    expect(removeAfterSteps(true)).toBe(18);
  });
});

describe("ageStep", () => {
  it("increments every node's age by 1 per split", () => {
    const next = ageStep([{ id: "a", age: 0 }, { id: "b", age: 6 }]);
    expect(next).toEqual([{ id: "a", age: 1 }, { id: "b", age: 7 }]);
  });

  it("FADE_AFTER_STEPS is 7", () => {
    expect(FADE_AFTER_STEPS).toBe(7);
  });
});
