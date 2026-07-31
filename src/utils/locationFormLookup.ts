import { buildFormStorageKey, loadFormState } from "./formStorage";

export function parseSourceRef(
  source: string,
): { locationId: string; formId: string; fieldId: string } | null {
  // locationId/formId can't contain dots (both are single path segments);
  // fieldId can (e.g. "coordinates.latitude"), so it stays greedy and last.
  const match = /^([^.]+)\.([^.]+)\.(.+)$/.exec(source);
  if (!match) {
    return null;
  }
  const [, locationId, formId, fieldId] = match;
  // Every location has exactly one form today, always named "form" — formId is
  // captured now so this reference format doesn't need to change again once a
  // location can have multiple named forms; only this check and
  // getLocationFormValue's lookup would need to grow at that point.
  return formId === "form" ? { locationId, formId, fieldId } : null;
}

export function getLocationFormValue(
  project: string,
  city: string,
  route: string | undefined,
  locationId: string,
  fieldId: string,
): unknown {
  const key = buildFormStorageKey(project, city, route, locationId);
  return loadFormState(key).values[fieldId];
}
