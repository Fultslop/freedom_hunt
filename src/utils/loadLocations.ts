import { loadText } from "./loadText";
import { findStatsRefs } from "./storylineBlocks";
import type {
  RouteEntry,
  LocationEntry,
  FormField,
  RawChallenge,
  FormFieldType,
} from "../types/data";
import type { StatsDoc } from "../types/storyline";

type RawLocationEntry = Omit<LocationEntry, "challenge"> & { challenge: RawChallenge };
type RawRouteEntry = RawLocationEntry | Exclude<RouteEntry, LocationEntry>;

const KNOWN_FORM_FIELD_KEYS = new Set([
  "id",
  "type",
  "label",
  "subtext",
  "options",
  "min",
  "max",
  "isRequired",
]);

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

async function resolveForm(
  lang: string,
  challenge: RawChallenge,
  dir: string,
): Promise<FormField[] | undefined> {
  if (typeof challenge.form === "string") {
    const formPath = dir + challenge.form.replace(/\.yaml$/, "");
    return withValidatedFields(
      (await loadText<FormField[]>(lang, formPath)) ?? [],
    );
  }
  if (Array.isArray(challenge.form)) {
    return [
      {
        id: "form",
        type: "inline_form" as FormFieldType,
        label: "challenge.form inline array — migrate to a *_form_*.yaml file",
      },
    ];
  }
  return undefined;
}

async function resolveStorylineElements(
  lang: string,
  storyline: string,
  dir: string,
): Promise<Record<string, StatsDoc> | undefined> {
  const refs = findStatsRefs(storyline);
  if (refs.length === 0) {
    return undefined;
  }
  const entries = await Promise.all(
    refs.map(async (ref) => {
      const doc = await loadText<StatsDoc>(lang, dir + ref.replace(/\.yaml$/, ""));
      return [ref, doc] as const;
    }),
  );
  const resolved = Object.fromEntries(
    entries.filter((entry): entry is [string, StatsDoc] => entry[1] !== null),
  );
  return Object.keys(resolved).length > 0 ? resolved : undefined;
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
  const dir = path.substring(0, path.lastIndexOf("/") + 1);

  let resolvedForm: FormField[] | undefined;
  if (rawLocation.challenge?.form) {
    resolvedForm = await resolveForm(lang, rawLocation.challenge, dir);
  }

  let storylineElements: Record<string, StatsDoc> | undefined;
  if (rawLocation.storyline) {
    storylineElements = await resolveStorylineElements(lang, rawLocation.storyline, dir);
  }

  const withResolvedForm =
    resolvedForm !== undefined
      ? { ...rawLocation, challenge: { ...rawLocation.challenge, form: resolvedForm } }
      : rawLocation;

  return (
    storylineElements !== undefined
      ? { ...withResolvedForm, storylineElements }
      : withResolvedForm
  ) as RouteEntry;
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
