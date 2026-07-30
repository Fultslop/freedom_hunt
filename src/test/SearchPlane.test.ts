import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/svelte/svelte5";
import SearchPlane from "../components/SearchPlane.svelte";
import { SECONDARY_TRAIL_COUNT } from "../utils/searchWalk";

const FLANKING_TRAIL_COUNT = 3;
const TOTAL_WALKER_COUNT = 1 + SECONDARY_TRAIL_COUNT + FLANKING_TRAIL_COUNT;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("SearchPlane structure", () => {
  it("renders the four layers (grid, world, pins, labels) as plane children", () => {
    const { container, unmount } = render(SearchPlane, { props: { mode: "frozen", anchor: 64 } });
    const plane = container.querySelector(".search-plane__plane");
    expect(plane?.querySelector(".search-plane__grid")).not.toBeNull();
    expect(plane?.querySelector(".search-plane__world")).not.toBeNull();
    expect(plane?.querySelector(".search-plane__pins")).not.toBeNull();
    expect(plane?.querySelector(".search-plane__labels")).not.toBeNull();
    unmount();
  });

  it("positions the plane at the given anchor percentage", () => {
    const { container, unmount } = render(SearchPlane, { props: { mode: "frozen", anchor: 46 } });
    const plane = container.querySelector(".search-plane__plane") as HTMLElement;
    expect(plane.style.top).toBe("46%");
    unmount();
  });

  it("frozen mode renders a settled tree with no rAF loop and exactly one lit head node", () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");
    const { container, unmount } = render(SearchPlane, { props: { mode: "frozen", anchor: 64 } });
    expect(rafSpy).not.toHaveBeenCalled();
    expect(container.querySelectorAll(".search-plane__node--active").length).toBe(1);
    rafSpy.mockRestore();
    unmount();
  });
});

describe("SearchPlane search mode", () => {
  it("starts a requestAnimationFrame loop when mode is search", () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const { unmount } = render(SearchPlane, { props: { mode: "search", anchor: 64 } });
    expect(rafSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
    unmount();
  });

  it("frozen mode does not schedule any splits", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    const { unmount } = render(SearchPlane, { props: { mode: "frozen", anchor: 64 } });
    vi.advanceTimersByTime(5000);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    unmount();
  });

  it("never has more than one active node, even after many split cycles (regression: exponential branching bug)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const { container, unmount } = render(SearchPlane, { props: { mode: "search", anchor: 64 } });
    // Advance through several full split cycles (worst case ~2.7s each).
    await vi.advanceTimersByTimeAsync(20000);
    expect(container.querySelectorAll(".search-plane__node").length).toBeGreaterThan(1);
    // One active node per walker (primary + each secondary trail) is expected now.
    expect(container.querySelectorAll(".search-plane__node--active").length).toBeLessThanOrEqual(
      TOTAL_WALKER_COUNT,
    );
    unmount();
  });

  it("keeps the live node count bounded well under a hundred over an extended run (regression: unbounded DOM growth)", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const { container, unmount } = render(SearchPlane, { props: { mode: "search", anchor: 64 } });
    await vi.advanceTimersByTimeAsync(60000);
    const total =
      container.querySelectorAll(".search-plane__node").length +
      container.querySelectorAll(".search-plane__edge").length;
    expect(total).toBeGreaterThan(1);
    // Scales with the number of concurrent walkers (primary + secondary trails).
    expect(total).toBeLessThan(100 * TOTAL_WALKER_COUNT);
    // Every walker must still have exactly one live head this far past the
    // prune limit (regression: a pruning bug could cascade-delete the
    // current node itself once its ancestry aged out, silently stalling
    // that walker forever with no active node at all).
    expect(container.querySelectorAll(".search-plane__node--active").length).toBe(TOTAL_WALKER_COUNT);
    unmount();
  }, 15000);

  it("does not schedule a new split while paused, but does not error either", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const { container, unmount } = render(SearchPlane, {
      props: { mode: "search", anchor: 64, paused: true },
    });
    await vi.advanceTimersByTimeAsync(10000);
    // The primary root plus each secondary trail's root spawn (teleporting +
    // flanking) appears immediately on mount regardless of `paused` — only
    // further splits are gated by it.
    expect(container.querySelectorAll(".search-plane__node").length).toBe(TOTAL_WALKER_COUNT);
    unmount();
  });

  it("resumes scheduling once paused flips back to false", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const { container, rerender, unmount } = render(SearchPlane, {
      props: { mode: "search", anchor: 64, paused: false },
    });
    // Let one full cycle resolve, then pause.
    await vi.advanceTimersByTimeAsync(3000);
    const nodesAfterFirstCycle = container.querySelectorAll(".search-plane__node").length;
    expect(nodesAfterFirstCycle).toBeGreaterThan(1);

    await rerender({ mode: "search", anchor: 64, paused: true });
    await vi.advanceTimersByTimeAsync(5000);
    const nodesWhilePaused = container.querySelectorAll(".search-plane__node").length;

    await rerender({ mode: "search", anchor: 64, paused: false });
    await vi.advanceTimersByTimeAsync(3000);
    const nodesAfterResume = container.querySelectorAll(".search-plane__node").length;
    expect(nodesAfterResume).toBeGreaterThan(nodesWhilePaused);
    unmount();
  });

  it("applies the camera position to the plane's transform as splits resolve", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    // Capture the rAF callback without auto-invoking it from inside the mock
    // itself — `frame()` reschedules via requestAnimationFrame(frame), so an
    // implementation that calls back synchronously recurses forever.
    // A holder object (rather than a plain `let`) sidesteps a TS control-flow
    // narrowing quirk where a variable only ever reassigned inside a nested
    // closure gets narrowed to `null` at later, unrelated call sites.
    const rafHolder: { callback: FrameRequestCallback | null } = { callback: null };
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      rafHolder.callback = callback;
      return 1;
    });
    const { container, unmount } = render(SearchPlane, { props: { mode: "search", anchor: 64 } });
    const plane = container.querySelector(".search-plane__plane") as HTMLElement;
    const initialTransform = plane.style.transform;
    await vi.advanceTimersByTimeAsync(3000); // resolves a split cycle, moves cameraTarget off (0,0)
    for (let i = 0; i < 30; i++) {
      rafHolder.callback?.(i * 16);
      await Promise.resolve(); // let Svelte flush the resulting style update
    }
    expect(plane.style.transform).not.toBe(initialTransform);
    expect(plane.style.transform).toContain("translate3d");
    unmount();
  });

  it("drops a pin on the chosen node once a split resolves", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const { container, unmount } = render(SearchPlane, { props: { mode: "search", anchor: 64 } });
    await vi.advanceTimersByTimeAsync(3000);
    expect(container.querySelectorAll(".search-plane__pin").length).toBeGreaterThan(0);
    unmount();
  });

  it("stops the rAF loop and clears timers on unmount", () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = render(SearchPlane, { props: { mode: "search", anchor: 64 } });
    unmount();
    expect(cancelSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
  });

  it("stops the rAF loop when the document becomes hidden", () => {
    // The component reads `document.hidden` (not `visibilityState`) — stub
    // the exact property it checks rather than the one real browsers derive
    // it from, since happy-dom doesn't wire that derivation up for us.
    const originalDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = render(SearchPlane, { props: { mode: "search", anchor: 64 } });
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cancelSpy).toHaveBeenCalled();
    rafSpy.mockRestore();
    unmount();
    if (originalDescriptor) {
      Object.defineProperty(document, "hidden", originalDescriptor);
    } else {
      delete (document as unknown as Record<string, unknown>).hidden;
    }
  });
});

