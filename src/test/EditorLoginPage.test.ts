import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/svelte/svelte5";
import EditorLoginPage from "../pages/editor/EditorLoginPage.svelte";
import { get } from "svelte/store";
import { authStore } from "../stores/authStore";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../utils/api", () => ({
  postUserLogin: vi.fn().mockResolvedValue({ ok: true, userId: "u1", email: "a@b.com", username: "admin", capabilities: ["organizer"] }),
  postInviteAccept: vi.fn().mockResolvedValue({ ok: true }),
}));

test("renders email and password fields", () => {
  render(EditorLoginPage);
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
});

test("navigates to /editor on successful login", async () => {
  const { push } = await import("svelte-spa-router");
  render(EditorLoginPage);
  await fireEvent.input(screen.getByLabelText(/email/i), {
    target: { value: "admin@example.com" },
  });
  await fireEvent.input(screen.getByLabelText(/password/i), {
    target: { value: "secret" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/editor"));
});

describe("EditorLoginPage — new fields", () => {
  it("renders email and password fields (not project field for editor login)", () => {
    render(EditorLoginPage);
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
  });

  it("has a link to the signup page", () => {
    render(EditorLoginPage);
    expect(screen.getByText(/create account/i)).toBeTruthy();
  });

  it("updates authStore with invite capabilities after login with pending invite", async () => {
    const api = await import("../utils/api");
    sessionStorage.setItem("pendingInvite", "tok456");
    // Login returns no capabilities — user just registered
    vi.mocked(api.postUserLogin).mockResolvedValue({
      ok: true, userId: "u1", email: "a@b.com", username: "alice", capabilities: [],
    });
    // Invite accept grants editor
    vi.mocked(api.postInviteAccept).mockResolvedValue({
      ok: true, userId: "u1", email: "a@b.com", username: "alice", capabilities: ["editor"],
    });
    render(EditorLoginPage);
    await fireEvent.input(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    await fireEvent.input(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    await fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => {
      expect(api.postInviteAccept).toHaveBeenCalledWith("tok456");
      expect(sessionStorage.getItem("pendingInvite")).toBeNull();
      const state = get(authStore);
      expect(state.activeAuth?.kind).toBe("editor");
      if (state.activeAuth?.kind === "editor") {
        expect(state.activeAuth.capabilities).toContain("editor");
      }
    });
  });
});
