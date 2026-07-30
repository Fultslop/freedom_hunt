# Secondary Trail Visibility Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix secondary search trails (added in `doc/superpowers/plans/2026-07-30-secondary-search-trails.md`) essentially never appearing on screen.

**Architecture:** `pickTeleportSpawn` currently draws its spawn angle uniformly from the full 0-2π circle. Nothing else in `SearchPlane` ever produces a heading outside `HEAD_ANGLE ± HEADING_CLAMP` (`computeChildHeadings` clamps every primary/secondary walking heading to that ~132° cone) — that cone is the only direction that stays legible under the `rotateX(58deg)` + `perspective` projection (see `doc/handovers/2026-07-30-searchplane-grid-handover.md` for the underlying transform math, and the "Teleport angle correction" section added to `doc/superpowers/specs/2026-07-30-secondary-search-trails-design.md`). Fix: constrain the spawn angle to that same cone, and shrink `TELEPORT_RADIUS` to the same order of magnitude as the primary trail's own visible fringe reach.

**Tech Stack:** TypeScript, Vitest.

## Global Constraints

- TypeScript only.
- No abstractions for one-off things; follow the existing style in `searchWalk.ts` (pure functions, injectable `rand`, doc comments on exported functions).
- Do not invoke git commands — the user controls git.

---

### Task 1: Constrain teleport spawn angle to the legible cone; reduce the radius

**Files:**
- Modify: `src/utils/searchWalk.ts`
- Modify: `src/test/searchWalk.test.ts`

**Interfaces:**
- `pickTeleportSpawn(target: Point, radius: number, rand?: () => number): { point: Point; heading: number }` — signature unchanged, only its internal angle distribution changes. `TELEPORT_RADIUS: number` — value changes, still exported as-is. No callers outside this file need changes (`SearchPlane.svelte` only passes `target`/`radius` through, never inspects the angle distribution).

- [ ] **Step 1: Write the failing tests**

In `src/test/searchWalk.test.ts`, replace the `"sweeps the full circle as the random draw varies"` test (inside the existing `describe("pickTeleportSpawn", ...)` block) with:

```ts
  it("constrains the spawn angle to HEAD_ANGLE ± 1.15 rad, same as every other heading in the scene", () => {
    const target = { x: 0, y: 0 };
    const low = pickTeleportSpawn(target, 1000, seq([0])).point;
    const high = pickTeleportSpawn(target, 1000, seq([1])).point;
    expect(Math.atan2(low.y - target.y, low.x - target.x)).toBeCloseTo(HEAD_ANGLE - 1.15, 5);
    expect(Math.atan2(high.y - target.y, high.x - target.x)).toBeCloseTo(HEAD_ANGLE + 1.15, 5);
  });

  it("never spawns outside that cone, across the full random range", () => {
    const target = { x: 0, y: 0 };
    for (let i = 0; i <= 10; i++) {
      const { point } = pickTeleportSpawn(target, 1000, seq([i / 10]));
      const angle = Math.atan2(point.y - target.y, point.x - target.x);
      expect(angle).toBeGreaterThanOrEqual(HEAD_ANGLE - 1.15 - 1e-9);
      expect(angle).toBeLessThanOrEqual(HEAD_ANGLE + 1.15 + 1e-9);
    }
  });
```

(The other two tests in that `describe` block — `"places the point exactly \`radius\` away from the target"` and `"aims the heading back at the target"` — stay exactly as they are; both properties hold regardless of the angle range.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- searchWalk.test.ts`
Expected: FAIL — with the current full-circle implementation, `seq([0])` produces angle `0` (not `HEAD_ANGLE - 1.15 ≈ -2.72`), so the new assertions fail.

- [ ] **Step 3: Constrain the spawn angle**

In `src/utils/searchWalk.ts`, replace the `pickTeleportSpawn` function (and the `TELEPORT_RADIUS` constant above it):

```ts
/** World-px radius, centered on the primary trail's current head, that a
 * secondary trail must stay within before it teleports back in. Sized to
 * roughly the same order of magnitude as the primary trail's own visible
 * fringe reach (removeAfterSteps × edgeLength, ~3000-4300 world-px) rather
 * than an arbitrarily larger "should be safe" value — see the "Teleport
 * angle correction" section of doc/superpowers/specs/2026-07-30-secondary-search-trails-design.md
 * for why a much larger radius made secondary trails effectively invisible.
 * Still expect this to need further by-eye tuning. */
export const TELEPORT_RADIUS = 3500;
```

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- searchWalk.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Full-suite regression for the files this touches, lint, typecheck**

Run: `npm run test -- searchWalk.test.ts SearchPlane.test.ts themes.test.ts && npm run lint && npx svelte-check`
Expected: all green, 0 lint/typecheck errors. (The broader project-wide test suite has pre-existing unrelated failures — see the review of `doc/superpowers/plans/2026-07-30-secondary-search-trails.md` — so scope verification to these three files plus lint/typecheck rather than the full suite.)

- [ ] **Step 6: Commit**

```bash
git add src/utils/searchWalk.ts src/test/searchWalk.test.ts
git commit -m "fix: constrain secondary-trail teleport spawn angle to the legible cone"
```

---

## Self-Review Notes

- **Spec coverage:** angle constrained to `HEAD_ANGLE ± HEADING_CLAMP` → Step 3. Radius reduced to the primary trail's own fringe-reach order of magnitude → Step 3 (`TELEPORT_RADIUS = 3500`, within the spec's noted ~3000-4300 range). No change to color rolling, unbiased normal wander, disconnected root, or fading fringe — none of that logic lives in `pickTeleportSpawn`, untouched.
- **Placeholder scan:** none.
- **Type consistency:** `pickTeleportSpawn`'s signature and `TeleportSpawn`/`Point` types are unchanged from the original implementation — no changes needed anywhere else in `searchWalk.ts`, `SearchPlane.svelte`, or `SearchPlane.test.ts`.
