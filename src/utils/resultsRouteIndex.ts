import { loadText } from "./loadText";
import { loadLocations } from "./loadLocations";
import { isLocationEntry } from "./routeEntries";
import type { RoutesData, LocationEntry } from "../types/data";
import type { RouteLocationEntry, RouteIndex } from "./resultsData";

function toRouteLocationEntries(entries: LocationEntry[]): RouteLocationEntry[] {
  const withForm: RouteLocationEntry[] = [];
  entries.forEach((entry, index) => {
    const fields = entry.challenge.form ?? [];
    if (fields.length > 0) {
      withForm.push({ ordinal: index + 1, name: entry.name.value, fields });
    }
  });
  return withForm;
}

export async function buildRouteIndex(
  lang: string,
  project: string,
  city: string,
): Promise<RouteIndex> {
  const routesData = await loadText<RoutesData>(lang, `projects/${project}/${city}/routes`);
  if (!routesData) {
    return {};
  }
  const index: RouteIndex = {};
  for (const [routeId, route] of Object.entries(routesData)) {
    const paths = route.locations.map(
      (locationFile) => `projects/${project}/${city}/${locationFile}`,
    );
    const resolvedEntries = await loadLocations(lang, paths);
    const locationEntries = resolvedEntries.filter(isLocationEntry);
    index[routeId] = toRouteLocationEntries(locationEntries);
  }
  return index;
}
