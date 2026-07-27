import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import CodeEntryPage from "../pages/CodeEntryPage.svelte";
import { titleBarStore } from "../stores/titleBarStore";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../utils/api", () => ({
  postVerifyCode: vi.fn(),
}));

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({
    "app.title": "YES. WE. VOTE.",
    "app.tagline": "A scavenger hunt for democracy.",
  }),
}));

beforeEach(() => {
  titleBarStore.set({ title: "Freedom Hunt", progress: null, backPath: null });
  sessionStorage.clear();
});

test("renders the scavenger hunt code field", () => {
  render(CodeEntryPage);
  expect(screen.getByLabelText(/scavenger hunt code/i)).toBeInTheDocument();
});

test("navigates to /login/demo when the code resolves to demo mode", async () => {
  const api = await import("../utils/api");
  const { push } = await import("svelte-spa-router");
  vi.mocked(api.postVerifyCode).mockResolvedValue({ ok: true, mode: "demo" });
  render(CodeEntryPage);
  await fireEvent.input(screen.getByLabelText(/scavenger hunt code/i), {
    target: { value: "demo" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/login/demo"));
});

test("stashes the password and navigates to /join/:project on a project match", async () => {
  const api = await import("../utils/api");
  const { push } = await import("svelte-spa-router");
  vi.mocked(api.postVerifyCode).mockResolvedValue({
    ok: true,
    mode: "project",
    project: "democrats_abroad",
  });
  render(CodeEntryPage);
  await fireEvent.input(screen.getByLabelText(/scavenger hunt code/i), {
    target: { value: "letmein" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/join/democrats_abroad"));
  expect(JSON.parse(sessionStorage.getItem("pendingHuntAuth")!)).toEqual({
    project: "democrats_abroad",
    password: "letmein",
  });
});

test("shows an error for an invalid code", async () => {
  const api = await import("../utils/api");
  vi.mocked(api.postVerifyCode).mockResolvedValue({ ok: false });
  render(CodeEntryPage);
  await fireEvent.input(screen.getByLabelText(/scavenger hunt code/i), {
    target: { value: "wrong" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /continue/i }));
  expect(await screen.findByText(/invalid code/i)).toBeInTheDocument();
});
