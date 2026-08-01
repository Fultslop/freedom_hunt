import { getHuntSettings } from "../utils/huntSettings";

test("defaults to store_forms_in_local_storage and allow_resubmit true, others false, when meta is null", () => {
  expect(getHuntSettings(null)).toEqual({
    storeFormsInLocalStorage: true,
    formRequired: false,
    canFormsSkip: false,
    allowResubmit: true,
  });
});

test("defaults to the same values when meta is an empty object", () => {
  expect(getHuntSettings({})).toEqual({
    storeFormsInLocalStorage: true,
    formRequired: false,
    canFormsSkip: false,
    allowResubmit: true,
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
  });
});
