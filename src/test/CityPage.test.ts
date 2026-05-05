import { render, screen } from "@testing-library/svelte/svelte5";
import CityPage from "../pages/CityPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({
    short_loop: { description: "2.5h route", locations: ["001", "002"] },
  }),
}));

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
});

test("renders routes", async () => {
  render(CityPage, { props: { params: { project: "democrats_abroad", city: "den_haag" } } });
  expect(await screen.findByText(/short loop/i)).toBeInTheDocument();
});