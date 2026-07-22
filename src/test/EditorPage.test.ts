import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { authStore } from "../stores/authStore";
import EditorPage from "../pages/editor/EditorPage.svelte";
import { push, replace } from "svelte-spa-router";
import * as api from "../utils/api";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../utils/api", () => ({
  postInviteCreate: vi.fn(),
}));

beforeEach(() => {
  authStore.setForTest({
    activeAuth: { kind: "editor", userId: "u1", email: "a@b.com", username: "admin", capabilities: ["organizer"] },
    authLoading: false,
    isLoggingOut: false,
  });
  localStorage.clear();
  vi.clearAllMocks();
});

test("renders organiser tools heading", () => {
  render(EditorPage);
  expect(
    screen.getByRole("heading", { name: /organiser tools/i }),
  ).toBeInTheDocument();
});

test("renders locations tile link", () => {
  render(EditorPage);
  expect(screen.getByText("Locations")).toBeInTheDocument();
});

test("Locations tile navigates to the last-used city from localStorage", async () => {
  localStorage.setItem("editor_last_city_democrats_abroad", "oslo");
  render(EditorPage);
  await fireEvent.click(screen.getByText("Locations"));
  expect(push).toHaveBeenCalledWith(
    "/editor/locations/democrats_abroad/oslo",
  );
});

test("Locations tile falls back to den_haag when no city is stored", async () => {
  render(EditorPage);
  await fireEvent.click(screen.getByText("Locations"));
  expect(push).toHaveBeenCalledWith(
    "/editor/locations/democrats_abroad/den_haag",
  );
});

describe("auth guard effect", () => {
  beforeEach(async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      json: async () => ({}),
    } as Response);
    await authStore.logout();
    vi.clearAllMocks();
    localStorage.clear();
  });

  test("redirects to /editor/login when auth has loaded with no editor session", async () => {
    render(EditorPage);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/editor/login");
    });
  });

  test("does not redirect when auth has loaded with a valid editor session", async () => {
    authStore.setForTest({
      activeAuth: { kind: "editor", userId: "u1", email: "a@b.com", username: "admin", capabilities: ["organizer"] },
      authLoading: false,
      isLoggingOut: false,
    });
    render(EditorPage);
    await Promise.resolve();
    await Promise.resolve();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("EditorPage — invite editor", () => {
  it("shows the Invite editor button", async () => {
    authStore.setForTest({
      activeAuth: { kind: "editor", userId: "u1", email: "a@b.com", username: "alice", capabilities: ["organizer"] },
      authLoading: false,
      isLoggingOut: false,
    });
    render(EditorPage);
    await waitFor(() => {
      expect(screen.getByText(/invite editor/i)).toBeTruthy();
    });
  });

  it("shows the invite URL after clicking the button", async () => {
    authStore.setForTest({
      activeAuth: { kind: "editor", userId: "u1", email: "a@b.com", username: "alice", capabilities: ["organizer"] },
      authLoading: false,
      isLoggingOut: false,
    });
    vi.mocked(api.postInviteCreate).mockResolvedValue({
      ok: true, token: "tok789", inviteUrl: "https://example.com/#/invite/tok789",
    });
    render(EditorPage);
    await waitFor(() => screen.getByText(/invite editor/i));
    await fireEvent.click(screen.getByText(/invite editor/i));
    await waitFor(() => {
      expect(screen.getByText(/tok789/)).toBeTruthy();
    });
  });
});
