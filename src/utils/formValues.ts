import type { FormField } from "../types/data";

/**
 * Converts a flat record keyed by dotted-path field IDs into a nested object.
 * Fields of type "section" (no id) are skipped.
 *
 * Example:
 *   fields = [{ id: "coordinates.latitude", type: "string", label: "Lat" }]
 *   flat   = { "coordinates.latitude": "52.07" }
 *   result = { coordinates: { latitude: "52.07" } }
 */
export function buildNestedValues(
  fields: FormField[],
  flat: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (!field.id || field.type === "section") {
      // section pseudo-fields collect no value
    } else {
      const value = flat[field.id];
      if (field.id.includes(".")) {
        const parts = field.id.split(".");
        let obj = result;
        for (let i = 0; i < parts.length - 1; i++) {
          if (typeof obj[parts[i]] !== "object" || obj[parts[i]] === null) {
            obj[parts[i]] = {};
          }
          obj = obj[parts[i]] as Record<string, unknown>;
        }
        obj[parts[parts.length - 1]] = value;
      } else {
        result[field.id] = value;
      }
    }
  }
  return result;
}

/**
 * Flattens a nested object into dotted-path keys.
 * Used by EditorLocationForm to convert a loaded location into AppForm initialValues.
 *
 * Example:
 *   nested = { coordinates: { latitude: 52.07, longitude: 4.31 } }
 *   result = { "coordinates.latitude": 52.07, "coordinates.longitude": 4.31 }
 */
export function flattenValues(
  nested: Record<string, unknown>,
  prefix = "",
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(nested)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      Object.assign(
        result,
        flattenValues(value as Record<string, unknown>, fullKey),
      );
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}