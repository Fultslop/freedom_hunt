import { render } from "@testing-library/svelte/svelte5";
import ShootingStarsEffect from "../components/effects/ShootingStarsEffect.svelte";

test("renders 6 shooting stars", () => {
  const { container } = render(ShootingStarsEffect);
  expect(container.querySelectorAll(".shooting-stars-effect__star")).toHaveLength(6);
});
