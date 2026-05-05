import { loadText } from "./loadText";
import type { Location } from "../types/data";

export async function loadLocations(
  lang: string,
  paths: string[],
): Promise<Location[]> {
  if (paths.length === 0) {
    return [];
  }
  const results = await Promise.all(
    paths.map((path) => loadText<Location>(lang, path)),
  );
  return results.filter((loc): loc is Location => loc !== null);
}
