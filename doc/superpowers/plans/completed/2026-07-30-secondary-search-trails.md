# Secondary Search Trails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a configurable number of independent secondary "search trails" to the `SearchPlane` landing-page background, wandering near the camera-tracked primary trail and teleporting back into range (with a freshly rolled pin color) whenever they drift too far away.

**Architecture:** Generalize `SearchPlane.svelte`'s single-walker split/choose/prune/timer logic into a local `createWalker()` factory (Svelte 5 reactive-factory pattern, defined inside the component — no new `.svelte.ts` module). Instantiate one primary walker (drives the camera, unchanged behavior) plus `SECONDARY_TRAIL_COUNT` secondary walkers (never touch the camera, each carrying a teleport rule). New pure geometry/color helpers live in `searchWalk.ts` alongside the existing pure split-logic helpers.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest + @testing-library/svelte.

## Global Constraints

- TypeScript only; no `.js`/`.jsx`/`.tsx` in `src/`.
- Reactivity uses Svelte 5 runes (`$state`, `$derived`, `$effect`) — no Svelte 4 `$:`.
- Theme colours go through CSS custom properties / the `Theme` object — never hardcode hex in components except as documented per-record inline-style values sourced from theme data (this project's existing convention, e.g. `ChallengeCard.svelte`'s `style="background: {location.themeColor ?? $themeStore.theme.accent}"`).
- No abstractions for one-off things; follow existing patterns in the file being touched.
- Do not invoke git commands — the user controls git.

---

## Spec reference

Full design: `doc/superpowers/specs/2026-07-30-secondary-search-trails-design.md`. Key decisions this plan implements:
- `SECONDARY_TRAIL_COUNT = 3`, independent random walk (no bias) for each secondary trail.
- `TELEPORT_RADIUS` (world px) around the primary trail's current head; a secondary trail whose newly-chosen head would land outside it instead spawns a disconnected new root at a random point on that radius circle, heading aimed back at the primary head, with a freshly rolled color.
- Pre-teleport fringe is left alone — it fades via the existing age/prune logic, unchanged.
- Secondary trails spawn pre-teleported (not stacked at the shared root) and never show place-name labels.
- Only pins carry per-team color (inline style); dots/edges reuse the existing `--search-node`/`--search-node-active`/`--search-edge` tokens unchanged.
- Only `"search"` mode is affected; `"frozen"` and `"route"` modes are untouched.

---

### Task 1: Teleport geometry and color helpers in `searchWalk.ts`

**Files:**
- Modify: `src/utils/searchWalk.ts`
- Test: `src/test/searchWalk.test.ts`

**Interfaces:**
- Produces: `TELEPORT_RADIUS: number`, `SECONDARY_TRAIL_COUNT: number`, `pickTeleportSpawn(target: Point, radius: number, rand?: () => number): { point: Point; heading: number }`, `isOutsideRadius(point: Point, target: Point, radius: number): boolean`, `pickTeamColor(palette: string[], rand?: () => number): string`. All consumed by Task 3/4.

- [ ] **Step 1: Write the failing tests**

