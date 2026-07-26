import { render } from "@testing-library/svelte/svelte5";
import ConfettiEffect from "../components/effects/ConfettiEffect.svelte";

test("renders 24 confetti particles", () => {
  const { container } = render(ConfettiEffect);
  expect(container.querySelectorAll(".confetti-effect__particle")).toHaveLength(24);
});
