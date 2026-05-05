import { render, screen } from "@testing-library/svelte/svelte5";
import { authStore } from "../stores/authStore";
import EditorPage from "../pages/editor/EditorPage.svelte";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  authStore.login("democrats_abroad", "Admin", "", true);
});

test("renders organiser tools heading", () => {
  render(EditorPage);
  expect(screen.getByRole("heading", { name: /organiser tools/i })).toBeInTheDocument();
});

test("renders locations tile link", () => {
  render(EditorPage);
  expect(screen.getByText("Locations")).toBeInTheDocument();
});
