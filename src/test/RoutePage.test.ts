import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { titleBarStore } from "../stores/titleBarStore";
import { themeStore } from "../stores/themeStore";
import { authStore } from "../stores/authStore";
import RoutePage from "../pages/RoutePage.svelte";
import type { RouteEntry } from "../types/data";
import { buildFormStorageKey, saveFormState } from "../utils/formStorage";

const {
  mockLocations,
  mockMixedEntries,
  mockPrecededByTextEntries,
  mockReEntryLockedEntries,
  mockCheckpointGateEntries,
  mockLeadingCheckpointEntries,
  mockCheckpointSucceedEntries,
  mockEulaEntries,
  mockConsentEntries,
  mockCompletionEntries,
  mockRepeatSplashEntries,
  mockFinishLineEntries,
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
  mockConsentEntries: [
    {
      "template-type": "consent",
      "nav-bar": { visible: false },
      heading: "Before you begin",
      intro: "A few things to know.",
      minimumAge: 16,
      safety: { heading: "Stay safe", items: [{ icon: "Phone", text: "Call 112." }] },
      photos: { heading: "About your photos", items: [{ icon: "Eye", text: "Others can see your photos." }] },
      fields: [],
      primaryButtonText: "Go",
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
  mockReEntryLockedEntries: [
    {
      "template-type": "options",
      "nav-bar": { visible: false },
      title: "Before You Begin",
      options: [{ text: "I understand", target: { type: "page", value: "continue" } }],
    },
    { "template-type": "checkpoint", "re-entry": false },
    {
      title: "Loc 1",
      name: { value: "Location 1" },
      coordinates: { latitude: 52.0, longitude: 4.0 },
      storyline: "Story 1",
      breadcrumb: "Step 1",
      challenge: { name: "Challenge 1", description: "Desc 1", form: [] },
    },
    {
      title: "Loc 2",
      name: { value: "Location 2" },
      coordinates: { latitude: 52.1, longitude: 4.1 },
      storyline: "Story 2",
      breadcrumb: "Step 2",
      challenge: { name: "Challenge 2", description: "Desc 2", form: [] },
    },
  ],
  mockCheckpointGateEntries: [
    {
      title: "Loc 1",
      name: { value: "Location 1" },
      coordinates: { latitude: 52.0, longitude: 4.0 },
      storyline: "Story 1",
      breadcrumb: "Step 1",
      challenge: {
        name: "Challenge 1",
        description: "Desc 1",
        form: [{ id: "note", type: "string" as const, label: "Your note" }],
      },
    },
    {
      "template-type": "checkpoint",
      entry: {
        requirements: [
          {
            type: "forms",
            requires_all_forms_completed: true,
            on_fail: { message: "Forms still open" },
          },
        ],
        skippable: true,
      },
    },
    {
      title: "Loc 2",
      name: { value: "Location 2" },
      coordinates: { latitude: 52.1, longitude: 4.1 },
      storyline: "Story 2",
      breadcrumb: "Step 2",
      challenge: { name: "Challenge 2", description: "Desc 2", form: [] },
    },
  ],
  mockLeadingCheckpointEntries: [
    { "template-type": "checkpoint" },
    {
      title: "Loc 1",
      name: { value: "Location 1" },
      coordinates: { latitude: 52.0, longitude: 4.0 },
      storyline: "Story 1",
      breadcrumb: "Step 1",
      challenge: { name: "Challenge 1", description: "Desc 1", form: [] },
    },
  ],
  mockCheckpointSucceedEntries: [
    {
      title: "Loc 1",
      name: { value: "Location 1" },
      coordinates: { latitude: 52.0, longitude: 4.0 },
      storyline: "Story 1",
      breadcrumb: "Step 1",
      challenge: { name: "Challenge 1", description: "Desc 1", form: [] },
    },
    {
      "template-type": "checkpoint",
      entry: { on_succeed: { message: "Ready to finish?" } },
    },
    {
      title: "Loc 2",
      name: { value: "Location 2" },
      coordinates: { latitude: 52.1, longitude: 4.1 },
      storyline: "Story 2",
      breadcrumb: "Step 2",
      challenge: { name: "Challenge 2", description: "Desc 2", form: [] },
    },
  ],
  mockPrecededByTextEntries: [
    { "template-type": "text", title: "Heads up", text: "Read this first." },
    {
      title: "Loc 1",
      name: { value: "Location 1" },
      coordinates: { latitude: 52.0, longitude: 4.0 },
      storyline: "Story 1",
      breadcrumb: "Step 1",
      challenge: {
        name: "Challenge 1",
        description: "Desc 1",
        form: [{ id: "note", type: "string" as const, label: "Your note" }],
      },
    },
  ],
  mockFinishLineEntries: [
    {
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
      title: "Loc 2",
      name: { value: "Location 2" },
      coordinates: { latitude: 52.1, longitude: 4.1 },
      storyline: "Story 2",
      breadcrumb: "Step 2",
      challenge: {
        name: "Challenge 2",
        description: "Desc 2",
        form: [{ id: "note2", type: "string" as const, label: "Second note", isRequired: true }],
      },
    },
    {
      "template-type": "completion",
      image: "lange-vijverberg.jpg",
      title: "You made it.",
      subtitle: "Democrats Abroad 2026 Scavenger Hunt",
      place: "The Hague · short loop",
      registration: { text: "Check your registration", url: "https://example.org" },
      "nav-bar": { visible: false },
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
  fetchConsentVersion: vi.fn().mockResolvedValue({ ok: true, consentVersion: 1 }),
}));

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  localStorage.clear();
  themeStore.setThemeName("wireframe");
  authStore.loginParticipant("democrats_abroad", "Team A", "");
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
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
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

  await fireEvent.click(nextBtn);
  expect(await screen.findByText(/please/i)).toBeInTheDocument();
  await fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
  await waitFor(() => expect(screen.queryByText(/please/i)).not.toBeInTheDocument());

  await fireEvent.click(nextBtn);
  expect(await screen.findByText(/please/i)).toBeInTheDocument();
});

