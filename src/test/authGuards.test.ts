import { authStore } from "../stores/authStore";
import { replace } from "svelte-spa-router";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
  default: vi.fn(),
}));

const mockReplace = replace as ReturnType<typeof vi.fn>;

import { requireAuth, requireEditorAccess } from "../utils/authGuards";

beforeEach(() => {
  vi.clearAllMocks();
  authStore.setForTest({ activeAuth: null, authLoading: false, isLoggingOut: false });
});

describe("requireAuth", () => {
  it("returns true when authenticated", () => {
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
