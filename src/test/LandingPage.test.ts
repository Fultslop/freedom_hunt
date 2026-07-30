import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { push, location } from "svelte-spa-router";
import { get } from "svelte/store";
import LandingPage from "../pages/LandingPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";

vi.mock("svelte-spa-router", async () => {
  const { writable } = await import("svelte/store");
  return { push: vi.fn(), location: writable("/") };
});

// The real `location` is a read-only derived store; the mock above swaps in
// a writable so tests can drive "the current route" directly. This cast is
// confined to one place rather than sprinkled at every call site.
const setLocation = (path: string) => (location as unknown as { set: (value: string) => void }).set(path);

afterEach(() => {
  vi.clearAllMocks();
  setLocation("/");
});

describe("LandingPage", () => {
  it("renders the two-line wordmark, sub-line, and primary CTA on first paint", () => {
    render(LandingPage, { props: {} });
    expect(screen.getByText("Searchspace")).toBeInTheDocument();
    expect(screen.getByText("Scavenger Hunt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start hunting/i })).toBeInTheDocument();
  });

  it("renders the three nav items with icon-above-label", () => {
    render(LandingPage, { props: {} });
    expect(screen.getByText("Gallery")).toBeInTheDocument();
    expect(screen.getByText("Past hunts")).toBeInTheDocument();
    expect(screen.getByText("Self-host")).toBeInTheDocument();
  });

  it("the primary CTA is never disabled, even before the background animation has produced any nodes", () => {
    render(LandingPage, { props: {} });
    expect(screen.getByRole("button", { name: /start hunting/i })).not.toBeDisabled();
  });

  it("pauses SearchPlane while the join sheet is open (location !== \"/\")", () => {
    setLocation("/start");
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    render(LandingPage, { props: {} });
    // paused=true means no split gets scheduled — only the rAF camera loop starts.
    expect(rafSpy).toHaveBeenCalledTimes(1);
    rafSpy.mockRestore();
  });

  it("sets Step 1 of 2 progress while the sheet is open, and clears it when closed", async () => {
    setLocation("/start");
    render(LandingPage, { props: {} });
    await waitFor(() => expect(get(titleBarStore).progress).toEqual({ current: 1, total: 2 }));

    setLocation("/");
    await waitFor(() => expect(get(titleBarStore).progress).toBeNull());
  });

  it("navigates to /login/demo when the demo button is tapped", async () => {
    setLocation("/start");
    render(LandingPage, { props: {} });
    await fireEvent.click(screen.getByRole("button", { name: /try the demo/i }));
    expect(push).toHaveBeenCalledWith("/login/demo");
  });
});
