import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import SignupPage from "../pages/SignupPage.svelte";
import * as api from "../utils/api";

vi.mock("../utils/api");
vi.mock("svelte-spa-router", () => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("../stores/authStore", () => ({
  authStore: { loginEditor: vi.fn(), subscribe: vi.fn(() => () => {}) },
}));
vi.mock("../stores/titleBarStore", () => ({
  titleBarStore: { set: vi.fn() },
}));

const { push } = await import("svelte-spa-router");

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("SignupPage", () => {
  it("renders email, username, password fields and two consent checkboxes", () => {
    render(SignupPage);
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/username/i)).toBeTruthy();
    expect(screen.getByLabelText(/password/i)).toBeTruthy();
    expect(screen.getByLabelText(/hunt results/i)).toBeTruthy();
    expect(screen.getByLabelText(/product updates/i)).toBeTruthy();
  });

  it("submits signup and navigates to /editor on success", async () => {
    vi.mocked(api.postSignup).mockResolvedValue({
      ok: true, userId: "u1", email: "a@b.com", username: "alice", capabilities: [],
    });
    render(SignupPage);
    await fireEvent.input(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    await fireEvent.input(screen.getByLabelText(/username/i), { target: { value: "alice" } });
    await fireEvent.input(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    await fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => {
      expect(api.postSignup).toHaveBeenCalledWith(expect.objectContaining({
        email: "a@b.com", username: "alice", password: "password123",
      }));
      expect(push).toHaveBeenCalledWith("/editor");
    });
  });

  it("shows an error on signup failure", async () => {
    vi.mocked(api.postSignup).mockResolvedValue({ ok: false, error: "Email already registered" });
    render(SignupPage);
    await fireEvent.input(screen.getByLabelText(/email/i), { target: { value: "x@b.com" } });
    await fireEvent.input(screen.getByLabelText(/username/i), { target: { value: "x" } });
    await fireEvent.input(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    await fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => {
      expect(screen.getByText(/email already registered/i)).toBeTruthy();
    });
  });

  it("accepts a pending invite after signup and navigates to /editor", async () => {
    sessionStorage.setItem("pendingInvite", "tok123");
    vi.mocked(api.postSignup).mockResolvedValue({
      ok: true, userId: "u1", email: "a@b.com", username: "alice", capabilities: [],
    });
    vi.mocked(api.postInviteAccept).mockResolvedValue({
      ok: true, userId: "u1", email: "a@b.com", username: "alice", capabilities: ["editor"],
    });
    const { authStore } = await import("../stores/authStore");
    render(SignupPage);
    await fireEvent.input(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    await fireEvent.input(screen.getByLabelText(/username/i), { target: { value: "alice" } });
    await fireEvent.input(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    await fireEvent.submit(screen.getByRole("form"));
    await waitFor(() => {
      expect(api.postInviteAccept).toHaveBeenCalledWith("tok123");
      expect(sessionStorage.getItem("pendingInvite")).toBeNull();
      expect(push).toHaveBeenCalledWith("/editor");
      // loginEditor must be called with the invite capabilities, not the empty [] from signup
      expect(authStore.loginEditor).toHaveBeenLastCalledWith(
        "u1", "a@b.com", "alice", ["editor"],
      );
    });
  });

  it("has a link to the login page", () => {
    render(SignupPage);
    expect(screen.getByText(/sign in/i)).toBeTruthy();
  });
});
