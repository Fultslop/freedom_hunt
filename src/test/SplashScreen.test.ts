import { render, screen } from "@testing-library/svelte/svelte5";
import SplashScreen from "../components/SplashScreen.svelte";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));

test("renders the title", () => {
  render(SplashScreen, {
    props: { image: "x.jpg", title: "You Found It!", entryKey: 1, playEffect: false },
  });
  expect(screen.getByText("You Found It!")).toBeInTheDocument();
});

test("applies the grayscale shader class", () => {
  const { container } = render(SplashScreen, {
    props: { image: "x.jpg", title: "T", shader: "grayscale", entryKey: 1, playEffect: false },
  });
  expect(container.querySelector(".splash-screen")).toHaveClass("splash-screen--grayscale");
});

test("renders a vignette overlay for the vignette shader", () => {
  const { container } = render(SplashScreen, {
    props: { image: "x.jpg", title: "T", shader: "vignette", entryKey: 1, playEffect: false },
  });
  expect(container.querySelector(".splash-screen__overlay--vignette")).toBeInTheDocument();
});

test("plays the confetti effect and reports it fired when playEffect is true", () => {
  const onEffectPlayed = vi.fn();
  const { container } = render(SplashScreen, {
    props: {
      image: "x.jpg",
      title: "T",
      effectName: "confetti",
      entryKey: 1,
      playEffect: true,
      onEffectPlayed,
    },
  });
  expect(container.querySelector(".confetti-effect")).toBeInTheDocument();
  expect(onEffectPlayed).toHaveBeenCalledTimes(1);
});

test("does not play the effect when playEffect is false", () => {
  const onEffectPlayed = vi.fn();
  const { container } = render(SplashScreen, {
    props: { image: "x.jpg", title: "T", effectName: "confetti", entryKey: 1, playEffect: false, onEffectPlayed },
  });
  expect(container.querySelector(".confetti-effect")).not.toBeInTheDocument();
  expect(onEffectPlayed).not.toHaveBeenCalled();
});

test("re-fires the effect when entryKey changes and playEffect is true again", async () => {
  const onEffectPlayed = vi.fn();
  const { rerender } = render(SplashScreen, {
    props: { image: "x.jpg", title: "T", effectName: "confetti", entryKey: 1, playEffect: true, onEffectPlayed },
  });
  expect(onEffectPlayed).toHaveBeenCalledTimes(1);
  await rerender({ image: "x.jpg", title: "T2", effectName: "confetti", entryKey: 4, playEffect: true, onEffectPlayed });
  expect(onEffectPlayed).toHaveBeenCalledTimes(2);
});
