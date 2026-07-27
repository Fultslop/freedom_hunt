import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { titleBarStore } from "../stores/titleBarStore";
import { themeStore } from "../stores/themeStore";
import RoutePage from "../pages/RoutePage.svelte";
import type { RouteEntry } from "../types/data";

const {
  mockLocations,
  mockMixedEntries,
  mockEulaEntries,
  mockCompletionEntries,
  mockRepeatSplashEntries,
  huntSettingsFixture,
} = vi.hoisted(() => ({
  mockLocations: [
    {
      locationId: 1,
      title: "Loc 1",
      name: { value: "Location 1" },
      coordinates: { latitude: 52.0, longitude: 4.0 },
      storyline: "Story 1",
      breadcrumb: "Step 1",
      challenge: {
        name: "Challenge 1",
        description: "Desc 1",
        form: [{ id: "note", type: "string" as const, label: "Your note", isRequired: true }],
      },
    },
    {
      locationId: 2,
      title: "Loc 2",
      name: { value: "Location 2" },
      coordinates: { latitude: 52.1, longitude: 4.1 },
      storyline: "Story 2",
      breadcrumb: "Step 2",
      challenge: { name: "Challenge 2", description: "Desc 2", form: [] },
    },
  ],
  mockMixedEntries: [
    {
      title: "Loc 1",
      name: { value: "Location 1" },
      coordinates: { latitude: 52.0, longitude: 4.0 },
      storyline: "Story 1",
      breadcrumb: "Step 1",
      challenge: { name: "Challenge 1", description: "Desc 1", form: [] },
    },
    { "template-type": "text", title: "Between Stops", text: "Take a breath." },
    {
      title: "Loc 2",
      name: { value: "Location 2" },
      coordinates: { latitude: 52.1, longitude: 4.1 },
      storyline: "Story 2",
      breadcrumb: "Step 2",
      challenge: { name: "Challenge 2", description: "Desc 2", form: [] },
    },
    {
      "template-type": "options",
      title: "The End",
      options: [{ text: "Start over", target: { type: "page", value: "start_route" } }],
    },
  ],
  mockEulaEntries: [
    {
      "template-type": "options",
      "nav-bar": { visible: false },
      title: "Before You Begin",
      options: [
        { text: "I understand", target: { type: "page", value: "continue" }, track: true },
      ],
    },
    {
      title: "Loc 1",
      name: { value: "Location 1" },
      coordinates: { latitude: 52.0, longitude: 4.0 },
      storyline: "Story 1",
      breadcrumb: "Step 1",
      challenge: { name: "Challenge 1", description: "Desc 1", form: [] },
    },
  ],
  mockCompletionEntries: [
    {
      "template-type": "splash",
      image: "celebration.png",
      effect: { type: "confetti" },
      title: "Congratulations!",
    },
  ],
  mockRepeatSplashEntries: [
    {
      title: "Loc A",
      name: { value: "Location A" },
      coordinates: { latitude: 1, longitude: 1 },
      storyline: "s",
      breadcrumb: "b",
      challenge: { name: "", description: "d", form: [] },
    },
    {
      "template-type": "splash",
      image: "x.jpg",
      title: "Congrats",
      effect: { type: "confetti", cooldown: { min: 0, max: 0 }, max: 3 },
    },
    {
      title: "Loc B",
      name: { value: "Location B" },
      coordinates: { latitude: 2, longitude: 2 },
      storyline: "s",
      breadcrumb: "b",
      challenge: { name: "", description: "d", form: [] },
    },
  ],
  huntSettingsFixture: {} as Record<string, unknown>,
}));

// happy-dom's TransitionEvent constructor doesn't honor the `propertyName` init
// option (always undefined), so `fireEvent.transitionEnd(...)` can't be used to
// simulate the carousel's real CSS transition completing. Force it directly.
function fireRealTransitionEnd(element: Element) {
  const event = new Event("transitionend", { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: "transform" });
  element.dispatchEvent(event);
}

function completeCarouselTransition(container: HTMLElement) {
  container
    .querySelectorAll(".route-page__slot--animating")
    .forEach((element) => fireRealTransitionEnd(element));
}

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockImplementation(async (_lang: string, path: string) => {
    if (path.endsWith("routes")) {
      return {
        short_loop: { description: "2.5h route", locations: ["001", "002"] },
        long_loop: {
          description: "4h route",
          locations: ["001", "002", "003"],
        },
      };
    }
    if (path === "projects/democrats_abroad/democrats_abroad") {
      return huntSettingsFixture;
    }
    if (path.includes("/001")) {
      return mockLocations[0];
    }
    if (path.includes("/002")) {
      return mockLocations[1];
    }
    return null;
  }),
}));

