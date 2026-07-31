import { getHuntSettings } from "../utils/huntSettings";

test("defaults to store_forms_in_local_storage and allow_resubmit true, others false, when meta is null", () => {
  expect(getHuntSettings(null)).toEqual({
    storeFormsInLocalStorage: true,
    formRequired: false,
    canFormsSkip: false,
    allowResubmit: true,
    ageThreshold: 16,
  });
});

test("defaults to the same values when meta is an empty object", () => {
  expect(getHuntSettings({})).toEqual({
    storeFormsInLocalStorage: true,
    formRequired: false,
    canFormsSkip: false,
    allowResubmit: true,
    ageThreshold: 16,
  });
});

test("honors explicit true/false overrides", () => {
  expect(
    getHuntSettings({
      "project.store_forms_in_local_storage": false,
      "project.form_required": true,
      "project.can_forms_skip": true,
      "project.allow_resubmit": false,
    }),
  ).toEqual({
    storeFormsInLocalStorage: false,
    formRequired: true,
    canFormsSkip: true,
    allowResubmit: false,
    ageThreshold: 16,
  });
});

test("ageThreshold defaults to 16 when project.consent_age_threshold is absent", () => {
  const settings = getHuntSettings({});
  expect(settings.ageThreshold).toBe(16);
});

test("ageThreshold reads project.consent_age_threshold when present", () => {
  const settings = getHuntSettings({ "project.consent_age_threshold": 15 });
  expect(settings.ageThreshold).toBe(15);
});
