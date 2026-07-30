# Secondary search trails — design

## Purpose

The landing page's `SearchPlane` background currently animates one wandering
"search head" that the camera follows (spec'd and built in
`doc/superpowers/plans/2026-07-30-landing-join-flow.md`). This adds a small
number of independent secondary trails — representing other teams also out
searching — wandering in the same world, visually distinguished from the
primary trail by pin color, that periodically re-enter the camera's vicinity
rather than drifting away for good.

## Scope

Applies to `SearchPlane`'s `"search"` mode only. `"frozen"` (reduced-motion
preview) and `"route"` mode are unaffected — no secondary trails, no new
props, no behavior change.

## Architecture: shared walker abstraction

The current split → choose → prune → repeat choreography (`runSplit`, node/
edge state, per-step timers) lives inline in `SearchPlane.svelte`, written
for exactly one walker that also drives the camera. To run several
independent walkers without duplicating that machinery, generalize it into a
local factory function, `createWalker(...)`, defined inside
`SearchPlane.svelte`'s `<script>` block (Svelte 5's standard pattern for a
reactive unit that isn't a full component — `$state` works inside any
function defined in the same file, so this needs no new `.svelte.ts` module,
which the codebase has no existing precedent for):

- Owns one walker's `nodes`/`edges` (as `$state`), `idCounter`, and pending
  timers.
- Runs the existing split/choose/age/prune cycle (reuses
  `pickChildCount`/`computeChildHeadings`/`edgeLength`/`splitDurationMs`/
  `ageStep`/`removeAfterSteps`/`FADE_AFTER_STEPS` from `searchWalk.ts`
  unchanged).
- Takes an optional per-step hook, called after each step settles (chosen
  child becomes new head), used by secondary trails for the teleport check.
  The primary walker doesn't use this hook.
- Does not touch the camera itself — `SearchPlane.svelte` reads the primary
  walker's current head to drive `cameraTarget`, exactly as today.

The new pure math this needs (teleport spawn point on the radius circle,
heading back toward a target, team-color rolling) is added to
`searchWalk.ts` as plain, independently unit-testable functions, following
that file's existing style (`computeChildHeadings`, `edgeLength`, etc. — all
pure, all accept an injectable `rand` for deterministic tests).

`SearchPlane.svelte` instantiates one primary walker (unchanged visible
behavior) plus `SECONDARY_TRAIL_COUNT` secondary walkers, and renders all of
their nodes/edges/pins into the same world.

## Secondary trail lifecycle

- `SECONDARY_TRAIL_COUNT = 3`, a constant in `searchWalk.ts` — easily changed
  later.
- **Spawn:** each secondary trail starts pre-teleported (see below) rather
  than stacking at the shared root — a random angle, **constrained to the
  same `HEAD_ANGLE ± HEADING_CLAMP` cone every other heading in this scene
  already respects** (see "Teleport angle correction" below), on the
  `TELEPORT_RADIUS` circle centered on the primary trail's current head,
  heading aimed back at that head, with a color freshly rolled from the
  theme's team-color palette.
- **Wander:** runs the identical procedural split/choose walk as the primary
  trail (same `pickChildCount`/`computeChildHeadings`/`edgeLength`) with
  fully independent randomness — no bias toward the primary trail's
  position or heading.