test("Next recovers via a fallback timer if transitionend never fires (e.g. an extension strips CSS transitions)", async () => {
  // Regression test for a real participant report: Next stopped responding on
  // her laptop with no error beyond an unrelated browser-extension console
  // message. In carousel/peek swipe mode, committing an advance depends
  // entirely on a real `transitionend` event to reset isAnimating — if the
  // browser (or an extension) ever drops that event, isAnimating gets stuck
  // true and every future click silently no-ops. This test never fires a real
  // transitionend (simulating that failure) and relies solely on the fallback
  // timer in RoutePage.svelte to recover, across three consecutive advances.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockMixedEntries as RouteEntry[]);
  themeStore.setThemeName("app");
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");

  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await vi.advanceTimersByTimeAsync(500);
  expect(await screen.findByText("Between Stops")).toBeInTheDocument();

  await fireEvent.click(await screen.findByRole("button", { name: "Next" }));
  await vi.advanceTimersByTimeAsync(500);
  expect(await screen.findByText("Location 2")).toBeInTheDocument();

  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await vi.advanceTimersByTimeAsync(500);
  expect(await screen.findByText("The End")).toBeInTheDocument();

  vi.useRealTimers();
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
  await fireEvent.click(await screen.findByRole("button", { name: "Next" }));
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

test("badge number reflects location ordinal, not raw array position, when a non-location entry precedes it", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockMixedEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  expect(screen.getByTestId("location-badge")).toHaveTextContent("1");

  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i })); // -> text screen
  await screen.findByText("Between Stops");
  await fireEvent.click(await screen.findByRole("button", { name: "Next" })); // -> Location 2, raw index 2
  await screen.findByText("Location 2");
  expect(screen.getByTestId("location-badge")).toHaveTextContent("2");
});

test("form answers persist under a key keyed by the route's location id, unaffected by a preceding non-location entry", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockPrecededByTextEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Heads up");
  await fireEvent.click(await screen.findByRole("button", { name: "Next" }));
  await screen.findByText("Location 1");
  await fireEvent.input(screen.getByLabelText("Your note"), { target: { value: "some text" } });
  await fireEvent.click(await screen.findByRole("button", { name: /submit/i }));
  await fireEvent.click(await screen.findByRole("button", { name: /confirm/i }));
  await waitFor(() => {
    const stored = localStorage.getItem("democrats_abroad/Team A/den_haag/short_loop/002/form");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).submitted).toBe(true);
  });
});

test("checkpoint entry gate blocks Next and shows the fail message when its forms requirement is unmet", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockCheckpointGateEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  expect(await screen.findByText("Forms still open")).toBeInTheDocument();
  expect(screen.getByText("Location 1")).toBeInTheDocument();
});

test("Skip on a failed checkpoint gate advances past it", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockCheckpointGateEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await screen.findByText("Forms still open");
  await fireEvent.click(await screen.findByRole("button", { name: "Skip" }));
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
});

