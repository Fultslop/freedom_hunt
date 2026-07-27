import type { StoryBlock, FoldBlock, StatsDoc } from "../types/storyline";

const HOOK_LINE = /^##\s+(.*)$/;
const FOLD_LINE = /^\s*\[\+\]\s*(.*)$/;
const CODE_FENCE_LINE = /^(```|~~~)/;
const TRANSCLUSION_LINE = /^\s*\{\{\s*([a-z_]+)\s*:\s*([^}]+?)\s*\}\}\s*$/;

function maskCodeFences(lines: string[]): boolean[] {
  const masked: boolean[] = [];
  let inFence = false;
  for (const line of lines) {
    if (CODE_FENCE_LINE.test(line)) {
      masked.push(true);
      inFence = !inFence;
    } else {
      masked.push(inFence);
    }
  }
  return masked;
}

function splitFold(lines: string[]): { above: string[]; foldLabel?: string; below: string[] } {
  const masked = maskCodeFences(lines);
  const index = lines.findIndex((line, lineIndex) => !masked[lineIndex] && FOLD_LINE.test(line));
  if (index < 0) {
    return { above: lines, below: [] };
  }
  const match = FOLD_LINE.exec(lines[index]) as RegExpExecArray;
  return {
    above: lines.slice(0, index),
    foldLabel: match[1].trim() || "Read the full story",
    below: lines.slice(index + 1),
  };
}

function dedent(lines: string[]): string[] {
  const nonBlank = lines.filter((line) => line.trim().length > 0);
  const minIndent =
    nonBlank.length > 0
      ? Math.min(...nonBlank.map((line) => line.length - line.trimStart().length))
      : 0;
  return lines.map((line) => line.slice(Math.min(minIndent, line.length)));
}

type RegionSegment =
  | { prose: string }
  | { hook: string }
  | { transclusionType: string; ref: string };

function extractSegments(lines: string[]): RegionSegment[] {
  const masked = maskCodeFences(lines);
  const segments: RegionSegment[] = [];
  let proseLines: string[] = [];

  const flushProse = (): void => {
    const prose = proseLines.join("\n").trim();
    if (prose.length > 0) {
      segments.push({ prose });
    }
    proseLines = [];
  };

  for (const [index, line] of lines.entries()) {
    if (masked[index]) {
      proseLines.push(line);
    } else {
      const hookMatch = HOOK_LINE.exec(line);
      if (hookMatch) {
        flushProse();
        segments.push({ hook: hookMatch[1].trim() });
      } else {
        const transclusionMatch = TRANSCLUSION_LINE.exec(line);
        if (transclusionMatch) {
          flushProse();
          segments.push({ transclusionType: transclusionMatch[1], ref: transclusionMatch[2] });
        } else {
          proseLines.push(line);
        }
      }
    }
  }
  flushProse();
  return segments;
}

function segmentsToBlocks(
  segments: RegionSegment[],
  elements: Record<string, StatsDoc>,
  warnings: string[],
): StoryBlock[] {
  const blocks: StoryBlock[] = [];
  let hookPushed = false;
  for (const segment of segments) {
    if ("prose" in segment) {
      blocks.push({ type: "prose", markdown: segment.prose });
    } else if ("hook" in segment) {
      if (!hookPushed) {
        blocks.push({ type: "hook", markdown: segment.hook });
        hookPushed = true;
      } else {
        // Subsequent ## lines are ordinary headings — re-add the prefix
        // stripped by HOOK_LINE so marked still renders an <h2>.
        blocks.push({ type: "prose", markdown: `## ${segment.hook}` });
      }
    } else {
      if (segment.transclusionType !== "stats") {
        warnings.push(
          `unknown transclusion type "${segment.transclusionType}" for "${segment.ref}" — dropped`,
        );
      } else {
        const doc = elements[segment.ref];
        if (!doc) {
          warnings.push(`could not resolve "{{stats: ${segment.ref}}}" — dropped`);
        } else {
          blocks.push({ type: "stats", doc, ref: segment.ref });
        }
      }
    }
  }
  return blocks;
}

