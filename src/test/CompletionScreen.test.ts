import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import CompletionScreen from "../components/CompletionScreen.svelte";

afterEach(() => {
  vi.useRealTimers();
});

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));
vi.mock("svelte-spa-router", () => ({ push: vi.fn() }));

const baseProps = {
  image: "lange-vijverberg.jpg",
  title: "You made it.",
  subtitle: "Democrats Abroad 2026 Scavenger Hunt",
  place: "The Hague · short loop",
  buttons: [
    {
      text: "Check your voter registration",
      target: { type: "link" as const, value: "https://www.democratsabroad.org/nl" },
    },
    {
      text: "See your results",
      target: { type: "page" as const, value: "results" as const },
      color: "secondary" as const,
    },
  ],
  stats: { stopsCompleted: 6, stopsTotal: 8, photosCount: 12 as number | "—", timeOnFoot: "2h 18m" },
  project: "democrats_abroad",
  cityId: "den_haag",
};

beforeEach(() => {
  vi.clearAllMocks();
});

test("renders title, subtitle, and place from props", () => {
  render(CompletionScreen, { props: baseProps });
  expect(screen.getByText("You made it.")).toBeInTheDocument();
  expect(screen.getByText("Democrats Abroad 2026 Scavenger Hunt")).toBeInTheDocument();
  expect(screen.getByText("The Hague · short loop")).toBeInTheDocument();
});

test("renders the hero as a background-image div, not a scaling <img>", () => {
  const { container } = render(CompletionScreen, { props: baseProps });
  const heroImg = container.querySelector(".cmpl-hero-img") as HTMLElement;
  expect(heroImg.tagName).toBe("DIV");
  expect(heroImg.style.backgroundImage).toBe('url("blob:test")');
});

test("renders the primary button as a real link to its authored URL", () => {
  render(CompletionScreen, { props: baseProps });
  const link = screen.getByRole("link", { name: "Check your voter registration" });
  expect(link).toHaveAttribute("href", "https://www.democratsabroad.org/nl");
  expect(link).toHaveAttribute("target", "_blank");
});

test("renders a second button that navigates to the route's results_download page", async () => {
  const { push } = await import("svelte-spa-router");
  render(CompletionScreen, { props: baseProps });
  await fireEvent.click(screen.getByRole("button", { name: "See your results" }));
  expect(push).toHaveBeenCalledWith("/democrats_abroad/den_haag/results_download");
});

test("renders caption and closing text when provided", () => {
  render(CompletionScreen, {
    props: { ...baseProps, caption: "Recorded 29 July 2026.", closingText: "Thank you." },
  });
  expect(screen.getByText("Recorded 29 July 2026.")).toBeInTheDocument();
  expect(screen.getByText("Thank you.")).toBeInTheDocument();
});

test("omits caption and closing text elements when absent", () => {
  render(CompletionScreen, { props: baseProps });
  expect(document.querySelector(".cmpl-caption")).not.toBeInTheDocument();
  expect(document.querySelector(".cmpl-closer")).not.toBeInTheDocument();
});

test("renders the hint line when provided", () => {
  render(CompletionScreen, { props: { ...baseProps, hint: "Takes about 2 minutes." } });
  expect(screen.getByText("Takes about 2 minutes.")).toBeInTheDocument();
});

test("shows stops-completed, photos-taken, and time-on-foot stats", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  render(CompletionScreen, { props: { ...baseProps, isCurrent: true } });
  await vi.advanceTimersByTimeAsync(800);
  expect(screen.getByText("6")).toBeInTheDocument();
  expect(screen.getByText("12")).toBeInTheDocument();
  expect(screen.getByText("2h 18m")).toBeInTheDocument();
  vi.useRealTimers();
});

test("does not start the arrival sequence while isCurrent is false", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const { container } = render(CompletionScreen, {
    props: { ...baseProps, isCurrent: false },
  });
  await vi.advanceTimersByTimeAsync(3000);
  expect(container.querySelector(".cmpl-reveal--in")).not.toBeInTheDocument();
  expect(container.querySelector(".confetti-effect")).not.toBeInTheDocument();
});

