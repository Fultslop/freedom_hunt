import { render, screen } from "@testing-library/svelte/svelte5";
import { vi } from "vitest";
import { titleBarStore } from "../stores/titleBarStore";
import { fontSizeStore } from "../stores/fontSizeStore";
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
