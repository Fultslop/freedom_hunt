import { render, screen } from "@testing-library/svelte/svelte5";
import StoryProse from "../components/StoryProse.svelte";

test("renders markdown prose", () => {
  render(StoryProse, { props: { markdown: "Hello **world**." } });
  expect(screen.getByText("world")).toBeInTheDocument();
});

test("renders a ==highlight== as a <mark>", () => {
  render(StoryProse, { props: { markdown: "A ==highlighted== phrase." } });
  expect(document.querySelector("mark")).toHaveTextContent("highlighted");
});