test("Go Back on a failed checkpoint gate leaves the participant in place", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockCheckpointGateEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await screen.findByText("Forms still open");
  await fireEvent.click(await screen.findByRole("button", { name: "Go Back" }));
  expect(screen.queryByText("Forms still open")).not.toBeInTheDocument();
  expect(screen.getByText("Location 1")).toBeInTheDocument();
});

test("checkpoint gate passes silently when its forms requirement is already met", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockCheckpointGateEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.input(screen.getByLabelText("Your note"), { target: { value: "answer" } });
  await fireEvent.click(await screen.findByRole("button", { name: /submit/i }));
  await fireEvent.click(await screen.findByRole("button", { name: /confirm/i }));
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
  expect(screen.queryByText("Forms still open")).not.toBeInTheDocument();
});

test("on_succeed shows a confirm dialog; Continue advances, Cancel leaves the participant in place", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockCheckpointSucceedEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  expect(await screen.findByText("Ready to finish?")).toBeInTheDocument();
  await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByText("Ready to finish?")).not.toBeInTheDocument();
  expect(screen.getByText("Location 1")).toBeInTheDocument();

  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
});

test("a checkpoint at the very start of a route is silently skipped on mount", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockLeadingCheckpointEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  expect(await screen.findByText("Location 1")).toBeInTheDocument();
});

test("a route with no checkpoints is completely unaffected (regression)", async () => {
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  const nextBtn = await screen.findByRole("button", { name: /next stop/i });
  await fireEvent.click(nextBtn);
  expect(await screen.findByText("Location 2")).toBeInTheDocument();
});

test("Prev is hidden once a re-entry-blocked checkpoint has been crossed", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockReEntryLockedEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Before You Begin");
  await fireEvent.click(screen.getByText("I understand"));
  expect(await screen.findByText("Location 1")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /previous stop/i })).not.toBeInTheDocument();
});

test("Prev still works normally between two entries after a re-entry-blocked checkpoint", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockReEntryLockedEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Before You Begin");
  await fireEvent.click(screen.getByText("I understand"));
  await screen.findByText("Location 1");
  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await screen.findByText("Location 2");
  await fireEvent.click(await screen.findByRole("button", { name: /previous stop/i }));
  expect(await screen.findByText("Location 1")).toBeInTheDocument();
});

test("Prev is hidden at the very start of a route even when a leading checkpoint shifted currentIndex off 0", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockLeadingCheckpointEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  expect(screen.queryByRole("button", { name: /previous stop/i })).not.toBeInTheDocument();
});

test("hides the nav bar for an entry with nav-bar.visible: false", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockEulaEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Before You Begin");
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
    expect.objectContaining({ locationId: "001", answers: { selected: "I understand" } }),
  );
  expect(screen.getByText("End of route")).toBeInTheDocument();
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

  await fireEvent.click(await screen.findByRole("button", { name: "Next" }));
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

test("computes stops-completed from real form-submission state, and shows it on the completion screen", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockFinishLineEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("Location 1");
  await fireEvent.input(screen.getByLabelText("Your note"), { target: { value: "some text" } });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  await screen.findByRole("button", { name: /saved/i });

  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await screen.findByText("Location 2");
  await fireEvent.input(screen.getByLabelText("Second note"), { target: { value: "more text" } });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  await screen.findByRole("button", { name: /saved/i });

  await fireEvent.click(await screen.findByRole("button", { name: /next stop/i }));
  await screen.findByText("You made it.");

  await vi.waitFor(() => {
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

test("shows photos-taken and time-on-foot from local storage, and stages the progress bar from the real stops-completed fraction to 100%", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(8_280_000);
  localStorage.setItem("democrats_abroad/Team A/den_haag/short_loop", "2");
  saveFormState(buildFormStorageKey("democrats_abroad", "den_haag", "short_loop", "001", "Team A"), {
    values: {},
    uploads: { pic: { status: "success", httpCode: 200 } },
    submitted: true,
    skipped: false,
    touchedFields: [],
    submittedAt: 0,
  });
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockFinishLineEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await screen.findByText("You made it.");

  let progress: { current: number; total: number; animateMs?: number } | null = null;
  titleBarStore.subscribe((state) => {
    if (state.progress !== undefined) {
      progress = state.progress;
    }
  })();
  expect(progress).toEqual({ current: 1, total: 2, animateMs: 900 });

  vi.advanceTimersByTime(2000);

  await vi.waitFor(() => {
    expect(screen.getAllByText("1").length).toBe(2);
    expect(screen.getByText("2h 18m")).toBeInTheDocument();
  });

  titleBarStore.subscribe((state) => {
    if (state.progress !== undefined) {
      progress = state.progress;
    }
  })();
  expect(progress).toEqual({ current: 2, total: 2, animateMs: 900 });
  vi.useRealTimers();
});

test("redirects to the consent entry's index when the cached consent version is stale, even mid-route", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  const { fetchConsentVersion } = await import("../utils/api");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockConsentEntries as RouteEntry[]);
  vi.mocked(fetchConsentVersion).mockResolvedValue({ ok: true, consentVersion: 2 });
  localStorage.setItem("democrats_abroad/den_haag/short_loop", "1"); // already past the consent screen
  localStorage.setItem("democrats_abroad/den_haag/short_loop/consent", JSON.stringify({ consentVersion: 1 }));
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  expect(await screen.findByText("Before you begin")).toBeInTheDocument();
});