Add to `src/test/searchWalk.test.ts` (uses the file's existing `seq()` helper, already imported at the top — extend the import list):

```ts
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
  pickTeleportSpawn,
  isOutsideRadius,
  pickTeamColor,
  TELEPORT_RADIUS,
  SECONDARY_TRAIL_COUNT,
} from "../utils/searchWalk";
```

Append these new `describe` blocks at the end of the file:

```ts
describe("pickTeleportSpawn", () => {
  it("places the point exactly `radius` away from the target", () => {
    const { point } = pickTeleportSpawn({ x: 100, y: -50 }, 6000, seq([0.25]));
    expect(Math.hypot(point.x - 100, point.y - (-50))).toBeCloseTo(6000, 5);
  });

  it("aims the heading back at the target", () => {
    const target = { x: 0, y: 0 };
    const { point, heading } = pickTeleportSpawn(target, 1000, seq([0.1]));
    const expectedHeading = Math.atan2(target.y - point.y, target.x - point.x);
    expect(heading).toBeCloseTo(expectedHeading, 5);
  });

  it("sweeps the full circle as the random draw varies", () => {
    const target = { x: 0, y: 0 };
    const a = pickTeleportSpawn(target, 1000, seq([0])).point;
    const b = pickTeleportSpawn(target, 1000, seq([0.5])).point;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(1000);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- searchWalk.test.ts`
Expected: FAIL — `pickTeleportSpawn`, `isOutsideRadius`, `pickTeamColor`, `TELEPORT_RADIUS`, `SECONDARY_TRAIL_COUNT` are not exported yet.

- [ ] **Step 3: Implement the helpers**

Append to `src/utils/searchWalk.ts` (after `ageStep`, at the end of the file):

```ts
/** World-px radius, centered on the primary trail's current head, that a
 * secondary trail must stay within before it teleports back in. Deliberately
 * conservative so a teleport always lands off-camera; expect one round of
 * by-eye tuning once this is running against the real perspective/mask setup
 * (see doc/handovers/2026-07-30-searchplane-grid-handover.md). */
export const TELEPORT_RADIUS = 6000;

/** Number of independent secondary trails alongside the camera-tracked primary trail. */
export const SECONDARY_TRAIL_COUNT = 3;

export interface TeleportSpawn {
  point: Point;
  heading: number;
}

/** Picks a random point on the circle of `radius` around `target`, heading aimed back at `target`. */
export function pickTeleportSpawn(
  target: Point,
  radius: number,
  rand: () => number = Math.random,
): TeleportSpawn {
  const angle = rand() * Math.PI * 2;
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- searchWalk.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Lint and typecheck**

Run: `npm run lint && npx svelte-check`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/searchWalk.ts src/test/searchWalk.test.ts
git commit -m "feat: add teleport geometry and team-color helpers to searchWalk"
```

---

### Task 2: `searchTeamColors` theme token

**Files:**
- Modify: `src/types/theme.ts`
- Modify: `src/theme/themes.ts`
- Test: `src/test/themes.test.ts` (new)

**Interfaces:**
- Produces: `Theme.searchTeamColors: string[]`, populated for `wireframe`, `app`, `GWC`. Consumed by Task 4 via `$themeStore.theme.searchTeamColors`.

- [ ] **Step 1: Write the failing test**

Create `src/test/themes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { themes } from "../theme/themes";

describe("searchTeamColors", () => {
  const themeNames = Object.keys(themes) as (keyof typeof themes)[];

  it("every theme defines at least 3 team colors", () => {
    for (const name of themeNames) {
      expect(themes[name].searchTeamColors.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("every theme's team colors are all distinct from each other", () => {
    for (const name of themeNames) {
      const colors = themes[name].searchTeamColors;
      expect(new Set(colors).size).toBe(colors.length);
    }
  });

  it("every theme's team colors are distinct from that theme's primary pin color", () => {
    for (const name of themeNames) {
      const theme = themes[name];
      expect(theme.searchTeamColors).not.toContain(theme.searchPinHead);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- themes.test.ts`
Expected: FAIL — TypeScript error / `searchTeamColors` is `undefined`.

- [ ] **Step 3: Add the field to the `Theme` type**

In `src/types/theme.ts`, add one line after `searchPinHead: string;` (line 39):

```ts
  searchPinHead: string;
  searchTeamColors: string[];
```

- [ ] **Step 4: Add values to all three themes**

In `src/theme/themes.ts`, add one line to each theme object, right after each one's `searchPinHead` entry.

`wireframe` (after line 34, `searchPinHead: "#111111",`):

```ts
    searchPinHead: "#111111",
    searchTeamColors: ["#8c8c8c", "#4d4d4d", "#b3b3b3", "#333333"],
```

`app` (after line 68, `searchPinHead: "#f59e0b",`):

```ts
    searchPinHead: "#f59e0b",
    searchTeamColors: ["#2dd4bf", "#a78bfa", "#fb7185", "#38bdf8"],
```

`GWC` (after line 102, `searchPinHead: "#BF0A30",`):

```ts
    searchPinHead: "#BF0A30",
    searchTeamColors: ["#16a34a", "#7c3aed", "#ea580c", "#0d9488"],
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- themes.test.ts`
Expected: PASS.

- [ ] **Step 6: Full-suite regression, lint, typecheck**

Run: `npm run test && npm run lint && npx svelte-check`
Expected: all existing tests still pass (a new required `Theme` field is additive to every object literal, so nothing else should break), 0 lint/typecheck errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/theme.ts src/theme/themes.ts src/test/themes.test.ts
git commit -m "feat: add searchTeamColors theme token for secondary search trails"
```

---

### Task 3: Refactor `SearchPlane.svelte` into a reusable walker factory (behavior-preserving)

**Files:**
- Modify: `src/components/SearchPlane.svelte`

**Interfaces:**
- Consumes: `pickTeleportSpawn`, `isOutsideRadius`, `pickTeamColor` from Task 1 (`../utils/searchWalk`) — referenced by the walker factory's teleport branch, exercised in Task 4.
- Produces: a `createWalker(config: WalkerConfig): Walker` factory local to `SearchPlane.svelte`, with `Walker = { nodes: LiveNode[]; edges: LiveEdge[]; currentHeadPosition: Point; start(): void; stop(): void; setPaused(next: boolean): void }`. Task 4 instantiates `SECONDARY_TRAIL_COUNT` more of these.

This task is a pure refactor: one primary walker, camera behavior, pause/resume, and pruning must all work exactly as before. No new visible behavior — verified by the existing test suite passing unchanged.

- [ ] **Step 1: Confirm the baseline passes before touching anything**

Run: `npm run test -- SearchPlane.test.ts`
Expected: PASS (17 existing tests).

- [ ] **Step 2: Replace the entire `<script>` block of `SearchPlane.svelte`**

Replace everything from the top of the file through the closing `</script>` tag (i.e. everything before the `<div class="search-plane" ...>` template) with:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import {
    HEAD_ANGLE, pickChildCount, computeChildHeadings, edgeLength,
    splitDurationMs, lerpCamera, ageStep, FADE_AFTER_STEPS, removeAfterSteps,
    pickTeleportSpawn, isOutsideRadius, pickTeamColor,
    type Point,
  } from "../utils/searchWalk";
  import { pickPlaceName } from "../utils/placeNames";
  import "./SearchPlane.css";

  export interface Stop {
    id: string;
  }

  let {
    mode,
    anchor,
    route,
    paused = false,
  }: {
    mode: "search" | "route" | "frozen";
    anchor: number;
    route?: Stop[];
    paused?: boolean;
  } = $props();

  interface LiveNode {
    id: string;
    x: number;
    y: number;
    heading: number;
    age: number;
    current: boolean;
    hasPin?: boolean;
    label?: string;
    teamColor?: string;
  }
  interface LiveEdge {
    id: string;
    fromId: string;
    toId: string;
    state: "growing" | "active" | "visited";
  }

  let idCounter = 0;
  function nextId(): string {
    idCounter += 1;
    return `n${idCounter}`;
  }

  // Only the primary walker ever draws from this — shared here so its
  // uniqueness holds even if createWalker is ever called more than once for
  // isPrimary: true (it currently isn't).
  let usedLabels = new Set<string>();

  function isWideViewport(): boolean {
    return typeof window !== "undefined" && window.innerWidth >= 1200;
  }

  interface WalkerConfig {
    rootNode: LiveNode;
    isPrimary: boolean;
    /** Only the primary walker sets this — retargets the camera each time it picks a new head. */
    onHeadChosen?: (point: Point) => void;
    /** Only secondary walkers set this — teleports the walker back near `getTargetPosition()` once it wanders past `radius`. */
    teleport?: {
      getTargetPosition: () => Point;
      radius: number;
      palette: string[];
    };
  }

  interface Walker {
    readonly nodes: LiveNode[];
    readonly edges: LiveEdge[];
    readonly currentHeadPosition: Point;
    start(): void;
    stop(): void;
    setPaused(next: boolean): void;
  }

  /**
   * One wandering search head: split -> choose -> prune -> repeat, on its own
   * timers, entirely independent of any other walker. Exactly one node is
   * ever `current` at a time within a given walker — a split creates k
   * siblings from that head; one is chosen to become the new head (or, for a
   * walker with `teleport` configured, to be discarded in favor of a fresh
   * disconnected spawn point), the rest sit as dead-end nodes that age and
   * eventually get pruned.
   */
  function createWalker(config: WalkerConfig): Walker {
    let nodes = $state<LiveNode[]>([config.rootNode]);
    let edges = $state<LiveEdge[]>([]);
    let pendingTimers: ReturnType<typeof setTimeout>[] = [];
    let running = false;
    let paused = false;
    let pendingResumeHeadId: string | null = null;

    function clearAllTimers() {
      for (const timer of pendingTimers) {
        clearTimeout(timer);
      }
      pendingTimers = [];
    }

    function runSplit(headId: string) {
      const head = nodes.find((n) => n.id === headId);
      if (!running || !head) {
        return;
      }
      const k = pickChildCount();
      const headings = computeChildHeadings(head.heading, k);
      const children: LiveNode[] = headings.map((heading) => {
        const len = edgeLength();
        return {
          id: nextId(),
          x: head.x + Math.cos(heading) * len,
          y: head.y + Math.sin(heading) * len,
          heading,
          age: 0,
          current: false,
        };
      });

      // Each child's edge+dot appears staggered, i*330ms apart (spec §5.4).
      children.forEach((child, i) => {
        pendingTimers.push(
          setTimeout(() => {
            if (running) {
              nodes = [...nodes, child];
              edges = [...edges, { id: `e${child.id}`, fromId: head.id, toId: child.id, state: "growing" }];
            }
          }, i * 330),
        );
      });

      const duration = splitDurationMs(k);

      // done + 250: choose a child, retarget the camera (primary only), mark its edge active.
      pendingTimers.push(
        setTimeout(() => {
          if (running) {
            const geometricChoice = children[Math.floor(Math.random() * children.length)];
            edges = edges.map((e) => (e.toId === geometricChoice.id ? { ...e, state: "active" } : e));

            let nextHead = geometricChoice;
            let isTeleport = false;
            let teleportColor: string | undefined;
            if (
              config.teleport &&
              isOutsideRadius(
                { x: geometricChoice.x, y: geometricChoice.y },
                config.teleport.getTargetPosition(),
                config.teleport.radius,
              )
            ) {
              const spawn = pickTeleportSpawn(config.teleport.getTargetPosition(), config.teleport.radius);
              nextHead = { id: nextId(), x: spawn.point.x, y: spawn.point.y, heading: spawn.heading, age: 0, current: false };
              teleportColor = pickTeamColor(config.teleport.palette);
              isTeleport = true;
            }

            if (config.onHeadChosen) {
              config.onHeadChosen({ x: nextHead.x, y: nextHead.y });
            }

            // done + 500: the chosen (or teleported) node becomes the new head; label fades in (primary only).
            pendingTimers.push(
              setTimeout(() => {
                if (running) {
                  if (isTeleport) {
                    // A teleport spawn is a new, disconnected root: no edge
                    // ever connects it to the pre-teleport head, and that old
                    // head/fringe are left in place to fade via the normal
                    // age/prune pass below, exactly like any other dead end.
                    nodes = [
                      ...nodes.map((n) => ({ ...n, current: false })),
                      { ...nextHead, current: true, hasPin: true, teamColor: teleportColor },
                    ];
                  } else {
                    const label = config.isPrimary ? pickPlaceName(usedLabels) : undefined;
                    if (label) {
                      usedLabels.add(label);
                    }
                    nodes = nodes.map((n) => ({
                      ...n,
                      current: n.id === nextHead.id,
                      ...(n.id === nextHead.id ? { hasPin: true, label, age: 0 } : {}),
                    }));
                  }

                  // done + 1300: chosen edge settles to visited (skipped for a
                  // teleport spawn, which has no connecting edge); age/prune; next split.
                  pendingTimers.push(
                    setTimeout(() => {
                      if (running) {
                        if (!isTeleport) {
                          edges = edges.map((e) => (e.toId === nextHead.id ? { ...e, state: "visited" } : e));
                        }
                        nodes = ageStep(nodes as (LiveNode & { age: number })[]) as LiveNode[];
                        const limit = removeAfterSteps(isWideViewport());
                        const survivors = new Set(
                          nodes.filter((n) => n.current || n.age < limit).map((n) => n.id),
                        );
                        nodes = nodes.filter((n) => survivors.has(n.id));
                        edges = edges.filter((e) => survivors.has(e.fromId) && survivors.has(e.toId));

                        // A brief rest once the search settles somewhere new, before
                        // the next fan-out. `paused`/`running` are re-checked when
                        // this fires, not when it's scheduled.
                        const restMs = 1000 + Math.random() * 1000;
                        pendingTimers.push(
                          setTimeout(() => {
                            if (running) {
                              if (paused) {
                                pendingResumeHeadId = nextHead.id;
                              } else {
                                runSplit(nextHead.id);
                              }
                            }
                          }, restMs),
                        );
                      }
                    }, 1050),
                  );
                }
              }, 250),
            );
          }
        }, duration + 250),
      );
    }

    return {
      get nodes() {
        return nodes;
      },
      get edges() {
        return edges;
      },
      get currentHeadPosition() {
        const head = nodes.find((n) => n.current);
        return head ? { x: head.x, y: head.y } : { x: config.rootNode.x, y: config.rootNode.y };
      },
      start() {
        running = true;
        const headId = nodes.find((n) => n.current)?.id ?? config.rootNode.id;
        if (paused) {
          pendingResumeHeadId = headId;
        } else {
          runSplit(headId);
        }
      },
      stop() {
        running = false;
        clearAllTimers();
      },
      setPaused(next: boolean) {
        paused = next;
        if (!paused && pendingResumeHeadId) {
          const headId = pendingResumeHeadId;
          pendingResumeHeadId = null;
          runSplit(headId);
        }
      },
    };
  }

  let camera = $state<Point>({ x: 0, y: 0 });
  let cameraTarget = $state<Point>({ x: 0, y: 0 });
  let frameId: number | null = null;

  const primaryWalker = createWalker({
    rootNode: { id: "root", x: 0, y: 0, heading: HEAD_ANGLE, age: 0, current: true, hasPin: true },
    isPrimary: true,
    onHeadChosen: (point) => {
      cameraTarget = point;
    },
  });

  let prefersReducedMotion = $state(false);
  onMount(() => {
    prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  const FROZEN_NODES: LiveNode[] = [
    { id: "a", x: 0, y: 0, heading: HEAD_ANGLE, age: 0, current: false, hasPin: false },
    { id: "b", x: 40, y: -80, heading: HEAD_ANGLE, age: 0, current: false, hasPin: false },
    { id: "c", x: -30, y: -150, heading: HEAD_ANGLE, age: 0, current: false, hasPin: false },
    { id: "d", x: 10, y: -230, heading: HEAD_ANGLE, age: 0, current: true, hasPin: true, label: "Old Market" },
    { id: "e", x: -70, y: -170, heading: HEAD_ANGLE, age: 8, current: false, hasPin: false },
  ];
  const FROZEN_EDGES: LiveEdge[] = [
    { id: "e0", fromId: "a", toId: "b", state: "visited" },
    { id: "e1", fromId: "b", toId: "c", state: "visited" },
    { id: "e2", fromId: "c", toId: "d", state: "visited" },
    { id: "e3", fromId: "c", toId: "e", state: "growing" },
  ];

  function frame() {
    camera = lerpCamera(camera, cameraTarget);
    frameId = requestAnimationFrame(frame);
  }

  function start() {
    if (mode === "search" && !prefersReducedMotion) {
      if (frameId === null) {
        frameId = requestAnimationFrame(frame);
      }
      primaryWalker.setPaused(paused);
      primaryWalker.start();
    }
  }

  function stop() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    primaryWalker.stop();
  }

  function handleVisibility() {
    if (document.hidden) {
      stop();
    } else if (mode === "search" && !prefersReducedMotion) {
      start();
    }
  }

  $effect(() => {
    if (mode === "search") {
      primaryWalker.setPaused(paused);
    }
  });

  function buildRoutePath(routeStops: Stop[]): { nodes: LiveNode[]; edges: LiveEdge[] } {
    let heading = HEAD_ANGLE;
    let posX = 0;
    let posY = 0;
    const routeNodes: LiveNode[] = [];
    const routeEdges: LiveEdge[] = [];
    routeStops.forEach((stop, index) => {
      if (index > 0) {
        const jitter = (Math.random() * 2 - 1) * 0.35;
        heading = Math.min(HEAD_ANGLE + 0.8, Math.max(HEAD_ANGLE - 0.8, heading + jitter));
        const len = 30 + Math.random() * 12;
        posX += Math.cos(heading) * len;
        posY += Math.sin(heading) * len;
      }
      const label =
        index === 0 || index === routeStops.length - 1 || index === Math.floor(routeStops.length / 2)
          ? `Stop ${index + 1}`
          : undefined;
      routeNodes.push({ id: stop.id, x: posX, y: posY, heading, age: 0, current: true, label });
      if (index > 0) {
        routeEdges.push({
          id: `route-edge-${index}`,
          fromId: routeStops[index - 1].id,
          toId: stop.id,
          state: "visited",
        });
      }
    });
    return { nodes: routeNodes, edges: routeEdges };
  }

  let routePath = $derived(mode === "route" && route ? buildRoutePath(route) : null);

  onMount(() => {
    start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stop();
    };
  });

  let effectiveMode = $derived(prefersReducedMotion ? "frozen" : mode);
  let displayNodes = $derived(
    effectiveMode === "frozen"
      ? FROZEN_NODES
      : effectiveMode === "route" && routePath
        ? routePath.nodes
        : primaryWalker.nodes,
  );
  let displayEdges = $derived(
    effectiveMode === "frozen"
      ? FROZEN_EDGES
      : effectiveMode === "route" && routePath
        ? routePath.edges
        : primaryWalker.edges,
  );
  // Only search mode ever moves the camera — frozen/route stay put at (0,0),
  // which for route mode is exactly stop 1 (spec §5.5: "anchored on stop 1").
  let planeTransform = $derived(
    effectiveMode === "search"
      ? `rotateX(58deg) translate3d(${-camera.x}px, ${-camera.y}px, 0)`
      : "rotateX(58deg)",
  );
  const GRID_CELL = 46;
  let gridTransform = $derived(
    effectiveMode === "search"
      ? `translate3d(${Math.round(camera.x / GRID_CELL) * GRID_CELL}px, ${Math.round(camera.y / GRID_CELL) * GRID_CELL}px, 0)`
      : "translate3d(0, 0, 0)",
  );
</script>
```

Note: `displayNodes`/`displayEdges` reference `primaryWalker.nodes`/`primaryWalker.edges` directly for now — Task 4 changes these two lines to a merged primary+secondary list. The template (pins/labels/edges markup below the script) is unchanged in this task.

- [ ] **Step 3: Run the full existing SearchPlane test suite**

Run: `npm run test -- SearchPlane.test.ts`
Expected: PASS — all 17 existing tests green, unchanged, no test file edits in this task.

- [ ] **Step 4: Lint and typecheck**

Run: `npm run lint && npx svelte-check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchPlane.svelte
git commit -m "refactor: extract SearchPlane's search-head logic into a reusable walker factory"
```

---

### Task 4: Secondary trails — spawn, teleport, render, color

**Files:**
- Modify: `src/components/SearchPlane.svelte`
- Modify: `src/test/SearchPlane.test.ts`

**Interfaces:**
- Consumes: `TELEPORT_RADIUS`, `SECONDARY_TRAIL_COUNT` (Task 1, `../utils/searchWalk`); `theme.searchTeamColors` (Task 2, via `themeStore`); `createWalker`/`Walker`/`WalkerConfig` (Task 3, local to this file).

- [ ] **Step 1: Add the new imports**

In `src/components/SearchPlane.svelte`, extend the existing `searchWalk` import (added in Task 3) to also pull in the two constants:

```ts
  import {
    HEAD_ANGLE, pickChildCount, computeChildHeadings, edgeLength,
    splitDurationMs, lerpCamera, ageStep, FADE_AFTER_STEPS, removeAfterSteps,
    pickTeleportSpawn, isOutsideRadius, pickTeamColor,
    TELEPORT_RADIUS, SECONDARY_TRAIL_COUNT,
    type Point,
  } from "../utils/searchWalk";
  import { pickPlaceName } from "../utils/placeNames";
  import { themeStore } from "../stores/themeStore";
  import "./SearchPlane.css";
```

- [ ] **Step 2: Add `secondaryWalkers` state and a spawn function**

Immediately after the `primaryWalker` declaration (the `const primaryWalker = createWalker({...});` block from Task 3), add:

```ts
  let secondaryWalkers = $state<Walker[]>([]);

  /** Spawns SECONDARY_TRAIL_COUNT independent trails, each pre-teleported
   * onto the radius edge around the primary trail's current head, as if a
   * new team had just wandered into view. Only runs once per mount. */
  function spawnSecondaryWalkers() {
    if (secondaryWalkers.length > 0) {
      return;
    }
    const palette = $themeStore.theme.searchTeamColors;
    const walkers: Walker[] = [];
    for (let i = 0; i < SECONDARY_TRAIL_COUNT; i++) {
      const spawn = pickTeleportSpawn(primaryWalker.currentHeadPosition, TELEPORT_RADIUS);
      const color = pickTeamColor(palette);
      walkers.push(
        createWalker({
          rootNode: {
            id: nextId(),
            x: spawn.point.x,
            y: spawn.point.y,
            heading: spawn.heading,
            age: 0,
            current: true,
            hasPin: true,
            teamColor: color,
          },
          isPrimary: false,
          teleport: {
            getTargetPosition: () => primaryWalker.currentHeadPosition,
            radius: TELEPORT_RADIUS,
            palette,
          },
        }),
      );
    }
    secondaryWalkers = walkers;
  }
```

- [ ] **Step 3: Wire secondary walkers into `start()`/`stop()`**

Replace the `start()` and `stop()` functions (from Task 3) with:

```ts
  function start() {
    if (mode === "search" && !prefersReducedMotion) {
      spawnSecondaryWalkers();
      if (frameId === null) {
        frameId = requestAnimationFrame(frame);
      }
      for (const walker of [primaryWalker, ...secondaryWalkers]) {
        walker.setPaused(paused);
        walker.start();
      }
    }
  }

  function stop() {
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    for (const walker of [primaryWalker, ...secondaryWalkers]) {
      walker.stop();
    }
  }
```

- [ ] **Step 4: Pause/resume every walker, not just the primary**

Replace the `$effect` block (from Task 3) with:

```ts
  $effect(() => {
    if (mode === "search") {
      for (const walker of [primaryWalker, ...secondaryWalkers]) {
        walker.setPaused(paused);
      }
    }
  });
```

- [ ] **Step 5: Merge primary + secondary nodes/edges for rendering**

Replace the `displayNodes`/`displayEdges` derivations (from Task 3) with:

```ts
  let allNodes = $derived([...primaryWalker.nodes, ...secondaryWalkers.flatMap((w) => w.nodes)]);
  let allEdges = $derived([...primaryWalker.edges, ...secondaryWalkers.flatMap((w) => w.edges)]);

  let effectiveMode = $derived(prefersReducedMotion ? "frozen" : mode);
  let displayNodes = $derived(
    effectiveMode === "frozen"
      ? FROZEN_NODES
      : effectiveMode === "route" && routePath
        ? routePath.nodes
        : allNodes,
  );
  let displayEdges = $derived(
    effectiveMode === "frozen"
      ? FROZEN_EDGES
      : effectiveMode === "route" && routePath
        ? routePath.edges
        : allEdges,
  );
```

(This block must stay below the `routePath` declaration, same as before — only the last branch of each ternary changes, from `primaryWalker.nodes`/`primaryWalker.edges` to `allNodes`/`allEdges`.)

- [ ] **Step 6: Give secondary pins their per-team color**

In the template, find the pin markup (unchanged since before Task 3):

```svelte
    <div class="search-plane__pins">
      {#each displayNodes.filter((n) => n.hasPin) as nodeItem (nodeItem.id)}
        <div class="search-plane__pin" style={`left:${nodeItem.x}px; top:${nodeItem.y}px;`}>
          <div class="search-plane__pin-head"></div>
          <div class="search-plane__pin-stem"></div>
        </div>
      {/each}
    </div>
```

Replace the `search-plane__pin-head` line with:

```svelte
          <div
            class="search-plane__pin-head"
            style={nodeItem.teamColor ? `background: ${nodeItem.teamColor};` : ""}
          ></div>
```

- [ ] **Step 7: Update existing tests whose invariants change with multiple walkers**

In `src/test/SearchPlane.test.ts`, add `SECONDARY_TRAIL_COUNT` to the imports:

```ts
import { SECONDARY_TRAIL_COUNT } from "../utils/searchWalk";
```

Update the "never has more than one active node" test — replace:

```ts
    expect(container.querySelectorAll(".search-plane__node--active").length).toBeLessThanOrEqual(1);
```

with:

```ts
    // One active node per walker (primary + each secondary trail) is expected now.
    expect(container.querySelectorAll(".search-plane__node--active").length).toBeLessThanOrEqual(
      1 + SECONDARY_TRAIL_COUNT,
    );
```

Update the "bounded well under a hundred" test — replace:

```ts
    expect(total).toBeLessThan(100);
```

with:

```ts
    // Scales with the number of concurrent walkers (primary + secondary trails).
    expect(total).toBeLessThan(100 * (1 + SECONDARY_TRAIL_COUNT));
```

Update the "does not schedule a new split while paused" test — replace:

```ts
    // Nothing beyond the initial root node should ever appear while paused.
    expect(container.querySelectorAll(".search-plane__node").length).toBe(1);
```

with:

```ts
    // The primary root plus each secondary trail's pre-teleported root spawn
    // immediately on mount regardless of `paused` — only further splits are
    // gated by it.
    expect(container.querySelectorAll(".search-plane__node").length).toBe(1 + SECONDARY_TRAIL_COUNT);
```

- [ ] **Step 8: Write new tests for secondary-trail spawn behavior**

Add a new `describe` block at the end of `src/test/SearchPlane.test.ts`, before the final closing of the file (after the `"SearchPlane route mode"` block):

```ts
describe("SearchPlane secondary trails", () => {
  it("spawns SECONDARY_TRAIL_COUNT extra pre-teleported trails with colored pins and no labels, before any split has run", () => {
    const { container, unmount } = render(SearchPlane, { props: { mode: "search", anchor: 64 } });
    // 1 primary root pin + SECONDARY_TRAIL_COUNT secondary root pins, all
    // present synchronously on mount, before any split timer has fired.
    expect(container.querySelectorAll(".search-plane__pin").length).toBe(1 + SECONDARY_TRAIL_COUNT);
    const coloredHeads = Array.from(
      container.querySelectorAll<HTMLElement>(".search-plane__pin-head"),
    ).filter((el) => el.style.background !== "");
    expect(coloredHeads.length).toBe(SECONDARY_TRAIL_COUNT);
    expect(container.querySelectorAll(".search-plane__label").length).toBe(0);
    unmount();
  });

  it("does not spawn secondary trails in frozen mode", () => {
    const { container, unmount } = render(SearchPlane, { props: { mode: "frozen", anchor: 64 } });
    expect(container.querySelectorAll(".search-plane__pin").length).toBe(1);
    unmount();
  });

  it("does not spawn secondary trails in route mode", () => {
    const stops = Array.from({ length: 5 }, (unused, index) => ({ id: `stop-${index}` }));
    const { container, unmount } = render(SearchPlane, {
      props: { mode: "route", anchor: 46, route: stops },
    });
    const coloredHeads = Array.from(
      container.querySelectorAll<HTMLElement>(".search-plane__pin-head"),
    ).filter((el) => el.style.background !== "");
    expect(coloredHeads.length).toBe(0);
    unmount();
  });

  it("keeps running secondary trails without unbounded growth over an extended run", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const { container, unmount } = render(SearchPlane, { props: { mode: "search", anchor: 64 } });
    await vi.advanceTimersByTimeAsync(60000);
    const total =
      container.querySelectorAll(".search-plane__node").length +
      container.querySelectorAll(".search-plane__edge").length;
    expect(total).toBeGreaterThan(1 + SECONDARY_TRAIL_COUNT);
    expect(total).toBeLessThan(100 * (1 + SECONDARY_TRAIL_COUNT));
    unmount();
  });
});
```

- [ ] **Step 9: Run the full SearchPlane test suite**

Run: `npm run test -- SearchPlane.test.ts`
Expected: PASS — all existing tests (with the 3 updated assertions) plus the 4 new tests, all green.

- [ ] **Step 10: Full-suite regression, lint, typecheck**

Run: `npm run test && npm run lint && npx svelte-check`
Expected: full suite passes, 0 lint errors, 0 typecheck errors.

- [ ] **Step 11: Commit**

```bash
git add src/components/SearchPlane.svelte src/test/SearchPlane.test.ts
git commit -m "feat: add teleporting secondary search trails to SearchPlane"
```

---

## Self-Review Notes

- **Spec coverage:** `SECONDARY_TRAIL_COUNT`/independent random walk → Task 4 Step 2. Teleport-on-exceeding-radius with fresh spawn point/heading/color → Task 3's `runSplit` teleport branch, geometry from Task 1. Pre-teleport fringe left to fade naturally → Task 3's `nodes.map(current:false)` (no removal), reusing the unchanged age/prune pass. Pre-teleported initial spawn → Task 4 Step 2 (`spawnSecondaryWalkers`). No labels on secondary pins → the `config.isPrimary ? pickPlaceName(...) : undefined` branch in Task 3. Pins-only color, dots/edges unchanged → Task 3/4 never touch `--search-node*`/`--search-edge*` usage, only the pin-head's inline style (Task 4 Step 6). Frozen/route untouched → `FROZEN_NODES`/`FROZEN_EDGES`/`routePath` branches never reference walkers, and `spawnSecondaryWalkers` is only ever called from `start()`, itself gated on `mode === "search"`. Camera tracks only primary → only `primaryWalker`'s config sets `onHeadChosen`.
- **Placeholder scan:** none — every step has literal code, no TBD/TODO.
- **Type consistency:** `Walker`/`WalkerConfig` defined once in Task 3, reused verbatim in Task 4; `LiveNode.teamColor` declared in Task 3's interface, set in both Task 3's teleport branch and Task 4's `spawnSecondaryWalkers`; `Point` imported consistently from `searchWalk.ts` throughout.
