<script lang="ts">
  import { onMount } from "svelte";
import {
  HEAD_ANGLE, pickChildCount, computeChildHeadings, edgeLength,
  splitDurationMs, lerpCamera, ageStep, removeAfterSteps, fadeOpacity,
  pickTeleportSpawn, isOutsideRadius,
  TELEPORT_RADIUS, SECONDARY_TRAIL_COUNT,
  type Point,
} from "../utils/searchWalk";
  import { pickPlaceName } from "../utils/placeNames";
  import { themeStore } from "../stores/themeStore";
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
    teamColorIndex?: number;
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
    /** Color index into the current theme's searchTeamColors palette. Set on
     * secondary walkers so every pin they drop carries the team color. */
    colorIndex?: number;
    /** Only the primary walker sets this — retargets the camera each time it picks a new head. */
    onHeadChosen?: (point: Point) => void;
    /** Only secondary walkers set this — teleports the walker back near `getTargetPosition()` once it wanders past `radius`. */
    teleport?: {
      getTargetPosition: () => Point;
      radius: number;
      palette: string[];
    };
    /** When set, the walker aims its first split toward this target (the
     * direction is computed once at spawn and used only for the initial fan-
     * out). Subsequent splits use the normal clamped random walk. */
    initialSteerTarget?: () => Point;
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
    let hasSteered = false;

    function clearAllTimers() {
      for (const timer of pendingTimers) {
        clearTimeout(timer);
      }
      pendingTimers = [];
    }

    function runSplit(headId: string) {
      const head = nodes.find((n) => n.id === headId);
      if (running && head) {
        const k = pickChildCount();
        const steerTarget = !hasSteered && config.initialSteerTarget ? config.initialSteerTarget() : null;
        hasSteered = true;
        const baseHeading = steerTarget
          ? Math.atan2(steerTarget.y - head.y, steerTarget.x - head.x)
          : head.heading;
        const headings = computeChildHeadings(baseHeading, k, undefined, !!steerTarget);
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
            let teleportColorIndex: number | undefined;
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
              teleportColorIndex = Math.floor(Math.random() * config.teleport.palette.length);
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
                      { ...nextHead, current: true, hasPin: true, teamColorIndex: teleportColorIndex },
                    ];
                    } else {
                      const label = config.isPrimary ? pickPlaceName(usedLabels) : undefined;
                      if (label) {
                        usedLabels.add(label);
                      }
                    nodes = nodes.map((n) => ({
                      ...n,
                      current: n.id === nextHead.id,
                      ...(n.id === nextHead.id ? { hasPin: true, label, age: 0, teamColorIndex: config.colorIndex } : {}),
                    }));
                    }

                    // done + 1300: chosen edge settles to visited (skipped for a
                    // teleport spawn, which has no connecting edge); age/prune; next split.
                    pendingTimers.push(
                      setTimeout(() => {
                        if (running) {
                          if (isTeleport) {
                            edges = edges.map((e) => (e.toId === geometricChoice.id ? { ...e, state: "visited" } : e));
                          } else {
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

  let secondaryWalkers = $state<Walker[]>([]);

  /** Spawns SECONDARY_TRAIL_COUNT teleporting trails plus two fixed-position
   * off-screen flanking trails (left and right behind the primary trail,
   * aimed toward it) that wander in on their own without teleport.
   * Only runs once per mount. */
  function spawnSecondaryWalkers() {
    if (secondaryWalkers.length === 0) {
      const palette = $themeStore.theme.searchTeamColors;
      const walkers: Walker[] = [];

      // Teleporting secondary trails — wander anywhere, teleport back when
      // they drift past TELEPORT_RADIUS from the primary head.
      for (let i = 0; i < SECONDARY_TRAIL_COUNT; i++) {
        const spawn = pickTeleportSpawn(primaryWalker.currentHeadPosition, TELEPORT_RADIUS);
        const colorIndex = Math.floor(Math.random() * palette.length);
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
              teamColorIndex: colorIndex,
            },
            isPrimary: false,
            colorIndex,
            teleport: {
              getTargetPosition: () => primaryWalker.currentHeadPosition,
              radius: TELEPORT_RADIUS,
              palette,
            },
          }),
        );
      }

      // Fixed-position flanking trails — start off-screen left/right/behind
      // the primary trail's start, aimed toward it, then wander using normal
      // split/choose/prune logic without ever teleporting.
      const flankOffsets = [
        { x: -1200, y: -1400 },
        { x: 1200, y: -1300 },
        { x: 0, y: -1200 },
      ];
      for (const offset of flankOffsets) {
        const point: Point = {
          x: primaryWalker.currentHeadPosition.x + offset.x,
          y: primaryWalker.currentHeadPosition.y + offset.y,
        };
        const heading = Math.atan2(
          primaryWalker.currentHeadPosition.y - point.y,
          primaryWalker.currentHeadPosition.x - point.x,
        );
        const colorIndex = Math.floor(Math.random() * palette.length);
        walkers.push(
          createWalker({
            rootNode: {
              id: nextId(),
              x: point.x,
              y: point.y,
              heading,
              age: 0,
              current: true,
              hasPin: true,
              teamColorIndex: colorIndex,
            },
            isPrimary: false,
            colorIndex,
            initialSteerTarget: () => primaryWalker.currentHeadPosition,
          }),
        );
      }

      secondaryWalkers = walkers;
    }
  }

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

  function handleVisibility() {
    if (document.hidden) {
      stop();
    } else if (mode === "search" && !prefersReducedMotion) {
      start();
    }
  }

  $effect(() => {
    if (mode === "search") {
      for (const walker of [primaryWalker, ...secondaryWalkers]) {
        walker.setPaused(paused);
      }
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

  let allNodes = $derived([...primaryWalker.nodes, ...secondaryWalkers.flatMap((walker) => walker.nodes)]);
  let allEdges = $derived([...primaryWalker.edges, ...secondaryWalkers.flatMap((walker) => walker.edges)]);

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

<div class="search-plane" aria-hidden="true">
  <div class="search-plane__plane" style={`top: ${anchor}%; transform: ${planeTransform};`}>
    <div class="search-plane__grid" style={`transform: ${gridTransform};`}></div>
    <div class="search-plane__world">
      {#each displayEdges as edgeItem (edgeItem.id)}
        {@const from = displayNodes.find((nodeItem) => nodeItem.id === edgeItem.fromId)}
        {@const to = displayNodes.find((nodeItem) => nodeItem.id === edgeItem.toId)}
        {#if from && to}
          <div
            class={`search-plane__edge${edgeItem.state === "visited" ? " search-plane__edge--visited" : ""}${edgeItem.state === "active" ? " search-plane__edge--active" : ""}`}
            style={`left:${from.x}px; top:${from.y}px; width:${Math.hypot(to.x - from.x, to.y - from.y)}px; transform: rotate(${Math.atan2(to.y - from.y, to.x - from.x)}rad); opacity:${fadeOpacity(to.age, isWideViewport())};`}
          ></div>
        {/if}
      {/each}
      {#each displayNodes as nodeItem (nodeItem.id)}
        <div
          class={`search-plane__node${nodeItem.current ? " search-plane__node--active" : ""}`}
          style={`left:${nodeItem.x}px; top:${nodeItem.y}px; opacity:${nodeItem.current ? 1 : fadeOpacity(nodeItem.age, isWideViewport())};`}
        ></div>
      {/each}
    </div>
    <div class="search-plane__pins">
      {#each displayNodes.filter((n) => n.hasPin) as nodeItem (nodeItem.id)}
        {@const teamColor = nodeItem.teamColorIndex !== undefined ? $themeStore.theme.searchTeamColors[nodeItem.teamColorIndex] : undefined}
        <div class="search-plane__pin" style={`left:${nodeItem.x}px; top:${nodeItem.y}px; opacity:${fadeOpacity(nodeItem.age, isWideViewport())};${teamColor ? ` --pin-team-color: ${teamColor};` : ''}`}>
          <div class="search-plane__pin-head"></div>
          <div class="search-plane__pin-stem"></div>
        </div>
      {/each}
    </div>
    <div class="search-plane__labels">
      {#each displayNodes as nodeItem (nodeItem.id)}
        {#if nodeItem.label}
          <div class="search-plane__label" style={`left:${nodeItem.x}px; top:${nodeItem.y + 14}px;`}>
            {nodeItem.label}
          </div>
        {/if}
      {/each}
    </div>
  </div>
</div>