test("does not redirect when the cached version matches the current one", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  const { fetchConsentVersion } = await import("../utils/api");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockConsentEntries as RouteEntry[]);
  vi.mocked(fetchConsentVersion).mockResolvedValue({ ok: true, consentVersion: 1 });
  localStorage.setItem("democrats_abroad/Team A/den_haag/short_loop", "1");
  localStorage.setItem("democrats_abroad/Team A//den_haag/short_loop/consent", JSON.stringify({ consentVersion: 1 }));
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  expect(await screen.findByText("Location 1")).toBeInTheDocument();
  expect(screen.queryByText("Before you begin")).not.toBeInTheDocument();
});

test("fails open (no redirect) when the version fetch rejects", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  const { fetchConsentVersion } = await import("../utils/api");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockConsentEntries as RouteEntry[]);
  vi.mocked(fetchConsentVersion).mockRejectedValue(new Error("offline"));
  localStorage.setItem("democrats_abroad/Team A/den_haag/short_loop", "1");
  localStorage.setItem("democrats_abroad/Team A//den_haag/short_loop/consent", JSON.stringify({ consentVersion: 1 }));
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  expect(await screen.findByText("Location 1")).toBeInTheDocument();
  expect(screen.queryByText("Before you begin")).not.toBeInTheDocument();
});

test("does not fetch a version at all when there is no cached consent record (first-time participant)", async () => {
  const { loadLocations } = await import("../utils/loadLocations");
  const { fetchConsentVersion } = await import("../utils/api");
  vi.mocked(fetchConsentVersion).mockClear();
  vi.mocked(loadLocations).mockResolvedValueOnce(mockConsentEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  expect(await screen.findByText("Before you begin")).toBeInTheDocument();
  expect(fetchConsentVersion).not.toHaveBeenCalled();
});

test("does not overwrite a team's saved index when auth resolves after mount (cold-reload race)", async () => {
  authStore.setForTest({ activeAuth: null, authLoading: true, isLoggingOut: false });
  localStorage.setItem("democrats_abroad/Team A/den_haag/short_loop", "5");
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockFinishLineEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  await waitFor(() => {
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });
  // Team A's real saved index must survive the window where auth hasn't
  // resolved yet — the pre-seed placeholder (0) must never be written back.
  expect(localStorage.getItem("democrats_abroad/Team A/den_haag/short_loop")).toBe("5");

  authStore.loginParticipant("democrats_abroad", "Team A", "");
  await waitFor(() => {
    expect(localStorage.getItem("democrats_abroad/Team A/den_haag/short_loop")).toBe("5");
  });
});

test("seeds the real saved index once auth resolves after a cold-reload race", async () => {
  authStore.setForTest({ activeAuth: null, authLoading: true, isLoggingOut: false });
  localStorage.setItem("democrats_abroad/Team A/den_haag/short_loop", "1");
  const { loadLocations } = await import("../utils/loadLocations");
  vi.mocked(loadLocations).mockResolvedValueOnce(mockMixedEntries as RouteEntry[]);
  render(RoutePage, {
    props: { params: { project: "democrats_abroad", city: "den_haag", route: "short_loop" } },
  });
  authStore.loginParticipant("democrats_abroad", "Team A", "");
  // mockMixedEntries[1] is the "Between Stops" text entry — reaching it
  // proves currentIndex was seeded from the real saved value (1), not left
  // at the pre-auth placeholder (0, which would show "Location 1").
  expect(await screen.findByText("Between Stops")).toBeInTheDocument();
});
