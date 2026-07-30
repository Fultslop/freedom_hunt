export const HEAD_ANGLE = -Math.PI / 2;
const HEADING_CLAMP = 1.15;
const ROTATION_STEP_MIN = (15 * Math.PI) / 180;
const ROTATION_STEP_MAX = (30 * Math.PI) / 180;

export interface Point {
  x: number;
  y: number;
}

/** 1 child 15% of the time, 2 children 25%, 3 children 35%, 4 children 25%. */
export function pickChildCount(rand: () => number = Math.random): 1 | 2 | 3 | 4 {
  const val = rand();
  if (val < 0.15) { return 1; }
  if (val < 0.4) { return 2; }
  if (val < 0.75) { return 3; }
  return 4;
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

/** Edge length in px, uniform in [204, 282] (3x the original [68, 94] — makes the walk read as closer without touching the camera). */
export function edgeLength(rand: () => number = Math.random): number {
  return 204 + rand() * (282 - 204);
}

/** Total time (ms) for a k-way split to fully resolve: (k - 1) * 330 + 450. */
export function splitDurationMs(k: 1 | 2 | 3 | 4): number {
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
 * Builds k child headings as a one-directional sweep off `parentHeading`,
 * rather than a mirrored fan: draw a turn direction (left or right, fresh
 * every call), then lay each successive child 15-30 degrees further around
 * in that direction. A mirrored fan always places a pair of children at the
 * exact same angular distance either side of the parent — over many splits
 * that regularity is what let sibling branches from different parents
 * converge on the same spot and cross. A one-directional sweep spreads
 * successive children out instead, so consecutive edges fan across the
 * available space rather than doubling back on each other.
 *
 * The sweep is then re-centred on `parentHeading` (its own average
 * subtracted out) so a long run of splits still tracks the general
 * direction of travel — the turn direction is redrawn every split rather
 * than committed for the whole walk, so it can't compound into a spiral.
 *
 * `rand` is called once for the direction draw and once per extra child
 * (`k - 1` times) for the rotation step — pass a `rand` that yields at
 * least `k` values for a fully deterministic test.
 */
export function computeChildHeadings(
  parentHeading: number,
  k: 1 | 2 | 3 | 4,
  rand: () => number = Math.random,
): number[] {
  const direction = rand() < 0.5 ? -1 : 1;
  const offsets: number[] = [0];
  for (let i = 1; i < k; i++) {
    const step = ROTATION_STEP_MIN + rand() * (ROTATION_STEP_MAX - ROTATION_STEP_MIN);
    offsets.push(offsets[i - 1] + direction * step);
  }
  const mean = offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
  return offsets.map((value) => clampToHeadingRange(parentHeading + (value - mean)));
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
