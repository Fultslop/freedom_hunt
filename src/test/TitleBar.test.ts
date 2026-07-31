import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import { vi } from "vitest";
import { titleBarStore } from "../stores/titleBarStore";
import { fontSizeStore } from "../stores/fontSizeStore";
import { authStore } from "../stores/authStore";
import * as api from "../utils/api";
import TitleBar from "../components/TitleBar.svelte";

beforeEach(() => {
  vi.clearAllMocks();
  titleBarStore.set({ title: "Test", progress: null, backPath: null });
  fontSizeStore.setFontSize("medium");
});

test("renders title", () => {
  render(TitleBar);
  expect(screen.getByText("Test")).toBeInTheDocument();
});

test("renders back button when backPath is set", () => {
  titleBarStore.set({ title: "Test", progress: null, backPath: "/foo" });
  render(TitleBar);
  expect(screen.getByLabelText("Back")).toBeInTheDocument();
});

test("hides back button when backPath is null", () => {
  render(TitleBar);
  expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
});

test("renders progress bar when progress is set", () => {
  titleBarStore.set({
    title: "Test",
    progress: { current: 2, total: 3 },
    backPath: null,
  });
  render(TitleBar);
  expect(screen.getByTestId("progress-bar")).toBeInTheDocument();
});

test("hides progress bar when progress is null", () => {
  render(TitleBar);
  expect(screen.queryByTestId("progress-bar")).not.toBeInTheDocument();
});

test("does not render subtitle when subtitle is not set", () => {
  render(TitleBar);
  expect(screen.queryByTestId("titlebar-subtitle")).not.toBeInTheDocument();
});

test("renders subtitle without asterisk when isDirty is false", () => {
  titleBarStore.set({
    title: "Test",
    progress: null,
    backPath: null,
    subtitle: "Dam Square",
    isDirty: false,
  });
  render(TitleBar);
  expect(screen.getByTestId("titlebar-subtitle")).toHaveTextContent(
    "Dam Square",
  );
});

test("overrides the progress fill's transition duration when animateMs is set", () => {
  titleBarStore.set({
    title: "Test",
    progress: { current: 6, total: 8, animateMs: 900 },
    backPath: null,
  });
  render(TitleBar);
  const fill = screen
    .getByTestId("progress-bar")
    .querySelector(".titlebar__progress-fill") as HTMLElement;
  expect(fill.style.transitionDuration).toBe("900ms");
});

test("leaves the progress fill's transition duration unset when animateMs is absent", () => {
  titleBarStore.set({
    title: "Test",
    progress: { current: 2, total: 3 },
    backPath: null,
  });
  render(TitleBar);
  const fill = screen
    .getByTestId("progress-bar")
    .querySelector(".titlebar__progress-fill") as HTMLElement;
  expect(fill.style.transitionDuration).toBe("");
});

test("renders subtitle with asterisk when isDirty is true", () => {
  titleBarStore.set({
    title: "Test",
    progress: null,
    backPath: null,
    subtitle: "Dam Square",
    isDirty: true,
  });
  render(TitleBar);
  expect(screen.getByTestId("titlebar-subtitle")).toHaveTextContent(
    "Dam Square *",
  );
});

test("closes the menu when clicking outside of it", async () => {
  render(TitleBar);
  await fireEvent.click(screen.getByLabelText("Menu"));
  expect(screen.getByText("Profile")).toBeInTheDocument();

  await fireEvent.click(document.body);

  expect(screen.queryByText("Profile")).not.toBeInTheDocument();
});

test("does not close the menu when clicking inside the dropdown", async () => {
  render(TitleBar);
  await fireEvent.click(screen.getByLabelText("Menu"));

  await fireEvent.click(screen.getByText("Profile"));

  expect(screen.getByLabelText("Back to menu")).toBeInTheDocument();
});

test("closes the menu completely from a submenu when clicking outside", async () => {
  render(TitleBar);
  await fireEvent.click(screen.getByLabelText("Menu"));
  await fireEvent.click(screen.getByText("Themes"));
  expect(screen.getByLabelText("Back to menu")).toBeInTheDocument();

  await fireEvent.click(document.body);

  expect(screen.queryByLabelText("Back to menu")).not.toBeInTheDocument();
  expect(screen.queryByText("Profile")).not.toBeInTheDocument();
});

test("closes the menu when Escape is pressed", async () => {
  render(TitleBar);
  await fireEvent.click(screen.getByLabelText("Menu"));
  expect(screen.getByText("Profile")).toBeInTheDocument();

  await fireEvent.keyDown(window, { key: "Escape" });

  expect(screen.queryByText("Profile")).not.toBeInTheDocument();
});

test("Photo permissions menu item fetches and shows the current promo consent state", async () => {
  authStore.setForTest({ activeAuth: { kind: "participant", projectId: "den_haag", teamName: "Team A", contact: null, isAdmin: false }, authLoading: false, isLoggingOut: false });
  vi.spyOn(api, "fetchConsent").mockResolvedValue({ ok: true, record: { all_sixteen_plus: 1, promo_consent: 0, promo_approved: 0, consent_version: 1 } });
  render(TitleBar);
  await fireEvent.click(screen.getByLabelText("Menu"));
  await fireEvent.click(screen.getByText("Photo permissions"));
  expect(await screen.findByRole("checkbox")).not.toBeChecked();
});

test("declined-state (all_sixteen_plus false) shows explanatory copy instead of a toggle", async () => {
  authStore.setForTest({ activeAuth: { kind: "participant", projectId: "den_haag", teamName: "Team A", contact: null, isAdmin: false }, authLoading: false, isLoggingOut: false });
  vi.spyOn(api, "fetchConsent").mockResolvedValue({ ok: true, record: { all_sixteen_plus: 0, promo_consent: 0, promo_approved: 0, consent_version: 1 } });
  render(TitleBar);
  await fireEvent.click(screen.getByLabelText("Menu"));
  await fireEvent.click(screen.getByText("Photo permissions"));
  expect(await screen.findByText(/won't use your photos/i)).toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
});

test("toggling the checkbox auto-saves via postConsentUpdate", async () => {
  authStore.setForTest({ activeAuth: { kind: "participant", projectId: "den_haag", teamName: "Team A", contact: null, isAdmin: false }, authLoading: false, isLoggingOut: false });
  vi.spyOn(api, "fetchConsent").mockResolvedValue({ ok: true, record: { all_sixteen_plus: 1, promo_consent: 0, promo_approved: 0, consent_version: 1 } });
  const postSpy = vi.spyOn(api, "postConsentUpdate").mockResolvedValue({
    ok: true,
    record: { all_sixteen_plus: 1, promo_consent: 0, promo_approved: 0, consent_version: 1 },
  });
  render(TitleBar);
  await fireEvent.click(screen.getByLabelText("Menu"));
  await fireEvent.click(screen.getByText("Photo permissions"));
  await fireEvent.click(await screen.findByRole("checkbox"));
  expect(postSpy).toHaveBeenCalledWith("", "", { allSixteenPlus: true, promoConsent: true, acknowledge: false });
});
