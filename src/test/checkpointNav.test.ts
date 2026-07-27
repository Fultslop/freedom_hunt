import {
  isCheckpointEntry,
  nextNavigableIndex,
  prevNavigableIndex,
  checkpointsBetween,
  isBackwardCrossingBlocked,
  earliestAllowedIndex,
} from "../utils/checkpointNav";
import type { RouteEntry } from "../types/data";

const loc: RouteEntry = {
  title: "L",
  name: { value: "L" },
  coordinates: { latitude: 0, longitude: 0 },
  storyline: "s",
  breadcrumb: "b",
  challenge: { name: "", description: "d", form: [] },
};

test("isCheckpointEntry is true only for template-type checkpoint", () => {
  expect(isCheckpointEntry({ "template-type": "checkpoint" })).toBe(true);
  expect(isCheckpointEntry(loc)).toBe(false);
});

test("nextNavigableIndex steps to the next entry when there is no checkpoint", () => {
  const entries = [loc, loc, loc];
  expect(nextNavigableIndex(entries, 0)).toBe(1);
});

test("nextNavigableIndex skips over a single checkpoint", () => {
  const entries = [loc, { "template-type": "checkpoint" } as RouteEntry, loc];
  expect(nextNavigableIndex(entries, 0)).toBe(2);
});

test("nextNavigableIndex skips over consecutive checkpoints", () => {
  const entries = [
    loc,
    { "template-type": "checkpoint" } as RouteEntry,
    { "template-type": "checkpoint" } as RouteEntry,
    loc,
  ];
  expect(nextNavigableIndex(entries, 0)).toBe(3);
});

test("nextNavigableIndex no-ops when a checkpoint is the last entry (trailing checkpoint)", () => {
  const entries = [loc, { "template-type": "checkpoint" } as RouteEntry];
  expect(nextNavigableIndex(entries, 0)).toBe(0);
});

test("nextNavigableIndex no-ops at the true end of a route with no checkpoints", () => {
  const entries = [loc, loc];
  expect(nextNavigableIndex(entries, 1)).toBe(1);
});

test("prevNavigableIndex steps back to the previous entry when there is no checkpoint", () => {
  const entries = [loc, loc, loc];
  expect(prevNavigableIndex(entries, 2)).toBe(1);
});

test("prevNavigableIndex skips backward over a checkpoint", () => {
  const entries = [loc, { "template-type": "checkpoint" } as RouteEntry, loc];
  expect(prevNavigableIndex(entries, 2)).toBe(0);
});

test("checkpointsBetween returns checkpoints strictly between two indices, with their own array index", () => {
  const checkpoint = { "template-type": "checkpoint" } as RouteEntry;
  const entries = [loc, checkpoint, loc];
  expect(checkpointsBetween(entries, 0, 2)).toEqual([{ index: 1, checkpoint }]);
});

test("checkpointsBetween returns an empty array when nothing lies between", () => {
  const entries = [loc, loc];
  expect(checkpointsBetween(entries, 0, 1)).toEqual([]);
});

test("isBackwardCrossingBlocked is true for the 're-entry: false' shorthand", () => {
  const entries = [{ "template-type": "checkpoint", "re-entry": false } as RouteEntry, loc];
  expect(isBackwardCrossingBlocked(entries, 0, 1)).toBe(true);
});

test("isBackwardCrossingBlocked defaults blocked_after_exit to true when re-entry is an object", () => {
  const entries = [{ "template-type": "checkpoint", "re-entry": {} } as RouteEntry, loc];
  expect(isBackwardCrossingBlocked(entries, 0, 1)).toBe(true);
});

test("isBackwardCrossingBlocked is false when blocked_after_exit is explicitly false", () => {
  const entries = [
    { "template-type": "checkpoint", "re-entry": { blocked_after_exit: false } } as RouteEntry,
    loc,
  ];
  expect(isBackwardCrossingBlocked(entries, 0, 1)).toBe(false);
});

test("isBackwardCrossingBlocked is false when there is no checkpoint between the two indices", () => {
  const entries = [loc, loc];
  expect(isBackwardCrossingBlocked(entries, 0, 1)).toBe(false);
});

test("earliestAllowedIndex is 0 for a route with no blocking checkpoints", () => {
  const entries = [loc, loc, loc];
  expect(earliestAllowedIndex(entries, 2)).toBe(0);
});

test("earliestAllowedIndex stops at the position right after a blocked checkpoint", () => {
  const entries = [
    loc,
    { "template-type": "checkpoint", "re-entry": false } as RouteEntry,
    loc,
    loc,
  ];
  expect(earliestAllowedIndex(entries, 3)).toBe(2);
});

test("earliestAllowedIndex returns the current position when nothing lies further back at all", () => {
  const entries = [{ "template-type": "checkpoint" } as RouteEntry, loc];
  expect(earliestAllowedIndex(entries, 1)).toBe(1);
});
