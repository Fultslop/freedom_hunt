import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import WideButton from "../components/WideButton.svelte";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("svelte-spa-router", () => ({ push: pushMock }));

beforeEach(() => {
  pushMock.mockClear();
});

test("renders a link target as a real external anchor, primary by default", () => {
  render(WideButton, {
    props: {
      text: "Check your voter registration",
      target: { type: "link", value: "https://example.org" },
      project: "demo",
      cityId: "new_york",
    },
  });
  const link = screen.getByRole("link", { name: "Check your voter registration" });
  expect(link).toHaveAttribute("href", "https://example.org");
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveClass("wide-btn--primary");
});

test("renders a page target as a button that navigates via resolvePageUrl", async () => {
  render(WideButton, {
    props: {
      text: "See your results",
      target: { type: "page", value: "results" },
      project: "demo",
      cityId: "new_york",
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: "See your results" }));
  expect(pushMock).toHaveBeenCalledWith("/demo/new_york/results_download");
});

test("applies an explicit color, overriding the theme default", () => {
  render(WideButton, {
    props: {
      text: "Secondary",
      target: { type: "page", value: "gallery" },
      color: "secondary",
      project: "demo",
      cityId: "new_york",
    },
  });
  expect(screen.getByRole("button", { name: "Secondary" })).toHaveClass("wide-btn--secondary");
});

test("falls back to the theme's defaultButtonColor when color is omitted", () => {
  render(WideButton, {
    props: {
      text: "Default",
      target: { type: "page", value: "title" },
      project: "demo",
      cityId: "new_york",
    },
  });
  // DEFAULT_THEME ("app") sets defaultButtonColor: "primary" — see src/theme/themes.ts
  expect(screen.getByRole("button", { name: "Default" })).toHaveClass("wide-btn--primary");
});
