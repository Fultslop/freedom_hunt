import { render, screen } from "@testing-library/svelte/svelte5";
import DemoLoginPage from "../pages/DemoLoginPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
});

test("renders email + password login form with a link to sign up", () => {
  render(DemoLoginPage);
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /create an account/i })).toHaveAttribute("href", "#/signup/demo");
});
