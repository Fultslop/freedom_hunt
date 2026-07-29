import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import RouteScreen from "../components/RouteScreen.svelte";
import type { RouteEntry } from "../types/data";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));
vi.mock("../actions/leafletMap", () => ({
  leafletMap: vi.fn(() => ({ update: vi.fn(), destroy: vi.fn() })),
}));
vi.mock("../utils/api", () => ({
  postFormSubmit: vi.fn().mockResolvedValue({ ok: true }),
  postPhotoUpload: vi.fn().mockResolvedValue({ ok: true, httpCode: 200 }),
}));
vi.mock("svelte-spa-router", () => ({ push: vi.fn() }));

const location = {
  title: "Binnenhof",
  name: { value: "Binnenhof" },
  coordinates: { latitude: 52.08, longitude: 4.31 },
  storyline: "s",
  breadcrumb: "b",
  challenge: { name: "", description: "d", form: [] },
};

test("renders ChallengeCard for a location entry", () => {
  render(RouteScreen, { props: { entry: location as RouteEntry, index: 1 } });
  expect(screen.getAllByText("Binnenhof").length).toBeGreaterThan(0);
  expect(screen.getByTestId("location-badge")).toHaveTextContent("1");
});

test("renders TextScreen for a text entry", () => {
  render(RouteScreen, {
    props: { entry: { "template-type": "text", title: "Intro", text: "hi" } as RouteEntry, index: 2 },
  });
  expect(screen.getByText("Intro")).toBeInTheDocument();
});

test("renders OptionsScreen for an options entry", () => {
  render(RouteScreen, {
    props: {
      entry: {
        "template-type": "options",
        title: "Pick one",
        options: [{ text: "Go", target: { type: "page", value: "title" } }],
      } as RouteEntry,
      index: 3,
      project: "demo",
      cityId: "new_york",
      routeId: "brooklyn_route",
    },
  });
  expect(screen.getByText("Pick one")).toBeInTheDocument();
  expect(screen.getByText("Go")).toBeInTheDocument();
});

test("forwards onContinue to OptionsScreen for a 'continue' target", async () => {
  const onContinue = vi.fn();
  render(RouteScreen, {
    props: {
      entry: {
        "template-type": "options",
        title: "Before You Begin",
        options: [{ text: "I understand", target: { type: "page", value: "continue" } }],
      } as RouteEntry,
      index: 1,
      onContinue,
    },
  });
  await fireEvent.click(screen.getByText("I understand"));
  expect(onContinue).toHaveBeenCalledTimes(1);
});

test("renders SplashScreen for a splash entry with the effect visible", () => {
  const { container } = render(RouteScreen, {
    props: {
      entry: { "template-type": "splash", image: "x.jpg", title: "Yay", effect: { type: "confetti" } } as RouteEntry,
      index: 4,
      isCurrent: true,
    },
  });
  expect(screen.getByText("Yay")).toBeInTheDocument();
  expect(container.querySelector(".confetti-effect")).toBeInTheDocument();
});

test("renders nothing for a checkpoint entry instead of falling through to ChallengeCard", () => {
  const { container } = render(RouteScreen, {
    props: { entry: { "template-type": "checkpoint", "re-entry": false } as RouteEntry, index: 1 },
  });
  expect(container.querySelector(".cc-root")).not.toBeInTheDocument();
  expect(screen.queryByTestId("location-badge")).not.toBeInTheDocument();
});

test("renders CompletionScreen for a completion entry", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  render(RouteScreen, {
    props: {
      entry: {
        "template-type": "completion",
        image: "lange-vijverberg.jpg",
        title: "You made it.",
        subtitle: "Democrats Abroad 2026 Scavenger Hunt",
        place: "The Hague · short loop",
        buttons: [
          { text: "Check your registration", target: { type: "link", value: "https://example.org" } },
        ],
      } as RouteEntry,
      index: 9,
      project: "demo",
      cityId: "new_york",
      stats: { stopsCompleted: 5, stopsTotal: 6, photosCount: 3, timeOnFoot: "1h 20m" },
    },
  });
  await vi.advanceTimersByTimeAsync(2000);
  expect(screen.getByText("You made it.")).toBeInTheDocument();
  expect(screen.getByText("1h 20m")).toBeInTheDocument();
  vi.useRealTimers();
});

test("passes a zeroed placeholder stats object to CompletionScreen when stats is not provided", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  render(RouteScreen, {
    props: {
      entry: {
        "template-type": "completion",
        image: "x.jpg",
        title: "Done",
        subtitle: "s",
        place: "p",
        buttons: [
          { text: "t", target: { type: "link", value: "u" } },
        ],
      } as RouteEntry,
      index: 9,
    },
  });
  await vi.advanceTimersByTimeAsync(2000);
  expect(screen.getByText("Done")).toBeInTheDocument();
  expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  vi.useRealTimers();
});

test("does not show the effect on a splash entry when isCurrent is false", () => {
  const { container } = render(RouteScreen, {
    props: {
      entry: { "template-type": "splash", image: "x.jpg", title: "Yay", effect: { type: "confetti" } } as RouteEntry,
      index: 4,
      isCurrent: false,
    },
  });
  expect(container.querySelector(".confetti-effect")).not.toBeInTheDocument();
});
