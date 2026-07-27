import { loadText } from "./loadText";
import type {
  RouteEntry,
  LocationEntry,
  FormField,
  RawChallenge,
  FormFieldType,
} from "../types/data";

type RawLocationEntry = Omit<LocationEntry, "challenge"> & { challenge: RawChallenge };
type RawRouteEntry = RawLocationEntry | Exclude<RouteEntry, LocationEntry>;

const KNOWN_FORM_FIELD_KEYS = new Set(["id", "type", "label", "options", "min", "max"]);

function withValidatedFields(fields: FormField[]): FormField[] {
  return fields.map((field) => {
    const unknownKeys = Object.keys(field as unknown as Record<string, unknown>).filter(
      (key) => !KNOWN_FORM_FIELD_KEYS.has(key),
    );
    if (unknownKeys.length === 0) {
      return field;
    }
    const fieldId = field.id ?? field.label;
    return {
      id: fieldId,
      type: "schema_error" as FormFieldType,
      label: `unknown properties on '${fieldId}': ${unknownKeys.join(", ")}`,
    };
  });
}

async function loadAndResolveLocation(
  lang: string,
  path: string,
): Promise<RouteEntry | null> {
  const raw = await loadText<RawRouteEntry>(lang, path);
  if (!raw) {
    return null;
  }

  const templateType = raw["template-type"] ?? "location";
  if (templateType !== "location") {
    return raw as RouteEntry;
  }

  const rawLocation = raw as RawLocationEntry;
  let resolvedForm: FormField[] | undefined;

  if (rawLocation.challenge && typeof rawLocation.challenge.form === "string") {
    const formFileName = rawLocation.challenge.form;
    const dir = path.substring(0, path.lastIndexOf("/") + 1);
    const formPath = dir + formFileName.replace(/\.yaml$/, "");
    resolvedForm = withValidatedFields(
      (await loadText<FormField[]>(lang, formPath)) ?? [],
    );
  } else if (rawLocation.challenge && Array.isArray(rawLocation.challenge.form)) {
    resolvedForm = [
      {
        id: "form",
        type: "inline_form" as FormFieldType,
        label: "challenge.form inline array — migrate to a *_form_*.yaml file",
      },
    ];
  }

  if (resolvedForm !== undefined) {
    return {
      ...rawLocation,
      challenge: { ...rawLocation.challenge, form: resolvedForm },
    } as RouteEntry;
  }

  return rawLocation as RouteEntry;
}

export async function loadLocations(
  lang: string,
  paths: string[],
): Promise<RouteEntry[]> {
  if (paths.length === 0) {
    return [];
  }
  const results = await Promise.all(
    paths.map((path) => loadAndResolveLocation(lang, path)),
  );
  return results.filter((entry): entry is RouteEntry => entry !== null);
}
