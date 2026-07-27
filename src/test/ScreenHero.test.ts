import { render, screen } from "@testing-library/svelte/svelte5";
import ScreenHero from "../components/ScreenHero.svelte";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));

test("renders the title", () => {
  render(ScreenHero, { props: { title: "Welcome" } });
  expect(screen.getByText("Welcome")).toBeInTheDocument();
});

test("renders no image when image prop is absent", () => {
  render(ScreenHero, { props: { title: "Welcome" } });
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

test("renders the cached image with the title as alt text", async () => {
  render(ScreenHero, { props: { title: "Welcome", image: "hero.jpg" } });
  const img = await screen.findByRole("img");
  expect(img).toHaveAttribute("src", "blob:test");
  expect(img).toHaveAttribute("alt", "Welcome");
});
