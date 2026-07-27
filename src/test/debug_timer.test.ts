import { render } from "@testing-library/svelte/svelte5";
import SplashScreen from "../components/SplashScreen.svelte";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));

test("plain render with effectConfig and max 3, no spy no fake timers", () => {
  const { container } = render(SplashScreen, {
    props: { image: "x.jpg", title: "T", effectConfig: { type: "confetti", max: 3, cooldown: { min: 0, max: 0 } } },
  });
  console.log("rendered ok:", !!container.querySelector(".confetti-effect"));
});
