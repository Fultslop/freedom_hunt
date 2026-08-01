import type { HuntSettings, ProjectMeta } from "../types/data";

export function getHuntSettings(meta: ProjectMeta | null): HuntSettings {
  return {
    storeFormsInLocalStorage: meta?.["project.store_forms_in_local_storage"] !== false,
    formRequired: meta?.["project.form_required"] === true,
    canFormsSkip: meta?.["project.can_forms_skip"] === true,
    allowResubmit: meta?.["project.allow_resubmit"] !== false,
  };
}
