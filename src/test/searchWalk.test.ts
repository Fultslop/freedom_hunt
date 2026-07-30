import { describe, it, expect } from "vitest";
import {
  HEAD_ANGLE,
  pickChildCount,
  angularSpacing,
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
  it("returns 2 for the bottom 30% of the random range", () => {
    expect(pickChildCount(seq([0.0]))).toBe(2);
    expect(pickChildCount(seq([0.29]))).toBe(2);
  });
  it("returns 3 for the next 38%", () => {
    expect(pickChildCount(seq([0.3]))).toBe(3);
    expect(pickChildCount(seq([0.67]))).toBe(3);
  });
  it("returns 4 for the remaining 32%", () => {
    expect(pickChildCount(seq([0.68]))).toBe(4);
    expect(pickChildCount(seq([0.999]))).toBe(4);
  });
});

describe("angularSpacing", () => {
  it("uses the base value for k=2 plus jitter in [0, 0.12)", () => {
    const spacing = angularSpacing(2, seq([0]));
    expect(spacing).toBeCloseTo(0.74, 5);
    const spacingJittered = angularSpacing(2, seq([1]));
    expect(spacingJittered).toBeCloseTo(0.74 + 0.12, 5);
  });
  it("uses the base value for k=3", () => {
    expect(angularSpacing(3, seq([0]))).toBeCloseTo(0.6, 5);
  });
  it("uses the base value for k=4", () => {
    expect(angularSpacing(4, seq([0]))).toBeCloseTo(0.5, 5);
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
  it("returns k headings, evenly fanned around the parent heading by the spacing", () => {
    const headings = computeChildHeadings(HEAD_ANGLE, 3, seq([0, 0, 0, 0, 0]));
    expect(headings).toHaveLength(3);
    expect(headings[0]).toBeCloseTo(HEAD_ANGLE - 0.6, 4);
    expect(headings[1]).toBeCloseTo(HEAD_ANGLE, 4);
    expect(headings[2]).toBeCloseTo(HEAD_ANGLE + 0.6, 4);
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
