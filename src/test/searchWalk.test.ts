import { describe, it, expect } from "vitest";
import {
  HEAD_ANGLE,
  HEADING_CLAMP,
  ROTATION_STEP_MIN,
  pickChildCount,
  jitterHeading,
  edgeLength,
  splitDurationMs,
  lerpCamera,
  computeChildHeadings,
  ageStep,
  FADE_AFTER_STEPS,
  removeAfterSteps,
  fadeOpacity,
  pickTeleportSpawn,
  isOutsideRadius,
  pickTeamColor,
  TELEPORT_RADIUS,
  SECONDARY_TRAIL_COUNT,
  computeSurvivors,
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
  it("returns a value in [204, 282]", () => {
    expect(edgeLength(seq([0]))).toBe(204);
    expect(edgeLength(seq([1]))).toBe(282);
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
  const DEG = ROTATION_STEP_MIN;

  it("returns exactly the parent heading for k=1 (no fork)", () => {
    const headings = computeChildHeadings(HEAD_ANGLE, 1, seq([0]));
    expect(headings).toEqual([HEAD_ANGLE]);
  });

  it("sweeps k children ROTATION_STEP_MIN degrees apart, re-centred on the parent heading", () => {
    // direction draw -> "left" (-1), then two ROTATION_STEP_MIN (minimum) rotation steps.
    const headings = computeChildHeadings(HEAD_ANGLE, 3, seq([0, 0, 0]));
    expect(headings).toHaveLength(3);
    expect(headings[0]).toBeCloseTo(HEAD_ANGLE + DEG, 5);
    expect(headings[1]).toBeCloseTo(HEAD_ANGLE, 5);
    expect(headings[2]).toBeCloseTo(HEAD_ANGLE - DEG, 5);
  });

  it("flips the sweep direction when the direction draw crosses 0.5", () => {
    const left = computeChildHeadings(HEAD_ANGLE, 2, seq([0, 0]));
    const right = computeChildHeadings(HEAD_ANGLE, 2, seq([0.5, 0]));
    expect(left[0]).toBeCloseTo(-right[0] + 2 * HEAD_ANGLE, 5);
    expect(left[1]).toBeCloseTo(-right[1] + 2 * HEAD_ANGLE, 5);
  });

  it("clamps each child within ±HEADING_CLAMP of the parent heading", () => {
    const extreme = HEAD_ANGLE + 1.1;
    const headings = computeChildHeadings(extreme, 4, seq([1, 1, 1, 1]));
    for (const heading of headings) {
      expect(heading).toBeLessThanOrEqual(extreme + HEADING_CLAMP);
      expect(heading).toBeGreaterThanOrEqual(extreme - HEADING_CLAMP);
    }
  });

  it("preserves distinct directions from different parent headings", () => {
    const above = computeChildHeadings(HEAD_ANGLE + 1.1, 2, seq([0, 0]));
    const below = computeChildHeadings(HEAD_ANGLE - 1.1, 2, seq([0, 0]));
    const meanAbove = above.reduce((a, b) => a + b) / above.length;
    const meanBelow = below.reduce((a, b) => a + b) / below.length;
    expect(meanAbove).toBeGreaterThan(meanBelow);
  });
});

describe("removeAfterSteps", () => {
  it("is 8 by default and 8 for wide viewports", () => {
    expect(removeAfterSteps(false)).toBe(8);
    expect(removeAfterSteps(true)).toBe(8);
  });
});

describe("ageStep", () => {
  it("increments every node's age by 1 per split", () => {
    const next = ageStep([{ id: "a", age: 0 }, { id: "b", age: 6 }]);
    expect(next).toEqual([{ id: "a", age: 1 }, { id: "b", age: 7 }]);
  });

  it("FADE_AFTER_STEPS is 2", () => {
    expect(FADE_AFTER_STEPS).toBe(2);
  });
});

describe("fadeOpacity", () => {
  const LIMIT = removeAfterSteps(false);

  it("is 1.0 before FADE_AFTER_STEPS", () => {
    expect(fadeOpacity(0, false)).toBe(1);
    expect(fadeOpacity(FADE_AFTER_STEPS - 1, false)).toBe(1);
  });

  it("starts fading at FADE_AFTER_STEPS", () => {
    expect(fadeOpacity(FADE_AFTER_STEPS, false)).toBeCloseTo(1, 5);
  });

  it("reaches 0 at the removal boundary", () => {
    expect(fadeOpacity(LIMIT - 1, false)).toBe(0);
  });

  it("clamps to 0 for ages beyond the removal boundary", () => {
    expect(fadeOpacity(LIMIT, false)).toBe(0);
    expect(fadeOpacity(LIMIT + 5, false)).toBe(0);
  });
});

describe("computeSurvivors", () => {
  it("keeps a young node whose parent is also young enough", () => {
    const nodes = [
      { id: "a", current: false, age: 2 },
      { id: "b", current: false, age: 1 },
    ];
    const edges = [{ fromId: "a", toId: "b" }];
    const survivors = computeSurvivors(nodes, edges, 6);
    expect(survivors.has("a")).toBe(true);
    expect(survivors.has("b")).toBe(true);
  });

  it("drops a node whose parent aged out, even though the node itself is still young (regression: orphaned edge)", () => {
    // "a" is at the prune limit and gets removed; "b" is one cycle younger
    // (the gap every backbone generation has from the one after it) and
    // would otherwise survive with its connecting edge (a -> b) gone.
    const nodes = [
      { id: "a", current: false, age: 6 },
      { id: "b", current: false, age: 5 },
    ];
    const edges = [{ fromId: "a", toId: "b" }];
    const survivors = computeSurvivors(nodes, edges, 6);
    expect(survivors.has("a")).toBe(false);
    expect(survivors.has("b")).toBe(false);
  });

  it("keeps the current node regardless of age", () => {
    const nodes = [{ id: "a", current: true, age: 999 }];
    const survivors = computeSurvivors(nodes, [], 6);
    expect(survivors.has("a")).toBe(true);
  });

  it("keeps a root node (no incoming edge) based purely on its own age", () => {
    const nodes = [{ id: "root", current: false, age: 3 }];
    const survivors = computeSurvivors(nodes, [], 6);
    expect(survivors.has("root")).toBe(true);
  });

  it("drops a grandchild whose direct parent independently aged out, even though the grandchild itself is still young", () => {
    const nodes = [
      { id: "a", current: false, age: 3 },
      { id: "b", current: false, age: 6 },
      { id: "c", current: false, age: 1 },
    ];
    const edges = [
      { fromId: "a", toId: "b" },
      { fromId: "b", toId: "c" },
    ];
    const survivors = computeSurvivors(nodes, edges, 6);
    expect(survivors.has("a")).toBe(true);
    expect(survivors.has("b")).toBe(false);
    expect(survivors.has("c")).toBe(false);
  });

  it("never drops the current node, even when its entire ancestor chain has aged out (regression: this previously stalled the walker permanently)", () => {
    // root -> a -> b -> current, with root/a/b all well past the prune limit.
    // The whole backbone behind the head is expected to prune away over
    // time — the live head itself must survive regardless.
    const nodes = [
      { id: "root", current: false, age: 20 },
      { id: "a", current: false, age: 15 },
      { id: "b", current: false, age: 10 },
      { id: "current", current: true, age: 0 },
    ];
    const edges = [
      { fromId: "root", toId: "a" },
      { fromId: "a", toId: "b" },
      { fromId: "b", toId: "current" },
    ];
    const survivors = computeSurvivors(nodes, edges, 6);
    expect(survivors.has("current")).toBe(true);
    expect(survivors.has("root")).toBe(false);
    expect(survivors.has("a")).toBe(false);
    expect(survivors.has("b")).toBe(false);
  });

  it("removing an aged-out generation stays bounded to roughly one generation, not the whole trail (regression: chaining survival through parentage cascaded through the entire tree)", () => {
    // A long chain: root -> g1 -> ... -> g6 -> current, ages descending by 1
    // per generation — exactly how the walker actually ages a backbone.
    const ids = ["root", "g1", "g2", "g3", "g4", "g5", "g6", "current"];
    const nodes = ids.map((id, index) => ({
      id,
      current: id === "current",
      age: id === "current" ? 0 : ids.length - 1 - index,
    }));
    const edges = ids.slice(0, -1).map((id, index) => ({ fromId: id, toId: ids[index + 1] }));
    const survivors = computeSurvivors(nodes, edges, 6);
    const removedCount = nodes.length - survivors.size;
    // root (age 7) and g1 (age 6) age out on their own; g2 additionally
    // drops because its direct parent g1 aged out this same cycle. Nothing
    // beyond that should be affected.
    expect(removedCount).toBe(3);
    expect(survivors.has("current")).toBe(true);
    expect(survivors.has("g3")).toBe(true);
    expect(survivors.has("g6")).toBe(true);
  });
});

describe("pickTeleportSpawn", () => {
  it("places the point exactly `radius` away from the target", () => {
    const { point } = pickTeleportSpawn({ x: 100, y: -50 }, 3500, seq([0.25]));
    expect(Math.hypot(point.x - 100, point.y - (-50))).toBeCloseTo(3500, 5);
  });

  it("aims the heading back at the target", () => {
    const target = { x: 0, y: 0 };
    const { point, heading } = pickTeleportSpawn(target, 1000, seq([0.1]));
    const expectedHeading = Math.atan2(target.y - point.y, target.x - point.x);
    expect(heading).toBeCloseTo(expectedHeading, 5);
  });

  it("constrains the spawn angle to HEAD_ANGLE ± HEADING_CLAMP, same as every other heading in the scene", () => {
    const target = { x: 0, y: 0 };
    const low = pickTeleportSpawn(target, 1000, seq([0])).point;
    const high = pickTeleportSpawn(target, 1000, seq([1])).point;
    expect(Math.atan2(low.y - target.y, low.x - target.x)).toBeCloseTo(HEAD_ANGLE - HEADING_CLAMP, 5);
    expect(Math.atan2(high.y - target.y, high.x - target.x)).toBeCloseTo(HEAD_ANGLE + HEADING_CLAMP, 5);
  });

  it("never spawns outside that cone, across the full random range", () => {
    const target = { x: 0, y: 0 };
    for (let i = 0; i <= 10; i++) {
      const { point } = pickTeleportSpawn(target, 1000, seq([i / 10]));
      const angle = Math.atan2(point.y - target.y, point.x - target.x);
      expect(angle).toBeGreaterThanOrEqual(HEAD_ANGLE - HEADING_CLAMP - 1e-9);
      expect(angle).toBeLessThanOrEqual(HEAD_ANGLE + HEADING_CLAMP + 1e-9);
    }
  });
});

describe("isOutsideRadius", () => {
  it("is false exactly at and inside the radius", () => {
    expect(isOutsideRadius({ x: 500, y: 0 }, { x: 0, y: 0 }, 500)).toBe(false);
    expect(isOutsideRadius({ x: 100, y: 0 }, { x: 0, y: 0 }, 500)).toBe(false);
  });

  it("is true beyond the radius", () => {
    expect(isOutsideRadius({ x: 501, y: 0 }, { x: 0, y: 0 }, 500)).toBe(true);
  });
});

describe("pickTeamColor", () => {
  it("returns the first color for the bottom of the random range", () => {
    expect(pickTeamColor(["a", "b", "c"], seq([0]))).toBe("a");
  });
  it("returns the last color for the top of the random range", () => {
    expect(pickTeamColor(["a", "b", "c"], seq([0.999]))).toBe("c");
  });
});

describe("teleport constants", () => {
  it("SECONDARY_TRAIL_COUNT is 3", () => {
    expect(SECONDARY_TRAIL_COUNT).toBe(3);
  });
  it("TELEPORT_RADIUS is a positive number", () => {
    expect(TELEPORT_RADIUS).toBeGreaterThan(0);
  });
});
