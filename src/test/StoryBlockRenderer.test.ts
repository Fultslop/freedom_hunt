import { render, screen } from "@testing-library/svelte/svelte5";
import StoryBlockRenderer from "../components/StoryBlockRenderer.svelte";
import type { StoryBlock } from "../types/storyline";

test("dispatches a prose block through StoryProse", () => {
  const block: StoryBlock = { type: "prose", markdown: "Hello there." };
  render(StoryBlockRenderer, { props: { block } });
  expect(screen.getByText("Hello there.")).toBeInTheDocument();
});

test("dispatches a hook block", () => {
  const block: StoryBlock = { type: "hook", markdown: "Just a hook." };
  render(StoryBlockRenderer, { props: { block } });
  expect(document.querySelector(".story-hook")).toHaveTextContent("Just a hook.");
});

test("dispatches a stats block", () => {
  const block: StoryBlock = {
    type: "stats",
    doc: { items: [{ value: "1", label: "one" }] },
    ref: "002_stats_example.yaml",
  };
  render(StoryBlockRenderer, { props: { block } });
  expect(document.querySelector(".story-stats")).toBeInTheDocument();
});

test("dispatches a fold block through StoryFold", () => {
  const block: StoryBlock = {
    type: "fold",
    label: "Read the full story",
    blocks: [{ type: "prose", markdown: "Extra." }],
  };
  render(StoryBlockRenderer, { props: { block } });
  expect(screen.getByTestId("story-fold-toggle")).toBeInTheDocument();
});
