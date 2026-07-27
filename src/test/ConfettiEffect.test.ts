import { render } from "@testing-library/svelte/svelte5";
import ConfettiEffect from "../components/effects/ConfettiEffect.svelte";

test("renders 32 confetti particles", () => {
  const { container } = render(ConfettiEffect);
  expect(container.querySelectorAll(".confetti-effect__particle")).toHaveLength(32);
});

test("gives each particle a border darkened to 5% of its fill color's value", () => {
  const { container } = render(ConfettiEffect);
  const particles = container.querySelectorAll<HTMLElement>(".confetti-effect__particle");
  // #f59e0b -> (245, 158, 11); 5% of each channel, rounded, is (12, 8, 1) -> #0c0801
  const amber = Array.from(particles).find((particle) => particle.style.background === "#f59e0b");
  expect(amber).toBeDefined();
  expect(amber!.style.borderColor).toBe("#0c0801");
});
