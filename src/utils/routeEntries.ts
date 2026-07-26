import type { RouteEntry, LocationEntry } from "../types/data";

export function isLocationEntry(entry: RouteEntry): entry is LocationEntry {
  return (entry["template-type"] ?? "location") === "location";
}

export function locationTotal(entries: RouteEntry[]): number {
  return entries.filter(isLocationEntry).length;
}

export function locationOrdinalAt(entries: RouteEntry[], index: number): number {
  return entries.slice(0, index + 1).filter(isLocationEntry).length;
}
