import { render, screen } from "@testing-library/svelte/svelte5";
import TextScreen from "../components/TextScreen.svelte";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
  getCachedImageUrl: vi.fn().mockReturnValue("blob:test"),
}));

test("renders the title and markdown text", () => {
  render(TextScreen, { props: { title: "Welcome", text: "Hello **world**" } });
  expect(screen.getByText("Welcome")).toBeInTheDocument();
  expect(screen.getByText("world")).toBeInTheDocument();
});

test("applies the margin style to the text body when given", () => {
  const { container } = render(TextScreen, {
    props: { title: "Welcome", text: "Hi", margin: "1rem 2rem" },
  });
  const body = container.querySelector(".text-screen__body") as HTMLElement;
  expect(body.style.margin).toBe("1rem 2rem");
});

test("has no inline margin style when margin is absent", () => {
  const { container } = render(TextScreen, { props: { title: "Welcome", text: "Hi" } });
  const body = container.querySelector(".text-screen__body") as HTMLElement;
  expect(body.getAttribute("style")).toBeNull();
});
