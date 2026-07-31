import { authStore } from "../stores/authStore";
import { replace } from "svelte-spa-router";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
  default: vi.fn(),
}));

const mockReplace = replace as ReturnType<typeof vi.fn>;

import { requireAuth, requireEditorAccess, requireOrganizerAccess } from "../utils/authGuards";

beforeEach(() => {
  vi.clearAllMocks();
  authStore.setForTest({ activeAuth: null, authLoading: false, isLoggingOut: false });
});

describe("requireAuth", () => {
  it("returns true when authenticated for the same project", () => {
    authStore.loginParticipant("proj", "Team", "t@test.com");
    expect(requireAuth({ params: { project: "proj" } })).toBe(true);
  });

  it("redirects to login and returns false when not authenticated", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({}),
    } as Response);
    await authStore.logout();
    vi.clearAllMocks();
    const result = requireAuth({ params: { project: "proj" } });
    expect(result).toBe(false);
    expect(replace).toHaveBeenCalledWith("/login/proj");
  });

  it("redirects to that project's login when authenticated for a different project", () => {
    authStore.loginParticipant("demo", "Team", "t@test.com");
    const result = requireAuth({ params: { project: "democrats_abroad" } });
    expect(result).toBe(false);
    expect(replace).toHaveBeenCalledWith("/login/democrats_abroad");
  });
});

describe("requireEditorAccess", () => {
  it("returns true when user has editor capability", () => {
    authStore.setForTest({
      activeAuth: { kind: "editor", userId: "u1", email: "a@b.com", username: "alice", capabilities: ["editor"] },
      authLoading: false,
      isLoggingOut: false,
    });
    expect(requireEditorAccess()).toBe(true);
  });

  it("returns true when user has organizer capability", () => {
    authStore.setForTest({
      activeAuth: { kind: "editor", userId: "u1", email: "a@b.com", username: "alice", capabilities: ["organizer"] },
      authLoading: false,
      isLoggingOut: false,
    });
    expect(requireEditorAccess()).toBe(true);
  });

  it("redirects and returns false when no capabilities", () => {
    authStore.setForTest({
      activeAuth: { kind: "editor", userId: "u1", email: "a@b.com", username: "alice", capabilities: [] },
      authLoading: false,
      isLoggingOut: false,
    });
    expect(requireEditorAccess()).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/editor/login");
  });

  it("redirects and returns false when no auth", () => {
    authStore.setForTest({ activeAuth: null, authLoading: false, isLoggingOut: false });
    expect(requireEditorAccess()).toBe(false);
  });
});

describe("requireOrganizerAccess", () => {
  it("redirects an editor-only (non-organizer) user", () => {
    authStore.setForTest({
      activeAuth: { kind: "editor", userId: "u1", email: "x", username: "x", capabilities: ["editor"] },
      authLoading: false,
      isLoggingOut: false,
    });
    const result = requireOrganizerAccess();
    expect(result).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith("/editor/login");
  });

  it("allows an organizer", () => {
    authStore.setForTest({
      activeAuth: { kind: "editor", userId: "u1", email: "x", username: "x", capabilities: ["organizer"] },
      authLoading: false,
      isLoggingOut: false,
    });
    const result = requireOrganizerAccess();
    expect(result).toBe(true);
  });
});