vi.mock("../utils/loadLocations", () => ({
  loadLocations: vi.fn().mockResolvedValue(mockLocations),
}));

vi.mock("../utils/api", () => ({
  postFormSubmit: vi.fn().mockResolvedValue({ ok: true }),
  postPhotoUpload: vi.fn().mockResolvedValue({ ok: true, httpCode: 200 }),
}));

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  localStorage.clear();
  themeStore.setThemeName("wireframe");
});

afterEach(() => {
  delete huntSettingsFixture["project.form_required"];
  delete huntSettingsFixture["project.can_forms_skip"];
  themeStore.setThemeName("app");
});

test("renders challenge card", async () => {
  render(RoutePage, {
    props: {
      params: {
        project: "democrats_abroad",
        city: "den_haag",
        route: "short_loop",
      },
    },
  });
  expect(await screen.findByText("Location 1")).toBeInTheDocument();
});

test("Next stays enabled and un-styled when form_required is not set", async () => {
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => {
    expect(nextBtn).not.toHaveClass("route-page__next-btn--pending");
  });
  await fireEvent.click(nextBtn);
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
});

test("blocks Next and shows a toast listing missing fields when form_required and the form is incomplete", async () => {
  huntSettingsFixture["project.form_required"] = true;
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => {
    expect(nextBtn).toHaveClass("route-page__next-btn--pending");
  });
  await fireEvent.click(nextBtn);
  expect(await screen.findByText(/please complete: your note/i)).toBeInTheDocument();
  expect(screen.getByText("Location 1")).toBeInTheDocument();
});

test("allows Next once the required form has been submitted", async () => {
  huntSettingsFixture["project.form_required"] = true;
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  await screen.findByText("Location 1");
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => expect(nextBtn).not.toHaveClass("route-page__next-btn--pending"));
  await fireEvent.click(nextBtn);
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
});

test("shows a Skip button in the toast when can_forms_skip is true, and skipping advances", async () => {
  huntSettingsFixture["project.form_required"] = true;
  huntSettingsFixture["project.can_forms_skip"] = true;
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => expect(nextBtn).toHaveClass("route-page__next-btn--pending"));
  await fireEvent.click(nextBtn);
  await fireEvent.click(await screen.findByRole("button", { name: "Skip" }));
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
});

test("does not show a Skip button in the toast when can_forms_skip is false", async () => {
  huntSettingsFixture["project.form_required"] = true;
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => expect(nextBtn).toHaveClass("route-page__next-btn--pending"));
  await fireEvent.click(nextBtn);
  await screen.findByText(/please complete/i);
  expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
});

test("blocked Next can be clicked repeatedly in carousel swipe mode without getting stuck", async () => {
  // Regression test: the "app"/"GWC" themes use carousel/peek swipe mode, not snap.
  // A blocked Next-button click used to set isAnimating=true with dragOffset
  // already 0, which never fires a real CSS transition, so isAnimating never
  // reset and every subsequent handleDragEnd call (including later clicks) was
  // silently dropped.
  huntSettingsFixture["project.form_required"] = true;
  themeStore.setThemeName("app");
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => expect(nextBtn).toHaveClass("route-page__next-btn--pending"));

  await fireEvent.click(nextBtn);
  expect(await screen.findByText(/please/i)).toBeInTheDocument();
  await fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
  await waitFor(() => expect(screen.queryByText(/please/i)).not.toBeInTheDocument());

  await fireEvent.click(nextBtn);
  expect(await screen.findByText(/please/i)).toBeInTheDocument();
});

test("shows a generic message when form_required is blocking but no individual field is marked required", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce([
    {
      ...mockLocations[0],
      challenge: {
        name: "Challenge 1",
        description: "Desc 1",
        form: [{ id: "note", type: "string" as const, label: "Your note" }],
      },
    },
    mockLocations[1],
  ]);
  huntSettingsFixture["project.form_required"] = true;
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await waitFor(() => expect(nextBtn).toHaveClass("route-page__next-btn--pending"));
  await fireEvent.click(nextBtn);
  expect(await screen.findByText("Please submit the form to continue.")).toBeInTheDocument();
});

