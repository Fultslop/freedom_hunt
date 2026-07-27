import { render } from "@testing-library/svelte/svelte5";
import FireworksEffect from "../components/effects/FireworksEffect.svelte";

test("renders 3 firework bursts of 10 dots each", () => {
  const { container } = render(FireworksEffect);
  expect(container.querySelectorAll(".fireworks-effect__burst")).toHaveLength(3);
  expect(container.querySelectorAll(".fireworks-effect__dot")).toHaveLength(30);
});
