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

export function locationIdAt(locations: string[], index: number): string {
  return locations[index] ?? "";
}

interface NavBarEntry {
  "nav-bar"?: { visible?: boolean };
}

export function isNavBarVisible(entry: RouteEntry): boolean {
  if (entry["template-type"] === "checkpoint") {
    return true;
  }
  return (entry as NavBarEntry)["nav-bar"]?.visible ?? true;
}
