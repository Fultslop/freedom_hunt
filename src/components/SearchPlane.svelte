<script lang="ts">
  import { onMount } from "svelte";
  import {
    HEAD_ANGLE, pickChildCount, computeChildHeadings, edgeLength,
    splitDurationMs, lerpCamera, ageStep, FADE_AFTER_STEPS, removeAfterSteps,
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
  }
  interface LiveEdge {
    id: string;
    fromId: string;
    toId: string;
    state: "growing" | "active" | "visited";
  }

  let idCounter = 0;

  // Exactly one node is ever `current` (the advancing search head). A split
  // creates k siblings from that head; one is chosen to become the new head,
  // the rest sit as dead-end nodes that age and eventually get pruned. This
  // keeps the tree at a single wandering path plus a bounded fringe of fading
  // dead ends — NOT every node branching every cycle (that grows the DOM
  // exponentially and is what previously froze the tab).
  let nodes = $state<LiveNode[]>([
    { id: "root", x: 0, y: 0, heading: HEAD_ANGLE, age: 0, current: true, hasPin: true },
  ]);
  let edges = $state<LiveEdge[]>([]);
  let camera = $state<Point>({ x: 0, y: 0 });
  let cameraTarget = $state<Point>({ x: 0, y: 0 });
  let usedLabels = new Set<string>();
  let pendingTimers: ReturnType<typeof setTimeout>[] = [];
  let frameId: number | null = null;
  let pendingResumeHeadId: string | null = null;
  let running = false;

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

  function isWideViewport(): boolean {
    return typeof window !== "undefined" && window.innerWidth >= 1200;
  }

  function clearAllTimers() {
    for (const timer of pendingTimers) {
      clearTimeout(timer);
    }
    pendingTimers = [];
  }

  /** Runs one full split cycle starting from `headId`, then (unless paused) schedules the next one. */
  function runSplit(headId: string) {
    const head = nodes.find((n) => n.id === headId);
    if (running && head) {
      const k = pickChildCount();
      const headings = computeChildHeadings(head.heading, k);
      const children: LiveNode[] = headings.map((heading) => {
        const len = edgeLength();
        idCounter += 1;
        return {
          id: `n${idCounter}`,
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

      // done + 250: choose a child, retarget the camera, mark its edge active.
      pendingTimers.push(
        setTimeout(() => {
          if (running) {
            const chosen = children[Math.floor(Math.random() * children.length)];
            edges = edges.map((e) => (e.toId === chosen.id ? { ...e, state: "active" } : e));
            cameraTarget = { x: chosen.x, y: chosen.y };

            // done + 500: the chosen child becomes the new head; label fades in.
            pendingTimers.push(
              setTimeout(() => {
                if (running) {
                  const label = pickPlaceName(usedLabels);
                  usedLabels.add(label);
                  nodes = nodes.map((n) => ({
                    ...n,
                    current: n.id === chosen.id,
                    ...(n.id === chosen.id ? { hasPin: true, label, age: 0 } : {}),
                  }));
                }
              }, 250),
            );

            // done + 1300: chosen edge settles to visited; age/prune; next split.
            pendingTimers.push(
              setTimeout(() => {
                if (running) {
                  edges = edges.map((e) => (e.toId === chosen.id ? { ...e, state: "visited" } : e));
                  nodes = ageStep(nodes as (LiveNode & { age: number })[]) as LiveNode[];
                  const limit = removeAfterSteps(isWideViewport());
                  const survivors = new Set(
                    nodes.filter((n) => n.current || n.age < limit).map((n) => n.id),
                  );
                  nodes = nodes.filter((n) => survivors.has(n.id));
                  edges = edges.filter((e) => survivors.has(e.fromId) && survivors.has(e.toId));

                  // A brief rest once the search settles somewhere new, before
                  // the next fan-out — reads as pausing to look around rather
                  // than branching the instant it lands. `paused`/`running`
                  // are re-checked when this fires, not when it's scheduled,
                  // since either can flip during the rest.
                  const restMs = 1000 + Math.random() * 1000;
                  pendingTimers.push(
                    setTimeout(() => {
                      if (running) {
                        if (paused) {
                          pendingResumeHeadId = chosen.id;
                        } else {
                          runSplit(chosen.id);
                        }
                      }
                    }, restMs),
                  );
                }
              }, 1050),
            );
          }
        }, duration + 250),
      );
    }
  }

  function frame() {
    camera = lerpCamera(camera, cameraTarget);
    frameId = requestAnimationFrame(frame);
  }

  function start() {
    if (mode === "search" && !prefersReducedMotion) {
      running = true;
      if (frameId === null) {
        frameId = requestAnimationFrame(frame);
      }
      if (paused) {
        pendingResumeHeadId = nodes.find((n) => n.current)?.id ?? "root";
      } else {
        const headId = nodes.find((n) => n.current)?.id ?? "root";
        runSplit(headId);
      }
    }
  }

  function stop() {
    running = false;
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    clearAllTimers();
  }

  function handleVisibility() {
    if (document.hidden) {
      stop();
    } else if (mode === "search" && !prefersReducedMotion) {
      start();
    }
  }

  // Resume scheduling once `paused` flips back to false; do nothing while
  // it's true (in-flight timers above already stop chaining further splits).
  $effect(() => {
    if (mode === "search" && !paused && pendingResumeHeadId) {
      const headId = pendingResumeHeadId;
      pendingResumeHeadId = null;
      runSplit(headId);
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
    effectiveMode === "frozen" ? FROZEN_NODES : effectiveMode === "route" && routePath ? routePath.nodes : nodes,
  );
  let displayEdges = $derived(
    effectiveMode === "frozen" ? FROZEN_EDGES : effectiveMode === "route" && routePath ? routePath.edges : edges,
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
            style={`left:${from.x}px; top:${from.y}px; width:${Math.hypot(to.x - from.x, to.y - from.y)}px; transform: rotate(${Math.atan2(to.y - from.y, to.x - from.x)}rad);`}
          ></div>
        {/if}
      {/each}
      {#each displayNodes as nodeItem (nodeItem.id)}
        <div
          class={`search-plane__node${nodeItem.current ? " search-plane__node--active" : ""}${!nodeItem.current && nodeItem.age >= FADE_AFTER_STEPS ? " search-plane__node--fading" : ""}`}
          style={`left:${nodeItem.x}px; top:${nodeItem.y}px;`}
        ></div>
      {/each}
    </div>
    <div class="search-plane__pins">
      {#each displayNodes.filter((n) => n.hasPin) as nodeItem (nodeItem.id)}
        <div class="search-plane__pin" style={`left:${nodeItem.x}px; top:${nodeItem.y}px;`}>
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
