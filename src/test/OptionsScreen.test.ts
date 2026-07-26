import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import OptionsScreen from "../components/OptionsScreen.svelte";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("svelte-spa-router", () => ({ push: pushMock }));

const baseProps = { project: "demo", city: "new_york", route: "brooklyn_route" };

beforeEach(() => {
  pushMock.mockClear();
  localStorage.clear();
});

test("renders the title and each option's text", () => {
  render(OptionsScreen, {
    props: {
      ...baseProps,
      title: "Where next?",
      options: [
        { text: "Go home", target: { type: "page", value: "title" } },
        { text: "Visit our site", target: { type: "link", value: "https://example.org" } },
      ],
    },
  });
  expect(screen.getByText("Where next?")).toBeInTheDocument();
  expect(screen.getByText("Go home")).toBeInTheDocument();
  expect(screen.getByText("Visit our site")).toBeInTheDocument();
});

test("renders a link-type option as a real external anchor", () => {
  render(OptionsScreen, {
    props: {
      ...baseProps,
      title: "T",
      options: [{ text: "Visit our site", target: { type: "link", value: "https://example.org" } }],
    },
  });
  const link = screen.getByText("Visit our site").closest("a");
  expect(link).toHaveAttribute("href", "https://example.org");
  expect(link).toHaveAttribute("target", "_blank");
});

test("navigates to the city page for target value 'title'", async () => {
  render(OptionsScreen, {
    props: { ...baseProps, title: "T", options: [{ text: "Go", target: { type: "page", value: "title" } }] },
  });
  await fireEvent.click(screen.getByText("Go"));
  expect(pushMock).toHaveBeenCalledWith("/demo/new_york");
});

test("navigates to the project page for target value 'project'", async () => {
  render(OptionsScreen, {
    props: { ...baseProps, title: "T", options: [{ text: "Go", target: { type: "page", value: "project" } }] },
  });
  await fireEvent.click(screen.getByText("Go"));
  expect(pushMock).toHaveBeenCalledWith("/demo");
});

test("navigates to the gallery page for target value 'gallery'", async () => {
  render(OptionsScreen, {
    props: { ...baseProps, title: "T", options: [{ text: "Go", target: { type: "page", value: "gallery" } }] },
  });
  await fireEvent.click(screen.getByText("Go"));
  expect(pushMock).toHaveBeenCalledWith("/demo/new_york/gallery");
});

test("clears the saved route position and restarts for target value 'start_route'", async () => {
  localStorage.setItem("demo/new_york/brooklyn_route", "6");
  render(OptionsScreen, {
    props: { ...baseProps, title: "T", options: [{ text: "Go", target: { type: "page", value: "start_route" } }] },
  });
  await fireEvent.click(screen.getByText("Go"));
  expect(localStorage.getItem("demo/new_york/brooklyn_route")).toBeNull();
  expect(pushMock).toHaveBeenCalledWith("/demo/new_york/brooklyn_route");
});
