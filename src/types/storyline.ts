export type StatVisibility = "visible" | "click_to_reveal";

export interface StatItem {
  value: number | string;
  label: string;
  visibility?: StatVisibility;
}

export interface StatsDoc {
  prompt?: string;
  footnote?: string;
  items: StatItem[];
}

export type StoryBlock =
  | { type: "prose"; markdown: string }
  | { type: "hook"; markdown: string }
  | { type: "stats"; doc: StatsDoc; ref: string }
  | { type: "fold"; label: string; blocks: FoldBlock[] };

export type FoldBlock = Extract<StoryBlock, { type: "prose" } | { type: "stats" }>;
