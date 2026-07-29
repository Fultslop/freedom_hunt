import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import StoryStats from "../components/StoryStats.svelte";
import type { StoryBlock } from "../types/storyline";

const block = (overrides: Partial<StoryBlock & Record<string, unknown>> = {}) =>
  ({
    type: "stats",
    doc: {
      items: overrides.items ?? [],
      ...(overrides.prompt !== undefined ? { prompt: overrides.prompt } : {}),
      ...(overrides.footnote !== undefined ? { footnote: overrides.footnote } : {}),
    },
    ref: "002_stats_example.yaml",
  }) as Extract<StoryBlock, { type: "stats" }>;

test("renders each value/label pair", () => {
  render(StoryStats, {
    props: {
      block: block({
        items: [
          { value: "6,870", label: "school book bans" },
          { value: "23", label: "states" },
        ],
      }),
    },
  });
  expect(screen.getByText("6,870")).toBeInTheDocument();
  expect(screen.getByText("school book bans")).toBeInTheDocument();
  expect(screen.getByText("23")).toBeInTheDocument();
  expect(screen.getByText("states")).toBeInTheDocument();
});

test("omits prompt element when absent", () => {
  render(StoryStats, {
    props: { block: block({ items: [{ value: "1", label: "a" }] }) },
  });
  expect(document.querySelector(".story-stats__prompt")).not.toBeInTheDocument();
});

test("renders the prompt above the grid while a click_to_reveal item is still covered", () => {
  render(StoryStats, {
    props: {
      block: block({
        items: [{ value: "1", label: "a", visibility: "click_to_reveal" }],
        prompt: "Guess it",
      }),
    },
  });
  expect(screen.getByText("Guess it")).toBeInTheDocument();
});

test("does not render a prompt when no item is click_to_reveal", () => {
  render(StoryStats, {
    props: {
      block: block({
        items: [{ value: "1", label: "a" }],
        prompt: "Guess it",
      }),
    },
  });
  expect(screen.queryByText("Guess it")).not.toBeInTheDocument();
});

test("hides a click_to_reveal item's value behind a tap-to-reveal cover", () => {
  render(StoryStats, {
    props: {
      block: block({
        items: [
          { value: "6,870", label: "bans", visibility: "click_to_reveal" },
          { value: "23", label: "states" },
        ],
      }),
    },
  });
  expect(screen.queryByText("6,870")).not.toBeInTheDocument();
  expect(screen.getByText("23")).toBeInTheDocument();
  expect(screen.getByTestId("story-stats-cover-0")).toBeInTheDocument();
});

test("reveals the hidden value on click and drops the cover", async () => {
  render(StoryStats, {
    props: {
      block: block({
        items: [{ value: "6,870", label: "bans", visibility: "click_to_reveal" }],
      }),
    },
  });
  await fireEvent.click(screen.getByTestId("story-stats-cover-0"));
  expect(screen.getByText("6,870")).toBeInTheDocument();
  expect(screen.queryByTestId("story-stats-cover-0")).not.toBeInTheDocument();
});

test("shows the footnote regardless of reveal state — it's a citation, not a guessing hint", async () => {
  render(StoryStats, {
    props: {
      block: block({
        items: [{ value: "6,870", label: "bans", visibility: "click_to_reveal" }],
        footnote: "Recorded by PEN America.",
      }),
    },
  });
  expect(screen.getByText("Recorded by PEN America.")).toBeInTheDocument();
  await fireEvent.click(screen.getByTestId("story-stats-cover-0"));
  expect(screen.getByText("Recorded by PEN America.")).toBeInTheDocument();
});

test("shows the footnote even when no item is click_to_reveal", () => {
  render(StoryStats, {
    props: {
      block: block({ items: [{ value: "1", label: "a" }], footnote: "Recorded by PEN America." }),
    },
  });
  expect(screen.getByText("Recorded by PEN America.")).toBeInTheDocument();
});

test("formats a numeric value with locale grouping, leaves a string value verbatim", () => {
  render(StoryStats, {
    props: {
      block: block({
        items: [
          { value: 6870, label: "bans" },
          { value: "1 in 4", label: "as a string" },
        ],
      }),
    },
  });
  expect(screen.getByText("6,870")).toBeInTheDocument();
  expect(screen.getByText("1 in 4")).toBeInTheDocument();
});

test("count_up numeric item starts at 0 and animates up to its final value", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  render(StoryStats, {
    props: { block: block({ items: [{ value: 100, label: "stops", visibility: "count_up" }] }) },
  });
  expect(screen.getByText("0")).toBeInTheDocument();
  await vi.advanceTimersByTimeAsync(700);
  expect(screen.getByText("100")).toBeInTheDocument();
  vi.useRealTimers();
});

test("count_up items honor staggerMs — a later item hasn't started while an earlier one already has", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const { container } = render(StoryStats, {
    props: {
      block: block({
        items: [
          { value: 100, label: "a", visibility: "count_up" },
          { value: 100, label: "b", visibility: "count_up" },
        ],
      }),
      staggerMs: 150,
    },
  });
  await vi.advanceTimersByTimeAsync(60);
  const values = container.querySelectorAll(".story-stats__value");
  expect(Number(values[0].textContent)).toBeGreaterThan(0);
  expect(Number(values[1].textContent)).toBe(0);
  vi.useRealTimers();
});

test("a string value under count_up visibility renders verbatim and is never animated", () => {
  render(StoryStats, {
    props: {
      block: block({ items: [{ value: "2h 18m", label: "time on foot", visibility: "count_up" }] }),
    },
  });
  expect(screen.getByText("2h 18m")).toBeInTheDocument();
});

test("under prefers-reduced-motion, a count_up item shows its final value immediately with no ramp", () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
  render(StoryStats, {
    props: { block: block({ items: [{ value: 100, label: "stops", visibility: "count_up" }] }) },
  });
  expect(screen.getByText("100")).toBeInTheDocument();
  window.matchMedia = originalMatchMedia;
});

test("adds the pop class to a count_up item once its ramp finishes", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const { container } = render(StoryStats, {
    props: { block: block({ items: [{ value: 5, label: "a", visibility: "count_up" }] }) },
  });
  await vi.advanceTimersByTimeAsync(700);
  expect(container.querySelector(".story-stats__value--pop")).toBeInTheDocument();
  vi.useRealTimers();
});

test("existing visible/click_to_reveal items are unaffected by the count_up addition", () => {
  render(StoryStats, {
    props: {
      block: block({
        items: [
          { value: "6,870", label: "school book bans" },
          { value: "23", label: "states", visibility: "click_to_reveal" },
        ],
      }),
    },
  });
  expect(screen.getByText("6,870")).toBeInTheDocument();
  expect(screen.queryByText("23")).not.toBeInTheDocument();
  expect(screen.getByTestId("story-stats-cover-1")).toBeInTheDocument();
});

test("does not render a cover for items with visible flag", () => {
  render(StoryStats, {
    props: {
      block: block({ items: [{ value: "1", label: "a" }] }),
    },
  });
  expect(document.querySelector(".story-stats__cover")).not.toBeInTheDocument();
});