function segmentsToFoldBlocks(
  segments: RegionSegment[],
  elements: Record<string, StatsDoc>,
  warnings: string[],
): FoldBlock[] {
  return segments.flatMap((segment): FoldBlock[] => {
    if ("prose" in segment) {
      return [{ type: "prose", markdown: segment.prose }];
    }
    if ("hook" in segment) {
      // ## lines inside the fold region are ordinary headings too — re-add
      // the prefix stripped by HOOK_LINE so marked still renders an <h2>.
      return [{ type: "prose", markdown: `## ${segment.hook}` }];
    }
    if (segment.transclusionType !== "stats") {
      warnings.push(
        `unknown transclusion type "${segment.transclusionType}" for "${segment.ref}" — dropped`,
      );
      return [];
    }
    const doc = elements[segment.ref];
    if (!doc) {
      warnings.push(`could not resolve "{{stats: ${segment.ref}}}" — dropped`);
      return [];
    }
    return [{ type: "stats", doc, ref: segment.ref }];
  });
}

export function parseStoryline(
  text: string,
  elements?: Record<string, StatsDoc>,
): { blocks: StoryBlock[]; warnings: string[] } {
  const warnings: string[] = [];
  const allLines = text.split("\n");

  // Find the fold boundary first (structural element)
  const foldResult = splitFold(allLines);

  const resolved: Record<string, StatsDoc> = elements ?? {};

  // Extract segments from the text above the fold (handles ## hooks inline)
  const segments = extractSegments(foldResult.above);
  const blocks = segmentsToBlocks(segments, resolved, warnings);

  // Process the fold region
  if (foldResult.foldLabel !== undefined) {
    const dedented = dedent(foldResult.below);
    const dedentedMasked = maskCodeFences(dedented);
    const hasSecondMarker = dedented.some(
      (line, index) => !dedentedMasked[index] && FOLD_LINE.test(line),
    );
    if (hasSecondMarker) {
      warnings.push(
        'a second "[+]" marker was found inside the fold — only the first is treated as the boundary',
      );
    }
    blocks.push({
      type: "fold",
      label: foldResult.foldLabel,
      blocks: segmentsToFoldBlocks(extractSegments(dedented), resolved, warnings),
    });
  }

  return { blocks, warnings };
}

export function findStatsRefs(text: string): string[] {
  const lines = text.split("\n");
  const masked = maskCodeFences(lines);
  return lines
    .map((line, index) => (masked[index] ? null : TRANSCLUSION_LINE.exec(line)))
    .filter((match): match is RegExpExecArray => match !== null && match[1] === "stats")
    .map((match) => match[2]);
}

export function validateStatsDoc(doc: StatsDoc): string[] {
  const warnings: string[] = [];
  const hiddenCount = doc.items.filter((item) => item.visibility === "click_to_reveal").length;
  if (hiddenCount > 1) {
    warnings.push(`stats doc has ${hiddenCount} "click_to_reveal" items, at most one is allowed`);
  }
  if (doc.prompt && hiddenCount === 0) {
    warnings.push(
      'stats doc has a "prompt" but no "click_to_reveal" item — the prompt has nothing ' +
        "to guess and will not render",
    );
  }
  return warnings;
}

function flatten(blocks: StoryBlock[]): StoryBlock[] {
  return blocks.flatMap((block) => (block.type === "fold" ? block.blocks : [block]));
}

export function validateStoryline(blocks: StoryBlock[]): string[] {
  return flatten(blocks)
    .filter((block): block is Extract<StoryBlock, { type: "stats" }> => block.type === "stats")
    .flatMap((block) => validateStatsDoc(block.doc).map((msg) => `"${block.ref}": ${msg}`));
}
