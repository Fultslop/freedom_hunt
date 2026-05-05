import { render, screen } from "@testing-library/svelte/svelte5";
import RoutePage from "../pages/RoutePage.svelte";
import { titleBarStore } from "../stores/titleBarStore";

const { mockLocations } = vi.hoisted(() => ({
  mockLocations: [
    {
      locationId: 1,
      title: "Loc 1",
      name: { value: "Location 1" },
      coordinates: { latitude: 52.0, longitude: 4.0 },
      storyline: "Story 1",
      breadcrumb: "Step 1",
      challenge: { name: "Challenge 1", description: "Desc 1", form: [] },
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
}));

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
    if (path.includes("/001")) return mockLocations[0];
    if (path.includes("/002")) return mockLocations[1];
    return null;
  }),
}));

vi.mock("../utils/loadLocations", () => ({
  loadLocations: vi.fn().mockResolvedValue(mockLocations),
}));

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
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
