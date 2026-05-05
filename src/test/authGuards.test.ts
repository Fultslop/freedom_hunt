import { authStore } from "../stores/authStore";
import { replace } from "svelte-spa-router";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
  default: vi.fn(),
}));

import { requireAuth, requireAdmin } from "../utils/authGuards";

beforeEach(() => {
  vi.clearAllMocks();
  authStore.logout();
});

describe("requireAuth", () => {
  it("returns true when authenticated", () => {
    authStore.login("proj", "Team", "t@test.com");
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

describe("requireAdmin", () => {
  it("returns true when admin", () => {
    authStore.login("proj", "Admin", "a@test.com", true);
    expect(requireAdmin()).toBe(true);
  });

  it("redirects to / and returns false when not admin", () => {
    authStore.login("proj", "Team", "t@test.com", false);
    expect(requireAdmin()).toBe(false);
    expect(replace).toHaveBeenCalledWith("/");
  });
});