describe("SearchPlane route mode", () => {
  const stops = Array.from({ length: 15 }, (unused, index) => ({ id: `stop-${index}` }));

  it("renders one node per stop, all active-styled, with edges between consecutive stops", () => {
    const { container, unmount } = render(SearchPlane, { props: { mode: "route", anchor: 46, route: stops } });
    expect(container.querySelectorAll(".search-plane__node--active").length).toBe(15);
    expect(container.querySelectorAll(".search-plane__edge--visited").length).toBe(14);
    unmount();
  });

  it("labels only the first, middle, and last stops", () => {
    const { container, unmount } = render(SearchPlane, { props: { mode: "route", anchor: 46, route: stops } });
    expect(container.querySelectorAll(".search-plane__label").length).toBe(3);
    unmount();
  });

  it("does not start a rAF loop in route mode", () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");
    const { unmount } = render(SearchPlane, { props: { mode: "route", anchor: 46, route: stops } });
    expect(rafSpy).not.toHaveBeenCalled();
    unmount();
  });
});

describe("SearchPlane secondary trails", () => {
  it("spawns all secondary trails with colored pins and no labels, before any split has run", () => {
    const { container, unmount } = render(SearchPlane, { props: { mode: "search", anchor: 64 } });
    // 1 primary root pin + all secondary root pins (teleporting + flanking),
    // present synchronously on mount, before any split timer has fired.
    expect(container.querySelectorAll(".search-plane__pin").length).toBe(TOTAL_WALKER_COUNT);
    const coloredPins = Array.from(
      container.querySelectorAll<HTMLElement>(".search-plane__pin"),
    ).filter((pin) => pin.style.getPropertyValue("--pin-team-color") !== "");
    expect(coloredPins.length).toBe(TOTAL_WALKER_COUNT - 1);
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
    const coloredPins = Array.from(
      container.querySelectorAll<HTMLElement>(".search-plane__pin"),
    ).filter((pin) => pin.style.getPropertyValue("--pin-team-color") !== "");
    expect(coloredPins.length).toBe(0);
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
    expect(total).toBeGreaterThan(TOTAL_WALKER_COUNT);
    expect(total).toBeLessThan(100 * TOTAL_WALKER_COUNT);
    unmount();
  }, 15000);
});
