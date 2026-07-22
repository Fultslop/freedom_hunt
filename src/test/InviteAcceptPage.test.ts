import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import InviteAcceptPage from "../pages/InviteAcceptPage.svelte";
import * as api from "../utils/api";
import { authStore } from "../stores/authStore";
import { get } from "svelte/store";

vi.mock("../utils/api");
vi.mock("svelte-spa-router", () => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("../stores/titleBarStore", () => ({
  titleBarStore: { set: vi.fn() },
}));

const { push, replace } = await import("svelte-spa-router");

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  authStore.setForTest({ activeAuth: null, authLoading: false, isLoggingOut: false });
});

describe("InviteAcceptPage — unauthenticated", () => {
  it("stores token in sessionStorage and redirects to /editor/login when not logged in", async () => {
    vi.mocked(api.fetchInviteToken).mockResolvedValue({
      ok: true, projectId: "proj", capability: "editor", expiresAt: 9999999999,
    });
    render(InviteAcceptPage, { params: { token: "tok123" } });
    await waitFor(() => {
      expect(sessionStorage.getItem("pendingInvite")).toBe("tok123");
      expect(replace).toHaveBeenCalledWith("/editor/login");
    });
  });
});

describe("InviteAcceptPage — authenticated", () => {
  beforeEach(() => {
    authStore.setForTest({
      activeAuth: { kind: "editor", userId: "u1", email: "a@b.com", username: "alice", capabilities: [] },
      authLoading: false,
      isLoggingOut: false,
    });
  });

  it("shows project and capability from a valid token", async () => {
    vi.mocked(api.fetchInviteToken).mockResolvedValue({
      ok: true, projectId: "democrats_abroad", capability: "editor", expiresAt: 9999999999,
    });
    render(InviteAcceptPage, { params: { token: "tok123" } });
    await waitFor(() => {
      expect(screen.getByText(/democrats_abroad/i)).toBeTruthy();
      expect(screen.getByText(/editor/i)).toBeTruthy();
      expect(screen.getByRole("button", { name: /accept/i })).toBeTruthy();
    });
  });

  it("calls postInviteAccept, updates authStore capabilities, and navigates to /editor", async () => {
    vi.mocked(api.fetchInviteToken).mockResolvedValue({
      ok: true, projectId: "proj", capability: "editor", expiresAt: 9999999999,
    });
    vi.mocked(api.postInviteAccept).mockResolvedValue({
      ok: true,
      userId: "u1",
      email: "a@b.com",
      username: "alice",
      capabilities: ["editor"],
      projectId: "proj",
    });
    render(InviteAcceptPage, { params: { token: "tok123" } });
    await waitFor(() => screen.getByRole("button", { name: /accept/i }));
    await fireEvent.click(screen.getByRole("button", { name: /accept/i }));
    await waitFor(() => {
      expect(api.postInviteAccept).toHaveBeenCalledWith("tok123");
      expect(push).toHaveBeenCalledWith("/editor");
      const state = get(authStore);
      expect(state.activeAuth?.kind).toBe("editor");
      if (state.activeAuth?.kind === "editor") {
        expect(state.activeAuth.capabilities).toContain("editor");
      }
    });
  });

  it("shows an error message for an expired/invalid token", async () => {
    vi.mocked(api.fetchInviteToken).mockResolvedValue({
      ok: false, error: "Invite expired",
    });
    render(InviteAcceptPage, { params: { token: "badtok" } });
    await waitFor(() => {
      expect(screen.getByText(/invite expired/i)).toBeTruthy();
    });
  });
});
