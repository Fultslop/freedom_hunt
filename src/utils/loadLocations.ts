import { loadText } from "./loadText";
import { findStatsRefs } from "./storylineBlocks";
import { parseSourceRef } from "./locationFormLookup";
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
  "values",
  "min",
  "max",
  "isRequired",
  "value",
  "storeDefaultValue",
  "config",
  "source",
  "reroll",
  "editable",
]);

const VALUE_SUPPORTED_TYPES = new Set<FormFieldType>([
  "string",
  "textarea",
  "number",
  "boolean",
  "radio",
  "multiple",
]);

const VALUE_SHAPE_CHECKS: Record<string, (value: unknown, options: string[]) => boolean> = {
  string: (value) => typeof value === "string",
  textarea: (value) => typeof value === "string",
  number: (value) => typeof value === "number",
  boolean: (value) => typeof value === "boolean",
  radio: (value, options) => typeof value === "string" && options.includes(value),
  multiple: (value, options) =>
    Array.isArray(value) && value.every((v) => typeof v === "string" && options.includes(v)),
};

const VALUE_SHAPE_MESSAGES: Record<string, string> = {
  string: "'value' must be a string for type 'string'",
  textarea: "'value' must be a string for type 'textarea'",
  number: "'value' must be a number for type 'number'",
  boolean: "'value' must be a boolean for type 'boolean'",
  radio: "'value' must be one of this field's 'options'",
  multiple: "'value' must be an array of this field's 'options'",
};

function getValueShapeError(field: FormField): string | null {
  const isValidShape = VALUE_SHAPE_CHECKS[field.type](field.value, field.options ?? []);
  return isValidShape ? null : VALUE_SHAPE_MESSAGES[field.type];
}

const CONFIG_SUPPORTED_TYPES = new Set<FormFieldType>(["textarea"]);
const KNOWN_CONFIG_KEYS = new Set(["lineCount"]);

function validateFieldConfig(field: FormField): string | null {
  if (field.config === undefined) {
    return null;
  }
  if (!CONFIG_SUPPORTED_TYPES.has(field.type)) {
    return `'config' not supported on type '${field.type}'`;
  }
  const unknownConfigKeys = Object.keys(field.config).filter(
    (key) => !KNOWN_CONFIG_KEYS.has(key),
  );
  if (unknownConfigKeys.length > 0) {
    return `unknown config properties: ${unknownConfigKeys.join(", ")}`;
  }
  const { lineCount } = field.config;
  if (lineCount !== undefined && !(Number.isInteger(lineCount) && lineCount > 0)) {
    return `'config.lineCount' must be a positive integer`;
  }
  return null;
}

const SOURCE_SUPPORTED_TYPES = new Set<FormFieldType>(["textarea"]);

function validateFieldSource(field: FormField): string | null {
  if (field.source === undefined) {
    return null;
  }
  if (!SOURCE_SUPPORTED_TYPES.has(field.type)) {
    return `'source' not supported on type '${field.type}'`;
  }
  if (!parseSourceRef(field.source)) {
    return `'source' must match '<location_id>.form.<field_id>'`;
  }
  return null;
}

function validateFieldValue(field: FormField): string | null {
  const hasValue = Object.prototype.hasOwnProperty.call(field, "value");
  const hasStoreDefaultValue = Object.prototype.hasOwnProperty.call(
    field,
    "storeDefaultValue",
  );
  if (!hasValue && !hasStoreDefaultValue) {
    return null;
  }
  if (!VALUE_SUPPORTED_TYPES.has(field.type)) {
    return `'value'/'storeDefaultValue' not supported on type '${field.type}'`;
  }
  if (hasStoreDefaultValue && typeof field.storeDefaultValue !== "boolean") {
    return `'storeDefaultValue' must be a boolean`;
  }
  return hasValue ? getValueShapeError(field) : null;
}

function buildFieldErrorMessages(
  fieldId: string,
  unknownKeys: string[],
  valueError: string | null,
  configError: string | null,
  sourceError: string | null,
): string[] {
  return [
    ...(unknownKeys.length > 0
      ? [`unknown properties on '${fieldId}': ${unknownKeys.join(", ")}`]
      : []),
    ...(valueError ? [valueError] : []),
    ...(configError ? [configError] : []),
    ...(sourceError ? [sourceError] : []),
  ];
}

function withValidatedFields(fields: FormField[]): FormField[] {
  return fields.map((field) => {
    const unknownKeys = Object.keys(field as unknown as Record<string, unknown>).filter(
      (key) => !KNOWN_FORM_FIELD_KEYS.has(key),
    );
    const valueError = validateFieldValue(field);
    const configError = validateFieldConfig(field);
    const sourceError = validateFieldSource(field);
    if (unknownKeys.length === 0 && !valueError && !configError && !sourceError) {
      return field;
    }
    const fieldId = field.id ?? field.label;
    return {
      id: fieldId,
      type: "schema_error" as FormFieldType,
      label: buildFieldErrorMessages(fieldId, unknownKeys, valueError, configError, sourceError).join("; "),
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
