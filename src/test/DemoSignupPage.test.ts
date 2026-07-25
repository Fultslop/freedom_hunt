import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import DemoSignupPage from "../pages/DemoSignupPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";
import * as api from "../utils/api";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  vi.restoreAllMocks();
});

test("renders signup form with email, team name, and password fields", () => {
  render(DemoSignupPage, { props: { params: { project: "demo" } } });
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/team name/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
});

test("shows the server's whitelist error message on 403", async () => {
  vi.spyOn(api, "postDemoSignup").mockResolvedValue({
    ok: false, error: "This email hasn't been approved for this project yet. Contact the organizer.",
  });
  render(DemoSignupPage, { props: { params: { project: "demo" } } });
  await fireEvent.input(screen.getByLabelText(/email/i), { target: { value: "nobody@example.com" } });
  await fireEvent.input(screen.getByLabelText(/team name/i), { target: { value: "Team X" } });
  await fireEvent.input(screen.getByLabelText(/^password/i), { target: { value: "password123" } });
  await fireEvent.click(screen.getByRole("button", { name: /create account/i }));
  await waitFor(() =>
    expect(screen.getByText(/hasn't been approved/i)).toBeInTheDocument(),
  );
});
