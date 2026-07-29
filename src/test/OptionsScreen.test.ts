import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import OptionsScreen from "../components/OptionsScreen.svelte";
import { authStore } from "../stores/authStore";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("svelte-spa-router", () => ({ push: pushMock }));

vi.mock("../utils/api", () => ({
  postFormSubmit: vi.fn().mockResolvedValue({ ok: true }),
}));

const baseProps = { project: "demo", city: "new_york", route: "brooklyn_route", locationId: "4" };

beforeEach(async () => {
  pushMock.mockClear();
  localStorage.clear();
  authStore.loginParticipant("demo", "Team A", "team@test.com");
  const { postFormSubmit } = await import("../utils/api");
  vi.mocked(postFormSubmit).mockClear();
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

test("renders the optional markdown text between the title and the buttons", () => {
  render(OptionsScreen, {
    props: { ...baseProps, title: "T", text: "Some **important** notes.", options: [] },
  });
  expect(screen.getByText("important")).toBeInTheDocument();
});

test("renders no text block when text is absent", () => {
  const { container } = render(OptionsScreen, {
    props: { ...baseProps, title: "T", options: [] },
  });
  expect(container.querySelector(".options-screen__text")).not.toBeInTheDocument();
});

test("calls onContinue for target value 'continue' instead of navigating", async () => {
  const onContinue = vi.fn();
  render(OptionsScreen, {
    props: {
      ...baseProps,
      title: "T",
      options: [{ text: "I understand", target: { type: "page", value: "continue" } }],
      onContinue,
    },
  });
  await fireEvent.click(screen.getByText("I understand"));
  expect(onContinue).toHaveBeenCalledTimes(1);
  expect(pushMock).not.toHaveBeenCalled();
});

test("fires a tracked form submission when a page-target option has track: true", async () => {
  const { postFormSubmit } = await import("../utils/api");
  const onContinue = vi.fn();
  render(OptionsScreen, {
    props: {
      ...baseProps,
      title: "T",
      options: [{ text: "I understand", target: { type: "page", value: "continue" }, track: true }],
      onContinue,
    },
  });
  await fireEvent.click(screen.getByText("I understand"));
  expect(postFormSubmit).toHaveBeenCalledWith({
    locationId: "4",
    routeId: "brooklyn_route",
    cityId: "new_york",
    teamName: "Team A",
    contact: "team@test.com",
    answers: { selected: "I understand" },
  });
  expect(onContinue).toHaveBeenCalledTimes(1);
});

test("does not fire a tracked submission when track is absent", async () => {
  const { postFormSubmit } = await import("../utils/api");
  render(OptionsScreen, {
    props: { ...baseProps, title: "T", options: [{ text: "Go", target: { type: "page", value: "title" } }] },
  });
  await fireEvent.click(screen.getByText("Go"));
  expect(postFormSubmit).not.toHaveBeenCalled();
});

test("fires a tracked submission for a link-type option without blocking navigation", async () => {
  const { postFormSubmit } = await import("../utils/api");
  render(OptionsScreen, {
    props: {
      ...baseProps,
      title: "T",
      options: [{ text: "Visit site", target: { type: "link", value: "https://example.org" }, track: true }],
    },
  });
  await fireEvent.click(screen.getByText("Visit site"));
  expect(postFormSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ answers: { selected: "Visit site" } }),
  );
});
