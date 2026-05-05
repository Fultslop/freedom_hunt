import { render, screen } from "@testing-library/svelte/svelte5";
import LoginPage from "../pages/LoginPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
});

test("renders login form", () => {
  render(LoginPage, { props: { params: { project: "democrats_abroad" } } });
  expect(
    screen.getByRole("button", { name: /join the hunt/i }),
  ).toBeInTheDocument();
});
