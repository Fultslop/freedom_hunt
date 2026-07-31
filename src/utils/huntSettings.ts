import type { HuntSettings, ProjectMeta } from "../types/data";

const DEFAULT_AGE_THRESHOLD = 16;

export function getHuntSettings(meta: ProjectMeta | null): HuntSettings {
  return {
    storeFormsInLocalStorage: meta?.["project.store_forms_in_local_storage"] !== false,
    formRequired: meta?.["project.form_required"] === true,
    canFormsSkip: meta?.["project.can_forms_skip"] === true,
    allowResubmit: meta?.["project.allow_resubmit"] !== false,
    ageThreshold:
      typeof meta?.["project.consent_age_threshold"] === "number"
        ? (meta["project.consent_age_threshold"] as number)
        : DEFAULT_AGE_THRESHOLD,
  };
}
