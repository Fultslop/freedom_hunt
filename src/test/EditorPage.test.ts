import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { authStore } from "../stores/authStore";
import EditorPage from "../pages/editor/EditorPage.svelte";
import { push, replace } from "svelte-spa-router";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  authStore.login("democrats_abroad", "Admin", "", true);
  localStorage.clear();
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

  test("redirects to /editor/login when auth has loaded with no admin session", async () => {
    render(EditorPage);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/editor/login");
    });
  });

  test("does not redirect when auth has loaded with valid admin session", async () => {
    authStore.login("democrats_abroad", "Admin", "", true);
    render(EditorPage);
    await Promise.resolve();
    await Promise.resolve();
    expect(replace).not.toHaveBeenCalled();
  });
});
