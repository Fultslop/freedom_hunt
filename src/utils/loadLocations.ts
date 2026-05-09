import { loadText } from "./loadText";
import type { Location, FormField, RawChallenge } from "../types/data";

type RawLocation = Omit<Location, "challenge"> & { challenge: RawChallenge };

async function loadAndResolveLocation(
  lang: string,
  path: string,
): Promise<Location | null> {
  const raw = await loadText<RawLocation>(lang, path);
  if (!raw) {
    return null;
  }

  if (raw.challenge && typeof raw.challenge.form === "string") {
    const formFileName = raw.challenge.form;
    const dir = path.substring(0, path.lastIndexOf("/") + 1);
    const formPath = dir + formFileName.replace(/\.yaml$/, "");
    raw.challenge.form = (await loadText<FormField[]>(lang, formPath)) ?? [];
  }

  return raw as Location;
}

export async function loadLocations(
  lang: string,
  paths: string[],
): Promise<Location[]> {
  if (paths.length === 0) {
    return [];
  }
  const results = await Promise.all(
    paths.map((path) => loadAndResolveLocation(lang, path)),
  );
  return results.filter((loc): loc is Location => loc !== null);
}
