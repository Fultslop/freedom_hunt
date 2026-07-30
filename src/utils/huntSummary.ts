import { loadText } from "./loadText";
import { loadLocations } from "./loadLocations";
import type { CitiesText, RoutesData, Coordinates } from "../types/data";

const MINUTES_PER_STOP = 12;
const EARTH_RADIUS_METERS = 6371000;

export interface HuntSummary {
  cityId: string;
  routeId: string;
  stopCount: number;
  distanceMeters: number | null;
  durationMinutes: number;
}

/** Great-circle distance between two lat/long points, in meters. */
export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const hav =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(hav));
}

/**
 * Resolves a project to hunt-level stats — but only when it unambiguously
 * has exactly one city and that city has exactly one route. Otherwise
 * returns null: the caller (JoinSheet, TeamSetupPage) falls back to the
 * existing city/route picker screens rather than guessing.
 */
export async function resolveHuntSummary(
  project: string,
  lang: string,
): Promise<HuntSummary | null> {
  const cities = await loadText<CitiesText>(lang, `projects/${project}/cities`);
  if (!cities || cities.items.length !== 1) {
    return null;
  }
  const cityId = cities.items[0].id;

  const routes = await loadText<RoutesData>(lang, `projects/${project}/${cityId}/routes`);
  const routeIds = routes ? Object.keys(routes) : [];
  if (routeIds.length !== 1) {
    return null;
  }
  const routeId = routeIds[0];
  const route = routes![routeId];

  const locationPaths = route.locations.map((id) => `projects/${project}/${cityId}/${id}`);
  const entries = await loadLocations(lang, locationPaths);
  const stopCount = entries.length;

  const coords = entries
    .map((e) => (e as { coordinates?: Coordinates }).coordinates)
    .filter((c): c is Coordinates => !!c);

  const distanceMeters =
    coords.length === entries.length && coords.length > 1
      ? coords.slice(1).reduce((sum, c, i) => sum + haversineMeters(coords[i], c), 0)
      : null;

  return {
    cityId,
    routeId,
    stopCount,
    distanceMeters,
    durationMinutes: stopCount * MINUTES_PER_STOP,
  };
}
