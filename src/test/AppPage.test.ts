import { render, screen } from "@testing-library/svelte/svelte5";
import AppPage from "../pages/AppPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({
    items: [
      { id: "democrats_abroad", name: "Democrats Abroad", description: "DA desc", image: null },
    ],
  }),
}));

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
});

test("renders project list", async () => {
  render(AppPage);
  expect(await screen.findByText("Democrats Abroad")).toBeInTheDocument();
});