test("reveals the card, badge, stats, caption, closer, and actions in order", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const { container } = render(CompletionScreen, {
    props: { ...baseProps, caption: "c", closingText: "d", isCurrent: true },
  });
  const cardEl = container.querySelector(".cmpl-card")!;
  const badgeEl = container.querySelector(".cmpl-badge")!;
  expect(cardEl).not.toHaveClass("cmpl-reveal--in");

  await vi.advanceTimersByTimeAsync(120);
  expect(cardEl).toHaveClass("cmpl-reveal--in");
  expect(badgeEl).not.toHaveClass("cmpl-badge--in");

  await vi.advanceTimersByTimeAsync(260);
  expect(badgeEl).toHaveClass("cmpl-badge--in");

  await vi.advanceTimersByTimeAsync(400);
  expect(container.querySelector(".confetti-effect")).toBeInTheDocument();

  await vi.advanceTimersByTimeAsync(220);
  expect(container.querySelector(".cmpl-section")).toHaveClass("cmpl-reveal--in");

  await vi.advanceTimersByTimeAsync(520);
  expect(container.querySelector(".cmpl-caption")).toHaveClass("cmpl-reveal--in");

  await vi.advanceTimersByTimeAsync(160);
  expect(container.querySelector(".cmpl-closer")).toHaveClass("cmpl-reveal--in");

  await vi.advanceTimersByTimeAsync(220);
  expect(container.querySelector(".cmpl-actions")).toHaveClass("cmpl-reveal--in");
});

test("plays Ken Burns once isCurrent is true", () => {
  const { container } = render(CompletionScreen, { props: { ...baseProps, isCurrent: true } });
  expect(container.querySelector(".cmpl-hero")).toHaveClass("cmpl-hero--play");
});

test("stops the sequence and Ken Burns when isCurrent goes false mid-sequence", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const { container, rerender } = render(CompletionScreen, {
    props: { ...baseProps, isCurrent: true },
  });
  await vi.advanceTimersByTimeAsync(400);
  expect(container.querySelector(".cmpl-card")).toHaveClass("cmpl-reveal--in");

  await rerender({ ...baseProps, isCurrent: false });
  expect(container.querySelector(".cmpl-hero")).not.toHaveClass("cmpl-hero--play");

  await vi.advanceTimersByTimeAsync(3000);
  expect(container.querySelector(".confetti-effect")).not.toBeInTheDocument();
});

test("restarts the sequence fresh on re-entry (isCurrent false then true again)", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const { container, rerender } = render(CompletionScreen, {
    props: { ...baseProps, isCurrent: true },
  });
  await vi.advanceTimersByTimeAsync(3000);
  expect(container.querySelector(".cmpl-actions")).toHaveClass("cmpl-reveal--in");

  await rerender({ ...baseProps, isCurrent: false });
  expect(container.querySelector(".cmpl-actions")).not.toHaveClass("cmpl-reveal--in");

  await rerender({ ...baseProps, isCurrent: true });
  expect(container.querySelector(".cmpl-actions")).not.toHaveClass("cmpl-reveal--in");
  await vi.advanceTimersByTimeAsync(1900);
  expect(container.querySelector(".cmpl-actions")).toHaveClass("cmpl-reveal--in");
});

test("under prefers-reduced-motion, every reveal is final immediately and confetti never mounts", () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  const { container } = render(CompletionScreen, {
    props: { ...baseProps, caption: "c", closingText: "d", isCurrent: true },
  });
  expect(container.querySelector(".cmpl-card")).toHaveClass("cmpl-reveal--in");
  expect(container.querySelector(".cmpl-actions")).toHaveClass("cmpl-reveal--in");
  expect(container.querySelector(".cmpl-hero")).not.toHaveClass("cmpl-hero--play");
  expect(container.querySelector(".confetti-effect")).not.toBeInTheDocument();
  window.matchMedia = originalMatchMedia;
});

test("vibrates once when confetti fires", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const vibrateSpy = vi.fn();
  Object.defineProperty(navigator, "vibrate", { value: vibrateSpy, configurable: true });
  render(CompletionScreen, { props: { ...baseProps, isCurrent: true } });
  await vi.advanceTimersByTimeAsync(780);
  expect(vibrateSpy).toHaveBeenCalledWith(40);
  vi.useRealTimers();
});

test("shows a placeholder dash for photos-taken when local storage was disabled", () => {
  render(CompletionScreen, {
    props: { ...baseProps, stats: { ...baseProps.stats, photosCount: "—" } },
  });
  expect(screen.getByText("—")).toBeInTheDocument();
});
