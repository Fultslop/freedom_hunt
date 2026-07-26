import type { FormState } from "../types/data";

export function buildFormStorageKey(
  project: string,
  city: string,
  route: string | undefined,
  locationId: number,
): string {
  return `${project}/${city}/${route ?? ""}/${locationId}/form`;
}

const EMPTY_STATE: FormState = {
  values: {},
  uploads: {},
  submitted: false,
  skipped: false,
};

export function loadFormState(key: string): FormState {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return { ...EMPTY_STATE, values: {}, uploads: {} };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<FormState>;
    return {
      values: parsed.values ?? {},
      uploads: parsed.uploads ?? {},
      submitted: parsed.submitted ?? false,
      skipped: parsed.skipped ?? false,
    };
  } catch {
    return { ...EMPTY_STATE, values: {}, uploads: {} };
  }
}

export function saveFormState(key: string, state: FormState): void {
  localStorage.setItem(key, JSON.stringify(state));
}
