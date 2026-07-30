export const HEAD_ANGLE = -Math.PI / 2;
export const HEADING_CLAMP = 1.15;
export const ROTATION_STEP_MIN = (25 * Math.PI) / 180;
const ROTATION_STEP_MAX = (45 * Math.PI) / 180;

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

export function clampToHeadingRange(angle: number): number {
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
  noClamp?: boolean,
): number[] {
  const direction = rand() < 0.5 ? -1 : 1;
  const offsets: number[] = [0];
  for (let i = 1; i < k; i++) {
    const step = ROTATION_STEP_MIN + rand() * (ROTATION_STEP_MAX - ROTATION_STEP_MIN);
    offsets.push(offsets[i - 1] + direction * step);
  }
  const mean = offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
  const raw = offsets.map((value) => parentHeading + (value - mean));
  return noClamp ? raw : raw.map((heading) => clampRelative(heading, parentHeading));
}

/** Clamp an angle to within `HEADING_CLAMP` of a given center. */
function clampRelative(angle: number, center: number): number {
  const min = center - HEADING_CLAMP;
  const max = center + HEADING_CLAMP;
  return Math.min(max, Math.max(min, angle));
}

export const FADE_AFTER_STEPS = 2;
const REMOVE_AFTER_STEPS_DEFAULT = 8;
const REMOVE_AFTER_STEPS_WIDE = 8;

/** 18 at >= 1200px viewports (spec §2), 13 otherwise. */
export function removeAfterSteps(isWideViewport: boolean): number {
  return isWideViewport ? REMOVE_AFTER_STEPS_WIDE : REMOVE_AFTER_STEPS_DEFAULT;
}

/** Interpolated opacity for a node/pin: 1.0 from age 0 to FADE_AFTER_STEPS,
 * then fades linearly to 0.0 at the removal boundary. */
export function fadeOpacity(age: number, isWide: boolean): number {
  if (age < FADE_AFTER_STEPS) { return 1; }
  const limit = removeAfterSteps(isWide);
  const range = limit - 1 - FADE_AFTER_STEPS;
  if (range <= 0) { return 0; }
  return Math.max(0, 1 - (age - FADE_AFTER_STEPS) / range);
}

export interface AgingNode {
  id: string;
  age: number;
}

/** Advances every node's age by one split. Caller filters/fades based on the result. */
export function ageStep<T extends AgingNode>(nodes: T[]): T[] {
  return nodes.map((node) => ({ ...node, age: node.age + 1 }));
}

export interface PruneNode {
  id: string;
  current: boolean;
  age: number;
}
export interface PruneEdge {
  fromId: string;
  toId: string;
}

/**
 * Computes which node ids survive a prune pass.
 *
 * Pass 1 is the original rule, unchanged: each node ages out purely on its
 * own age, independently of every other node (current is always exempt).
 * This must stay flat and per-node, not chained through "does my parent also
 * survive" — every node in a walker's tree ultimately traces back to one
 * root, so chaining survival through parentage means the single oldest node
 * aging out cascades through everything descended from it, wiping the
 * entire trail behind the current head in one pass instead of the gradual,
 * one-generation-at-a-time aging this is supposed to be.
 *
 * Pass 2 fixes the one real gap pass 1 leaves: because each new generation
 * of dead-end siblings starts aging exactly one split cycle later than the
 * generation before it, a node can still be young enough to survive pass 1
 * the very cycle its own direct parent ages out — surviving with no
 * connecting edge, since edges only survive when both endpoints do. Pass 2
 * drops those too, but only checks one hop back against pass 1's own result
 * (not the survivor set being built), so it never cascades past "the
 * node(s) that just lost their parent this cycle" — pruning stays bounded
 * to roughly one aged-out generation plus its immediate children, not the
 * whole ancestry.
 */
export function computeSurvivors<N extends PruneNode>(
  nodes: N[],
  edges: PruneEdge[],
  limit: number,
): Set<string> {
  const ageSurvivors = new Set(
    nodes.filter((node) => node.current || node.age < limit).map((node) => node.id),
  );

  const parentOf = new Map<string, string>();
  for (const edge of edges) {
    parentOf.set(edge.toId, edge.fromId);
  }
  const survivors = new Set<string>();
  for (const node of nodes) {
    if (ageSurvivors.has(node.id)) {
      const parentId = parentOf.get(node.id);
      const parentOk = node.current || parentId === undefined || ageSurvivors.has(parentId);
      if (parentOk) {
        survivors.add(node.id);
      }
    }
  }
  return survivors;
}

/** World-px radius, centered on the primary trail's current head, that a
 * secondary trail must stay within before it teleports back in. Sized to
 * roughly the same order of magnitude as the primary trail's own visible
 * fringe reach (removeAfterSteps × edgeLength, ~3000-4300 world-px) rather
 * than an arbitrarily larger "should be safe" value — see the "Teleport
 * angle correction" section of doc/superpowers/specs/2026-07-30-secondary-search-trails-design.md
 * for why a much larger radius made secondary trails effectively invisible.
 * Still expect this to need further by-eye tuning. */
export const TELEPORT_RADIUS = 2000;

/** Number of independent secondary trails alongside the camera-tracked primary trail. */
export const SECONDARY_TRAIL_COUNT = 3;

export interface TeleportSpawn {
  point: Point;
  heading: number;
}

/** Picks a random point on the circle of `radius` around `target`,
 * constrained to the same `HEAD_ANGLE ± HEADING_CLAMP` cone every heading in
 * this scene is already clamped to (see computeChildHeadings /
 * clampToHeadingRange above) — the only direction that stays legible under
 * SearchPlane's rotateX(58deg) + perspective projection. A full-circle spawn
 * angle was the original implementation and made secondary trails
 * essentially never visible: roughly 3/4 of the circle projects off-screen
 * or into transform garbage (see doc/handovers/2026-07-30-searchplane-grid-handover.md).
 * Heading is aimed back at `target`. */
export function pickTeleportSpawn(
  target: Point,
  radius: number,
  rand: () => number = Math.random,
): TeleportSpawn {
  const angle = HEAD_ANGLE - HEADING_CLAMP + rand() * (HEADING_CLAMP * 2);
  const point: Point = {
    x: target.x + Math.cos(angle) * radius,
    y: target.y + Math.sin(angle) * radius,
  };
  const heading = Math.atan2(target.y - point.y, target.x - point.x);
  return { point, heading };
}

/** True when `point` is further than `radius` from `target`. */
export function isOutsideRadius(point: Point, target: Point, radius: number): boolean {
  return Math.hypot(point.x - target.x, point.y - target.y) > radius;
}

/** Picks a random color from `palette`. */
export function pickTeamColor(palette: string[], rand: () => number = Math.random): string {
  return palette[Math.floor(rand() * palette.length)];
}
