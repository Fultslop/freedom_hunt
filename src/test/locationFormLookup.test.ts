import { parseSourceRef, getLocationFormValue } from "../utils/locationFormLookup";
import { buildFormStorageKey, saveFormState } from "../utils/formStorage";

beforeEach(() => {
  localStorage.clear();
});

describe("parseSourceRef", () => {
  it("parses a well-formed reference into locationId, formId, and fieldId", () => {
    expect(parseSourceRef("004_loc_lange_voorhout.form.manifesto")).toEqual({
      locationId: "004_loc_lange_voorhout",
      formId: "form",
      fieldId: "manifesto",
    });
  });

  it("preserves dots inside the fieldId segment (dotted-path field ids)", () => {
    expect(parseSourceRef("004_loc_lange_voorhout.form.coordinates.latitude")).toEqual({
      locationId: "004_loc_lange_voorhout",
      formId: "form",
      fieldId: "coordinates.latitude",
    });
  });

  it("returns null when the '.form.' separator is missing", () => {
    expect(parseSourceRef("004_loc_lange_voorhout.manifesto")).toBeNull();
  });

  it("returns null for a formId other than 'form' (no multi-form support yet)", () => {
    expect(parseSourceRef("004_loc_lange_voorhout.checkin_form.manifesto")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseSourceRef("")).toBeNull();
  });
});

describe("getLocationFormValue", () => {
  it("returns the stored string value for the given location and field", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
    saveFormState(key, {
      values: { manifesto: "We pledge to keep fighting." },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    });
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "manifesto"),
    ).toBe("We pledge to keep fighting.");
  });

  it("returns undefined when the location was never visited", () => {
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "999_loc_never_visited", "manifesto"),
    ).toBeUndefined();
  });

  it("returns undefined when the field was never answered", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
    saveFormState(key, { values: {}, uploads: {}, submitted: false, skipped: false, touchedFields: [] });
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "manifesto"),
    ).toBeUndefined();
  });

  it("returns the raw stored value even when it isn't a string", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
    saveFormState(key, {
      values: { manifesto: 42 },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    });
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "manifesto"),
    ).toBe(42);
  });

  it("returns a boolean value unchanged", () => {
    const key = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
    saveFormState(key, {
      values: { agreed: true },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    });
    expect(
      getLocationFormValue("demo", "den_haag", "short_loop", "004_loc_lange_voorhout", "agreed"),
    ).toBe(true);
  });
});
