import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import AppPage from "../pages/AppPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({
    "app.title": "YES. WE. VOTE.",
    "app.tagline": "A scavenger hunt for democracy.",
  }),
}));

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
});

test("renders the Start Hunting button", async () => {
  render(AppPage);
  expect(
    await screen.findByRole("button", { name: /start hunting/i }),
  ).toBeInTheDocument();
});

test("does not render a project list", async () => {
  render(AppPage);
  await screen.findByRole("button", { name: /start hunting/i });
  expect(screen.queryByText(/democrats abroad/i)).not.toBeInTheDocument();
});

test("navigates to /start when the button is clicked", async () => {
  const { push } = await import("svelte-spa-router");
  render(AppPage);
  await fireEvent.click(
    await screen.findByRole("button", { name: /start hunting/i }),
  );
  expect(push).toHaveBeenCalledWith("/start");
});
