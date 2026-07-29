import type { FormState } from "../types/data";

export function buildFormStorageKey(
  project: string,
  city: string,
  route: string | undefined,
  locationId: string,
): string {
  return `${project}/${city}/${route ?? ""}/${locationId}/form`;
}

// "major.minor" for the shape persisted by saveFormState/loadFormState — independent
// of package.json's app version (see CLAUDE.md). Bump the MAJOR segment whenever a
// change to FormState (or this envelope) would make an old payload unsafe to read
// as-is (e.g. a field is removed, renamed, or reinterpreted) — loadFormState then
// discards mismatched-major data instead of misreading it. Bump only the MINOR
// segment for additive, backward-compatible changes (e.g. a new optional field that
// defaults sensibly when absent) — old data stays readable.
const STORAGE_VERSION = "1.1";

function majorVersion(version: string): string {
  return version.split(".")[0];
}

const EMPTY_STATE: FormState = {
  values: {},
  uploads: {},
  submitted: false,
  skipped: false,
  touchedFields: [],
};

export function loadFormState(key: string): FormState {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return { ...EMPTY_STATE, values: {}, uploads: {} };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<FormState> & { version?: string };
    if (majorVersion(parsed.version ?? "0.0") !== majorVersion(STORAGE_VERSION)) {
      return { ...EMPTY_STATE, values: {}, uploads: {} };
    }
    return {
      values: parsed.values ?? {},
      uploads: parsed.uploads ?? {},
      submitted: parsed.submitted ?? false,
      skipped: parsed.skipped ?? false,
      touchedFields: parsed.touchedFields ?? [],
    };
  } catch {
    return { ...EMPTY_STATE, values: {}, uploads: {} };
  }
}

export function saveFormState(key: string, state: FormState): void {
  localStorage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, ...state }));
}
