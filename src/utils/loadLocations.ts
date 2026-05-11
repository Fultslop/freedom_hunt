import { loadText } from "./loadText";
import type { Location, FormField, RawChallenge, FormFieldType } from "../types/data";

type RawLocation = Omit<Location, "challenge"> & { challenge: RawChallenge };

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
): Promise<Location | null> {
  const raw = await loadText<RawLocation>(lang, path);
  if (!raw) {
    return null;
  }

  if (raw.challenge && typeof raw.challenge.form === "string") {
    const formFileName = raw.challenge.form;
    const dir = path.substring(0, path.lastIndexOf("/") + 1);
    const formPath = dir + formFileName.replace(/\.yaml$/, "");
    raw.challenge.form = withValidatedFields(
      (await loadText<FormField[]>(lang, formPath)) ?? [],
    );
  } else if (raw.challenge && Array.isArray(raw.challenge.form)) {
    raw.challenge.form = [
      {
        id: "form",
        type: "inline_form" as FormFieldType,
        label: "challenge.form inline array — migrate to a *_form_*.yaml file",
      },
    ];
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
