import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import StoryFold from "../components/StoryFold.svelte";
import type { StoryBlock } from "../types/storyline";

test("shows the custom label when closed", () => {
  const block: Extract<StoryBlock, { type: "fold" }> = {
    type: "fold",
    label: "Read more",
    blocks: [],
  };
  render(StoryFold, { props: { block } });
  expect(screen.getByTestId("story-fold-toggle")).toHaveTextContent("Read more");
});

test("hides inner blocks until toggled open", async () => {
  const block: Extract<StoryBlock, { type: "fold" }> = {
    type: "fold",
    label: "Read the full story",
    blocks: [{ type: "prose", markdown: "Hidden text." }],
  };
  render(StoryFold, { props: { block } });
  expect(screen.queryByText("Hidden text.")).not.toBeInTheDocument();
  const toggle = screen.getByTestId("story-fold-toggle");
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  await fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText("Hidden text.")).toBeInTheDocument();
});

test("toggle label switches between custom label and Show less", async () => {
  const block: Extract<StoryBlock, { type: "fold" }> = {
    type: "fold",
    label: "Read the full story",
    blocks: [],
  };
  render(StoryFold, { props: { block } });
  const toggle = screen.getByTestId("story-fold-toggle");
  expect(toggle).toHaveTextContent("Read the full story");
  await fireEvent.click(toggle);
  expect(toggle).toHaveTextContent("Show less");
});

test("recurses through fold block kinds when opened", async () => {
  const block: Extract<StoryBlock, { type: "fold" }> = {
    type: "fold",
    label: "Read more",
    blocks: [{ type: "stats", doc: { items: [{ value: "1", label: "one" }] }, ref: "002_stats_example.yaml" }],
  };
  render(StoryFold, { props: { block } });
  await fireEvent.click(screen.getByTestId("story-fold-toggle"));
  expect(document.querySelector(".story-stats")).toBeInTheDocument();
});