test("renders a submitted badge on a location after its form is submitted", async () => {
  render(RoutePage, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" },
    },
  });
  await screen.findByText("Location 1");
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  expect(await screen.findByTestId("badge-status-submitted")).toBeInTheDocument();
});

test("counts only location entries in the progress indicator, holding steady through template screens", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockMixedEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  let progress: { current: number; total: number } | null = null;
  titleBarStore.subscribe((state) => { if (state.progress !== undefined) { progress = state.progress; } })();
  expect(progress).toEqual({ current: 1, total: 2 });

  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i })); // -> text screen (index 1)
  await screen.findByText("Between Stops");
  titleBarStore.subscribe((state) => { if (state.progress !== undefined) { progress = state.progress; } })();
  expect(progress).toEqual({ current: 1, total: 2 }); // holds at last location's ordinal
});

test("renders TextScreen and OptionsScreen entries within a route", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockMixedEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  expect(await screen.findByText("Between Stops")).toBeInTheDocument();
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  expect(await screen.findByText("The End")).toBeInTheDocument();
  expect(await screen.findByText("Start over")).toBeInTheDocument();
});

test("does not render a numbered badge for template-type screens", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockMixedEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await screen.findByText("Between Stops");
  expect(screen.queryByTestId("location-badge")).not.toBeInTheDocument();
});

test("hides the nav bar for an entry with nav-bar.visible: false", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockEulaEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Before You Begin");
  expect(screen.queryByRole("button", { name: "Exit" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /next stop/i })).not.toBeInTheDocument();
});

test("clicking a tracked 'continue' option advances and submits a form even with the nav bar hidden", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  const { postFormSubmit } = await import("../utils/api");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockEulaEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Before You Begin");
  await fireEvent.click(screen.getByText("I understand"));
  expect(await screen.findByText("Location 1")).toBeInTheDocument();
  expect(postFormSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ locationId: 1, answers: { selected: "I understand" } }),
  );
  expect(screen.getByRole("button", { name: "Exit" })).toBeInTheDocument();
});

test("regression: a one-shot splash effect stays visible instead of firing and immediately un-firing itself", async () => {
  // Root cause this guards against: SplashScreen's effect used to read `playEffect`
  // as a normal (tracked) dependency. Firing calls onEffectPlayed, which records
  // fire-history in RoutePage's splashEffectHistory state, which flows back down
  // through RouteScreen as a freshly recomputed `playEffect` (now false, since
  // there's no repeat-effect). That prop change re-ran the tracked effect and its
  // `else` branch flipped the effect back off before the browser ever painted it —
  // confetti fired and un-fired within the same reactive tick and was never
  // visible. This must stay true even after everything settles.
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockCompletionEntries as RouteEntry[]);
  const { container } = render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Congratulations!");
  await waitFor(() => {
    expect(container.querySelector(".confetti-effect")).toBeInTheDocument();
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(container.querySelector(".confetti-effect")).toBeInTheDocument();
});

test("regression: repeat-effect re-fires in carousel swipe mode after leaving and returning one step", async () => {
  // Root cause this guards against: the carousel/peek 3-slot layout keeps
  // neighboring cards pre-mounted and only slides them between roles
  // (prev/current/next) as the participant swipes one step at a time — the
  // SAME SplashScreen instance, showing the SAME entry, just changes role.
  // Triggering re-evaluation off entry/array identity (which never changes in
  // this scenario) meant leaving a repeat-effect splash screen and coming back
  // one step later never turned the effect off, and never fired it again.
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockRepeatSplashEntries as RouteEntry[]);
  themeStore.setThemeName("app"); // carousel mode — the actual production default
  const { container } = render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location A");

  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  completeCarouselTransition(container);
  await screen.findByText("Congrats");
  await waitFor(() => expect(container.querySelector(".confetti-effect")).toBeInTheDocument());

  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  completeCarouselTransition(container);
  await screen.findByText("Location B");
  // Left the splash screen — it must turn off, not just keep showing forever.
  expect(container.querySelector(".confetti-effect")).not.toBeInTheDocument();

  await fireEvent.click(await screen.findByRole("button", { name: /previous stop/i }));
  completeCarouselTransition(container);
  await screen.findByText("Congrats");
  // Back on the splash screen with repeat-effect budget remaining — must re-fire.
  await waitFor(() => expect(container.querySelector(".confetti-effect")).toBeInTheDocument());
});
