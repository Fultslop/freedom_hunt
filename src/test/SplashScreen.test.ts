import { render, screen } from "@testing-library/svelte/svelte5";
import SplashScreen from "../components/SplashScreen.svelte";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));

afterEach(() => {
  vi.useRealTimers();
});

test("renders the title", () => {
  render(SplashScreen, { props: { image: "x.jpg", title: "You Found It!" } });
  expect(screen.getByText("You Found It!")).toBeInTheDocument();
});

test("applies the grayscale shader class", () => {
  const { container } = render(SplashScreen, {
    props: { image: "x.jpg", title: "T", shader: "grayscale" },
  });
  expect(container.querySelector(".splash-screen")).toHaveClass("splash-screen--grayscale");
});

test("renders a vignette overlay for the vignette shader", () => {
  const { container } = render(SplashScreen, {
    props: { image: "x.jpg", title: "T", shader: "vignette" },
  });
  expect(container.querySelector(".splash-screen__overlay--vignette")).toBeInTheDocument();
});

test("does not play any effect when effectConfig is absent", () => {
  const { container } = render(SplashScreen, { props: { image: "x.jpg", title: "T" } });
  expect(container.querySelector(".confetti-effect")).not.toBeInTheDocument();
});

test("does not play the effect while isCurrent is false", () => {
  const { container } = render(SplashScreen, {
    props: { image: "x.jpg", title: "T", effectConfig: { type: "confetti" }, isCurrent: false },
  });
  expect(container.querySelector(".confetti-effect")).not.toBeInTheDocument();
});

test("plays the effect immediately when isCurrent is true", () => {
  const { container } = render(SplashScreen, {
    props: { image: "x.jpg", title: "T", effectConfig: { type: "confetti" }, isCurrent: true },
  });
  expect(container.querySelector(".confetti-effect")).toBeInTheDocument();
});

test("does not schedule a repeat when max defaults to 1", () => {
  vi.useFakeTimers();
  const scheduleSpy = vi.spyOn(globalThis, "setTimeout");
  render(SplashScreen, {
    props: { image: "x.jpg", title: "T", effectConfig: { type: "confetti", cooldown: { min: 0, max: 0 } } },
  });
  expect(scheduleSpy).not.toHaveBeenCalled();
});

test("schedules exactly max-1 repeats and stops scheduling after the final iteration", () => {
  vi.useFakeTimers();
  render(SplashScreen, {
    props: {
      image: "x.jpg",
      title: "T",
      effectConfig: { type: "confetti", max: 3, cooldown: { min: 0, max: 0 } },
    },
  });
  const scheduleSpy = vi.spyOn(globalThis, "setTimeout");
  vi.runOnlyPendingTimers(); // -> iteration 2, schedules iteration 3
  expect(scheduleSpy).toHaveBeenCalledTimes(1);
  vi.runOnlyPendingTimers(); // -> iteration 3, the last one
  expect(scheduleSpy).toHaveBeenCalledTimes(1); // no 4th iteration scheduled
});

test("keeps scheduling indefinitely when max is negative", () => {
  vi.useFakeTimers();
  render(SplashScreen, {
    props: {
      image: "x.jpg",
      title: "T",
      effectConfig: { type: "confetti", max: -1, cooldown: { min: 0, max: 0 } },
    },
  });
  const scheduleSpy = vi.spyOn(globalThis, "setTimeout");
  vi.runOnlyPendingTimers();
  vi.runOnlyPendingTimers();
  vi.runOnlyPendingTimers();
  expect(scheduleSpy).toHaveBeenCalledTimes(3);
});

test("stops looping once isCurrent goes false, even mid-sequence", () => {
  vi.useFakeTimers();
  const { rerender } = render(SplashScreen, {
    props: {
      image: "x.jpg",
      title: "T",
      effectConfig: { type: "confetti", max: -1, cooldown: { min: 1, max: 1 } },
      isCurrent: true,
    },
  });
  const scheduleSpy = vi.spyOn(globalThis, "setTimeout");
  vi.advanceTimersByTime(1000); // one 1s cooldown elapses -> iteration 2 fires, schedules iteration 3
  expect(scheduleSpy).toHaveBeenCalledTimes(1);
  rerender({
    image: "x.jpg",
    title: "T",
    effectConfig: { type: "confetti", max: -1, cooldown: { min: 1, max: 1 } },
    isCurrent: false,
  });
  // Bounded advance: even if the bug this guards against were present, a fixed
  // real-looking cooldown (1s) means this can only fire a handful more times
  // within 5 virtual seconds, never hang — unlike an unbounded runAllTimers().
  vi.advanceTimersByTime(5000);
  expect(scheduleSpy).toHaveBeenCalledTimes(1); // no further iterations were scheduled
});

test("restarts fresh from iteration 1 when isCurrent goes false then true again (re-visit)", async () => {
  const { container, rerender } = render(SplashScreen, {
    props: { image: "x.jpg", title: "T", effectConfig: { type: "confetti", max: 1 }, isCurrent: true },
  });
  expect(container.querySelector(".confetti-effect")).toBeInTheDocument();

  await rerender({ image: "x.jpg", title: "T", effectConfig: { type: "confetti", max: 1 }, isCurrent: false });
  expect(container.querySelector(".confetti-effect")).not.toBeInTheDocument();

  await rerender({ image: "x.jpg", title: "T", effectConfig: { type: "confetti", max: 1 }, isCurrent: true });
  expect(container.querySelector(".confetti-effect")).toBeInTheDocument();
});
