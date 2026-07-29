import { buildFormStorageKey, loadFormState } from "./formStorage";

export function parseSourceRef(source: string): { locationId: string; fieldId: string } | null {
  const match = /^(.+)\.form\.(.+)$/.exec(source);
  return match ? { locationId: match[1], fieldId: match[2] } : null;
}

export function getLocationFormValue(
  project: string,
  city: string,
  route: string | undefined,
  locationId: string,
  fieldId: string,
): string | undefined {
  const key = buildFormStorageKey(project, city, route, locationId);
  const value = loadFormState(key).values[fieldId];
  return typeof value === "string" ? value : undefined;
}
