import type { RouteEntry, CheckpointEntry } from "../types/data";

export function isCheckpointEntry(entry: RouteEntry): entry is CheckpointEntry {
  return entry?.["template-type"] === "checkpoint";
}

export function nextNavigableIndex(entries: RouteEntry[], current: number): number {
  let i = current + 1;
  while (i < entries.length && isCheckpointEntry(entries[i])) {
    i += 1;
  }
  return i < entries.length ? i : current;
}

export function prevNavigableIndex(entries: RouteEntry[], current: number): number {
  let i = current - 1;
  while (i >= 0 && isCheckpointEntry(entries[i])) {
    i -= 1;
  }
  return i >= 0 ? i : current;
}

export interface CheckpointCrossing {
  index: number;
  checkpoint: CheckpointEntry;
}

export function checkpointsBetween(entries: RouteEntry[], from: number, to: number): CheckpointCrossing[] {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const result: CheckpointCrossing[] = [];
  for (let i = low + 1; i < high; i += 1) {
    const entry = entries[i];
    if (isCheckpointEntry(entry)) {
      result.push({ index: i, checkpoint: entry });
    }
  }
  return result;
}

function isCheckpointBlocked(checkpoint: CheckpointEntry): boolean {
  const reEntry = checkpoint["re-entry"];
  if (reEntry === undefined || reEntry === true) {
    return false;
  }
  if (reEntry === false) {
    return true;
  }
  return reEntry.blocked_after_exit ?? true;
}

export function isBackwardCrossingBlocked(entries: RouteEntry[], from: number, to: number): boolean {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  for (let i = low; i < high; i += 1) {
    const entry = entries[i];
    if (isCheckpointEntry(entry) && isCheckpointBlocked(entry)) {
      return true;
    }
  }
  return false;
}

export function earliestAllowedIndex(entries: RouteEntry[], current: number): number {
  let position = current;
  while (position > 0) {
    const prev = prevNavigableIndex(entries, position);
    if (prev === position) {
      break;
    }
    if (isBackwardCrossingBlocked(entries, prev, position)) {
      return position;
    }
    position = prev;
  }
  return position;
}
