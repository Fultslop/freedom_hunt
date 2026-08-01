import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/svelte/svelte5";
import { push } from "svelte-spa-router";
import App from "../App.svelte";
import { themeStore } from "../stores/themeStore";

// App mounts the persistent SearchPlane background on the intro routes, which
// starts a requestAnimationFrame camera loop on mount. happy-dom's rAF never
// drives frames, but mock it anyway so the loop can't spin during a test.
beforeEach(() => {
  vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Landing/join routing", () => {
  it("renders LandingPage for /, /start, and /join/:code", async () => {
    for (const path of ["/", "/start", "/join/abc123"]) {
      await push(path);
      const { container, unmount } = render(App);
      // svelte-spa-router resolves routes asynchronously, even for
      // unguarded components — the match doesn't appear synchronously.
      await waitFor(() => expect(container.querySelector(".landing-page")).not.toBeNull());
      unmount();
    }
    await push("/");
  });

  it("renders TeamSetupPage for /team/:project (not /demo, which no longer routes here)", async () => {
    await push("/team/democrats_abroad");
    const { container, unmount } = render(App);
    await waitFor(() => expect(container.querySelector(".team-setup-page")).not.toBeNull());
    unmount();
    await push("/");
  });
});

describe("persistent intro background", () => {
  it("renders one SearchPlane on the intro routes and none elsewhere", async () => {
    await push("/");
    const { container, unmount } = render(App);
    await waitFor(() => expect(container.querySelector(".search-plane")).not.toBeNull());

    await push("/start");
    await waitFor(() => expect(container.querySelector(".search-plane")).not.toBeNull());

    await push("/team/democrats_abroad");
    await waitFor(() => expect(container.querySelector(".search-plane")).not.toBeNull());

    await push("/login/demo");
    await waitFor(() => expect(container.querySelector(".search-plane")).toBeNull());
    unmount();
    await push("/");
  });

  it("blurs the background on the join-sheet and team-selection screens, not on plain landing", async () => {
    await push("/");
    const { container, unmount } = render(App);
    await waitFor(() => expect(container.querySelector(".app-background")).not.toBeNull());
    expect(container.querySelector(".app-background")!.classList.contains("app-background--blurred")).toBe(false);

    await push("/start");
    await waitFor(() =>
      expect(container.querySelector(".app-background")!.classList.contains("app-background--blurred")).toBe(true),
    );

    await push("/team/democrats_abroad");
    await waitFor(() =>
      expect(container.querySelector(".app-background")!.classList.contains("app-background--blurred")).toBe(true),
    );
    unmount();
    await push("/");
  });
});

describe("App theme token sync", () => {
  it("syncs the new search/intro tokens onto <html> for the active theme", () => {
    themeStore.setThemeName("app");
    render(App);
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--search-node-active")).toBe("#f59e0b");
    expect(style.getPropertyValue("--sheen-image")).toContain("linear-gradient");
  });

  it("clears the sheen image for GWC (no shimmer on a civic brand)", () => {
    themeStore.setThemeName("GWC");
    render(App);
    expect(document.documentElement.style.getPropertyValue("--sheen-image")).toBe("none");
  });
});
