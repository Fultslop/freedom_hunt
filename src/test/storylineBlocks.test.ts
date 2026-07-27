import { parseStoryline, validateStoryline, validateStatsDoc, findStatsRefs } from "../utils/storylineBlocks";
import type { StoryBlock, StatsDoc } from "../types/storyline";

function blocksOf(text: string, elements: Record<string, StatsDoc> = {}): StoryBlock[] {
  return parseStoryline(text, elements).blocks;
}

const SAMPLE_STATS: StatsDoc = {
  footnote: "Recorded by PEN America.",
  items: [
    { value: 6870, label: "school book bans", visibility: "click_to_reveal" },
    { value: 23, label: "states" },
  ],
};

test("returns a single prose block for text with no constructs", () => {
  expect(blocksOf("Just a paragraph.")).toEqual([{ type: "prose", markdown: "Just a paragraph." }]);
});

test("extracts the first ## line anywhere as the hook", () => {
  const blocks = blocksOf("Intro line.\n\n## Book bans are not ==just about books==.\n\nMore text.");
  expect(blocks).toEqual([
    { type: "prose", markdown: "Intro line." },
    { type: "hook", markdown: "Book bans are not ==just about books==." },
    { type: "prose", markdown: "More text." },
  ]);
});

test("treats a second ## on its own line as an ordinary heading, not another hook", () => {
  const blocks = blocksOf("## First hook\n\nIntro.\n\n## Second heading\n\nMore text.");
  expect(blocks).toEqual([
    { type: "hook", markdown: "First hook" },
    { type: "prose", markdown: "Intro." },
    { type: "prose", markdown: "## Second heading" },
    { type: "prose", markdown: "More text." },
  ]);
});

test("does not drop a ## line that appears mid-sentence in prose", () => {
  const blocks = blocksOf("## First hook\n\nBody with a ## second heading inline in prose.");
  expect(blocks).toEqual([
    { type: "hook", markdown: "First hook" },
    { type: "prose", markdown: "Body with a ## second heading inline in prose." },
  ]);
});

test("preserves a ## line inside the fold as an ordinary heading, not dropped or a hook", () => {
  const blocks = blocksOf("[+]\n\nIntro.\n\n## Inside the fold\n\nMore.");
  expect(blocks).toEqual([
    {
      type: "fold",
      label: "Read the full story",
      blocks: [
        { type: "prose", markdown: "Intro." },
        { type: "prose", markdown: "## Inside the fold" },
        { type: "prose", markdown: "More." },
      ],
    },
  ]);
});

test("does not treat a ## inside a fenced code block as a hook", () => {
  const blocks = blocksOf("```\n## not a hook\n```\n\n## Real hook");
  expect(blocks).toEqual([
    { type: "prose", markdown: "```\n## not a hook\n```" },
    { type: "hook", markdown: "Real hook" },
  ]);
});

test("splits above/below the [+] fold marker, defaulting the label", () => {
  const blocks = blocksOf("Above.\n\n[+]\n\nBelow.");
  expect(blocks).toEqual([
    { type: "prose", markdown: "Above." },
    { type: "fold", label: "Read the full story", blocks: [{ type: "prose", markdown: "Below." }] },
  ]);
});

test("uses a custom fold label when given", () => {
  const blocks = blocksOf("[+] See more\n\nBelow.");
  expect(blocks).toEqual([
    { type: "fold", label: "See more", blocks: [{ type: "prose", markdown: "Below." }] },
  ]);
});

test("dedents the fold region regardless of indentation depth", () => {
  const twoSpace = blocksOf("[+]\n\n  Line one.\n  Line two.");
  const fourSpace = blocksOf("[+]\n\n    Line one.\n    Line two.");
  const none = blocksOf("[+]\n\nLine one.\nLine two.");
  const expected = [
    { type: "fold", label: "Read the full story", blocks: [{ type: "prose", markdown: "Line one.\nLine two." }] },
  ];
  expect(twoSpace).toEqual(expected);
  expect(fourSpace).toEqual(expected);
  expect(none).toEqual(expected);
});