- **Teleport check:** after each step settles, compute the distance from the
  secondary trail's new head to the primary trail's current live head. If it
  exceeds `TELEPORT_RADIUS`, teleport:
  - Roll a new random angle on the `TELEPORT_RADIUS` circle (centered on the
    primary trail's *current* head at teleport time) and aim heading back at
    it.
  - Roll a new color from the theme's team-color palette.
  - Spawn a new, disconnected root node there and continue the walk from it.
  - No edge is ever drawn between the pre-teleport head and the new spawn
    point — they belong to different root segments in that trail's own
    node/edge lists.
- **Old fringe after a teleport:** left alone. It keeps aging and gets
  pruned by the walker's existing `FADE_AFTER_STEPS`/`removeAfterSteps`
  logic, same as any other dead-end branch — no special-cased clearing.
  Since `TELEPORT_RADIUS` keeps it off-camera, this is never actually seen;
  it's just reusing the pruning the walker already does instead of adding a
  second code path.

`TELEPORT_RADIUS` is picked conservatively large to start, with the
expectation it needs one round of by-eye tuning once this is running — the
perspective/mask math it has to stay outside of is already known to be
fragile (see `doc/handovers/2026-07-30-searchplane-grid-handover.md`), so
verifying "is it actually off-camera" visually is more reliable than
deriving it analytically.

### Teleport angle correction (post-implementation fix)

Real-world testing of the first implementation showed secondary trails were
essentially never seen. Root cause: `pickTeleportSpawn`'s original spawn
angle was a full 0-2π uniform draw, but nothing else in this scene ever
places a heading outside `HEAD_ANGLE ± HEADING_CLAMP` (`±1.15 rad`,
~±66°) — `computeChildHeadings` clamps every primary/secondary walking
heading to that cone. That cone is the only direction that stays legible
under the `rotateX(58deg)` + `perspective` projection (worked out from the
same transform math as the grid-distortion root cause in
`doc/handovers/2026-07-30-searchplane-grid-handover.md`):

- Lateral angles (roughly ±90° off the cone) project to a screen offset that
  grows with world distance — at `TELEPORT_RADIUS`, that's thousands of px
  outside the viewport, clipped by `.search-plane`'s `overflow: hidden`.
- Angles toward the viewer (the "near" half of the circle) exceed
  `perspective / sin(58deg)` — roughly 600-2800 world-px depending on
  viewport, far less than the original `TELEPORT_RADIUS` — which is the
  "at or past the camera" garbage-transform case the grid's own asymmetric
  offset was built to avoid.
- Only the "away from the viewer" direction (the one the primary trail is
  already restricted to) stays legible, and even there `TELEPORT_RADIUS`
  was sized well past where the primary trail's own fringe ever reaches.

Fix: constrain `pickTeleportSpawn`'s angle to `HEAD_ANGLE ± HEADING_CLAMP`,
same as every other heading in the system, and reduce `TELEPORT_RADIUS`
to roughly the same order of magnitude as the primary trail's own visible
fringe reach (`removeAfterSteps × edgeLength`, ~3000-4300 world-px) instead
of an arbitrarily larger "should be safe" value. Everything else about the
mechanic (per-teleport random color, unbiased normal wander, disconnected
root, fading old fringe) is unchanged.

## Color

- Add `searchTeamColors: string[]` (3-4 colors) to `Theme`
  (`src/types/theme.ts`), and a value for each of the three themes
  (`wireframe`, `app`, `GWC`) in `src/theme/themes.ts`, distinct from that
  theme's `searchPinHead`. No new CSS custom property sync is needed in
  `App.svelte` for this — see below.
- Each secondary-trail node stores its own `teamColor` (string) at creation
  time, inherited from that trail's currently-active color. Applied via
  **inline style** on the pin, per this project's convention for per-record
  runtime colors driven by data (not a CSS class per color) — so pins
  dropped before a teleport keep fading in their original color while pins
  dropped after a teleport show the freshly rolled one.
- Non-pin dots/edges belonging to secondary trails reuse the existing
  `--search-node`/`--search-node-active`/`--search-node-halo`/`--search-edge`
  tokens unchanged (same as the primary trail today) — only pins carry
  per-team color. This avoids adding a second, rarely-visible token set for
  fringe that already fades within `FADE_AFTER_STEPS` steps regardless of
  which trail it belongs to, and keeps the existing "current head" dot
  styling meaningful without a new CSS modifier class.
- Secondary-trail pins get **no place-name label**, unlike the primary
  trail's pins — keeps the scene readable with up to `SECONDARY_TRAIL_COUNT`
  extra trails moving around, and keeps the primary trail's labeled path as
  the one thing the UI is meant to draw the eye to.

## Non-goals / explicitly out of scope

- Frozen (reduced-motion) preview: stays exactly as today, single trail, no
  secondary-trail pins baked in. There's no motion to represent statically,
  and reduced-motion is the minority path.
- Route mode: unaffected.
- Camera: continues to track only the primary trail, exactly as today.
- No bias/steering of secondary trails toward the primary trail during
  normal wander — only the teleport-on-exceeding-radius rule pulls them
  back.

## Testing

- `searchWalker.ts` (or wherever the walker factory lands): unit tests for
  the teleport trigger (distance > `TELEPORT_RADIUS` → new root spawned on
  the circle, heading points back at target), and that pruning of
  pre-teleport fringe still follows existing age rules.
- Color rolling: a `teamColor` is assigned per node at creation and does not
  change retroactively when the owning trail later teleports and re-rolls.
- `SearchPlane.svelte`: existing regression tests (at most one active node
  per walker, bounded element count over an extended run) extended to cover
  `SECONDARY_TRAIL_COUNT` walkers running concurrently without the camera
  tracking any of them.
