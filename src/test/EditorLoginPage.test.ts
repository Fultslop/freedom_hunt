import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/svelte/svelte5";
import EditorLoginPage from "../pages/editor/EditorLoginPage.svelte";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../utils/api", () => ({
  postLogin: vi.fn().mockResolvedValue({ ok: true, isAdmin: true }),
}));

test("renders password field", () => {
  render(EditorLoginPage);
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
});

test("navigates to /editor on successful admin login", async () => {
  const { push } = await import("svelte-spa-router");
  render(EditorLoginPage);
  await fireEvent.input(screen.getByLabelText(/password/i), {
    target: { value: "secret" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/editor"));
});
