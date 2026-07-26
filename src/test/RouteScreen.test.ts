import { render, screen } from "@testing-library/svelte/svelte5";
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

test("renders SplashScreen for a splash entry and reports the effect firing", () => {
  const onSplashEffectPlayed = vi.fn();
  const { container } = render(RouteScreen, {
    props: {
      entry: { "template-type": "splash", image: "x.jpg", title: "Yay", effect: "confetti" } as RouteEntry,
      index: 4,
      splashEffectHistory: {},
      onSplashEffectPlayed,
    },
  });
  expect(screen.getByText("Yay")).toBeInTheDocument();
  expect(container.querySelector(".confetti-effect")).toBeInTheDocument();
  expect(onSplashEffectPlayed).toHaveBeenCalledWith(4);
});

test("does not re-report a splash effect that history says already fired without repeat-effect", () => {
  const onSplashEffectPlayed = vi.fn();
  const { container } = render(RouteScreen, {
    props: {
      entry: { "template-type": "splash", image: "x.jpg", title: "Yay", effect: "confetti" } as RouteEntry,
      index: 4,
      splashEffectHistory: { 4: { count: 1, lastFiredAt: Date.now() } },
      onSplashEffectPlayed,
    },
  });
  expect(container.querySelector(".confetti-effect")).not.toBeInTheDocument();
  expect(onSplashEffectPlayed).not.toHaveBeenCalled();
});
