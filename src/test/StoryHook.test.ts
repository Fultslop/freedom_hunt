import { render } from "@testing-library/svelte/svelte5";
import StoryHook from "../components/StoryHook.svelte";
import type { StoryBlock } from "../types/storyline";

test("renders plain markdown with no mark when there is no ==highlight==", () => {
  const block: Extract<StoryBlock, { type: "hook" }> = { type: "hook", markdown: "Plain hook line." };
  render(StoryHook, { props: { block } });
  expect(document.querySelector(".story-hook")).toHaveTextContent("Plain hook line.");
  expect(document.querySelector("mark")).not.toBeInTheDocument();
});

test("wraps a ==highlight== in <mark>", () => {
  const block: Extract<StoryBlock, { type: "hook" }> = {
    type: "hook",
    markdown: "Book bans are not ==just about books==.",
  };
  render(StoryHook, { props: { block } });
  expect(document.querySelector(".story-hook mark")).toHaveTextContent("just about books");
});
