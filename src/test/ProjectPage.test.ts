import { render, screen } from "@testing-library/svelte/svelte5";
import ProjectPage from "../pages/ProjectPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({
    items: [
      {
        id: "den_haag",
        name: "Den Haag",
        country: "Netherlands",
        description: "desc",
        image: null,
      },
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

test("renders city list", async () => {
  render(ProjectPage, { props: { params: { project: "democrats_abroad" } } });
  expect(await screen.findByText("Den Haag")).toBeInTheDocument();
});