test("resolves a {{stats: ref}} transclusion against the elements map", () => {
  const blocks = blocksOf("Intro.\n\n{{stats: 013_stats_right_to_read.yaml}}\n\nOutro.", {
    "013_stats_right_to_read.yaml": SAMPLE_STATS,
  });
  expect(blocks).toEqual([
    { type: "prose", markdown: "Intro." },
    { type: "stats", doc: SAMPLE_STATS, ref: "013_stats_right_to_read.yaml" },
    { type: "prose", markdown: "Outro." },
  ]);
});

test("resolves a transclusion inside the fold", () => {
  const blocks = blocksOf("[+]\n\n{{stats: 013_stats_right_to_read.yaml}}", {
    "013_stats_right_to_read.yaml": SAMPLE_STATS,
  });
  expect(blocks).toEqual([
    {
      type: "fold",
      label: "Read the full story",
      blocks: [{ type: "stats", doc: SAMPLE_STATS, ref: "013_stats_right_to_read.yaml" }],
    },
  ]);
});

test("drops an unresolved transclusion and warns", () => {
  const result = parseStoryline("{{stats: missing.yaml}}", {});
  expect(result.blocks).toEqual([]);
  expect(result.warnings).toEqual(['could not resolve "{{stats: missing.yaml}}" — dropped']);
});

test("drops an unregistered transclusion type and warns", () => {
  const result = parseStoryline("{{banner: whatever.yaml}}", {});
  expect(result.blocks).toEqual([]);
  expect(result.warnings).toEqual(['unknown transclusion type "banner" for "whatever.yaml" — dropped']);
});

test("warns on a second [+] marker but keeps it as literal text", () => {
  const result = parseStoryline("[+]\n\nFirst.\n\n[+] Ignored\n\nMore text.", {});
  expect(result.blocks).toEqual([
    {
      type: "fold",
      label: "Read the full story",
      blocks: [{ type: "prose", markdown: "First.\n\n[+] Ignored\n\nMore text." }],
    },
  ]);
  expect(result.warnings).toEqual([
    'a second "[+]" marker was found inside the fold — only the first is treated as the boundary',
  ]);
});

test("findStatsRefs finds every stats reference outside code fences", () => {
  const refs = findStatsRefs(
    "{{stats: a.yaml}}\n\n```\n{{stats: fake.yaml}}\n```\n\n[+]\n\n{{stats: b.yaml}}",
  );
  expect(refs).toEqual(["a.yaml", "b.yaml"]);
});

test("validateStatsDoc flags more than one click_to_reveal item", () => {
  const doc: StatsDoc = {
    items: [
      { value: 1, label: "a", visibility: "click_to_reveal" },
      { value: 2, label: "b", visibility: "click_to_reveal" },
    ],
  };
  expect(validateStatsDoc(doc)).toEqual([
    'stats doc has 2 "click_to_reveal" items, at most one is allowed',
  ]);
});

test("validateStatsDoc flags a prompt with no click_to_reveal item", () => {
  const doc: StatsDoc = { prompt: "Guess it", items: [{ value: 1, label: "a" }] };
  expect(validateStatsDoc(doc)).toEqual([
    'stats doc has a "prompt" but no "click_to_reveal" item — the prompt has nothing to guess and will not render',
  ]);
});

test("validateStatsDoc is clean for a well-formed doc", () => {
  expect(validateStatsDoc(SAMPLE_STATS)).toEqual([]);
});

test("validateStoryline surfaces stats doc warnings, tagged with the ref, including inside a fold", () => {
  const badDoc: StatsDoc = { prompt: "Guess it", items: [{ value: 1, label: "a" }] };
  const blocks: StoryBlock[] = [
    { type: "stats", doc: badDoc, ref: "bad.yaml" },
    { type: "fold", label: "More", blocks: [{ type: "stats", doc: badDoc, ref: "bad2.yaml" }] },
  ];
  expect(validateStoryline(blocks)).toEqual([
    '"bad.yaml": stats doc has a "prompt" but no "click_to_reveal" item — the prompt has nothing to guess and will not render',
    '"bad2.yaml": stats doc has a "prompt" but no "click_to_reveal" item — the prompt has nothing to guess and will not render',
  ]);
});
