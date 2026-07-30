export const HEAD_ANGLE = -Math.PI / 2;
const HEADING_CLAMP = 1.15;

export interface Point {
  x: number;
  y: number;
}

/** 2 children 30% of the time, 3 children 38%, 4 children 32%. */
export function pickChildCount(rand: () => number = Math.random): 2 | 3 | 4 {
  const val = rand();
  if (val < 0.3) { return 2; }
  if (val < 0.68) { return 3; }
  return 4;
}

const BASE_SPACING: Record<2 | 3 | 4, number> = { 2: 0.74, 3: 0.6, 4: 0.5 };

/** Angular gap between adjacent children for a k-way split, plus rand(0, 0.12) jitter. */
export function angularSpacing(k: 2 | 3 | 4, rand: () => number = Math.random): number {
  return BASE_SPACING[k] + rand() * 0.12;
}

function clampToHeadingRange(angle: number): number {
  const min = HEAD_ANGLE - HEADING_CLAMP;
  const max = HEAD_ANGLE + HEADING_CLAMP;
  return Math.min(max, Math.max(min, angle));
}

/** Jitters a base heading by up to ±0.275 rad, then clamps within ±1.15 of straight-ahead. */
export function jitterHeading(baseHeading: number, rand: () => number = Math.random): number {
  const jitter = (rand() * 2 - 1) * 0.275;
  return clampToHeadingRange(baseHeading + jitter);
}

/** Edge length in px, uniform in [68, 94]. */
export function edgeLength(rand: () => number = Math.random): number {
  return 68 + rand() * (94 - 68);
}

/** Total time (ms) for a k-way split to fully resolve: (k - 1) * 330 + 450. */
export function splitDurationMs(k: 2 | 3 | 4): number {
  return (k - 1) * 330 + 450;
}

/** Moves `cam` a fraction of the way toward `target`. Default factor 0.045/frame. */
export function lerpCamera(cam: Point, target: Point, factor = 0.045): Point {
  return {
    x: cam.x + (target.x - cam.x) * factor,
    y: cam.y + (target.y - cam.y) * factor,
  } as Point;
}

/**
 * Returns k headings fanned evenly around `parentHeading`, `spacing` radians
 * apart (see `angularSpacing`), each further jittered by `jitterHeading`.
 * `rand` is called once for the spacing draw and once per child for jitter —
 * pass a `rand` that yields at least `1 + k` values for a fully deterministic test.
 */
export function computeChildHeadings(
  parentHeading: number,
  k: 2 | 3 | 4,
  rand: () => number = Math.random,
): number[] {
  const spacing = angularSpacing(k, rand);
  const span = spacing * (k - 1);
  const start = parentHeading - span / 2;
  const headings: number[] = [];
  for (let i = 0; i < k; i++) {
    headings.push(clampToHeadingRange(start + i * spacing));
  }
  return headings;
}

export const FADE_AFTER_STEPS = 7;
const REMOVE_AFTER_STEPS_DEFAULT = 13;
const REMOVE_AFTER_STEPS_WIDE = 18;

/** 18 at >= 1200px viewports (spec §2), 13 otherwise. */
export function removeAfterSteps(isWideViewport: boolean): number {
  return isWideViewport ? REMOVE_AFTER_STEPS_WIDE : REMOVE_AFTER_STEPS_DEFAULT;
}

export interface AgingNode {
  id: string;
  age: number;
}

/** Advances every node's age by one split. Caller filters/fades based on the result. */
export function ageStep<T extends AgingNode>(nodes: T[]): T[] {
  return nodes.map((node) => ({ ...node, age: node.age + 1 }));
}
