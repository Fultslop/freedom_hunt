import { buildFormStorageKey, loadFormState, saveFormState } from "../utils/formStorage";

beforeEach(() => {
  localStorage.clear();
});

test("buildFormStorageKey composes project/city/route/locationId", () => {
  expect(buildFormStorageKey("demo", "den_haag", "short_loop", "3")).toBe(
    "demo/den_haag/short_loop/3/form",
  );
});

test("buildFormStorageKey handles an undefined route", () => {
  expect(buildFormStorageKey("demo", "den_haag", undefined, "3")).toBe(
    "demo/den_haag//3/form",
  );
});

test("loadFormState returns empty defaults when nothing is stored", () => {
  expect(loadFormState("missing-key")).toEqual({
    values: {},
    uploads: {},
    submitted: false,
    skipped: false,
  });
});

test("saveFormState then loadFormState round-trips the exact state", () => {
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1");
  const state = {
    values: { note: "hello" },
    uploads: { pic: { status: "success" as const, httpCode: 200 } },
    submitted: true,
    skipped: false,
  };
  saveFormState(key, state);
  expect(loadFormState(key)).toEqual(state);
});

test("loadFormState falls back to defaults on malformed JSON", () => {
  const key = "corrupt-key";
  localStorage.setItem(key, "{not json");
  expect(loadFormState(key)).toEqual({
    values: {},
    uploads: {},
    submitted: false,
    skipped: false,
  });
});

test("saveFormState writes a version envelope that loadFormState reads back transparently", () => {
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1");
  saveFormState(key, { values: { note: "hi" }, uploads: {}, submitted: false, skipped: false });
  const raw = JSON.parse(localStorage.getItem(key)!);
  expect(raw.version).toBe("1.0");
  expect(loadFormState(key)).toEqual({
    values: { note: "hi" },
    uploads: {},
    submitted: false,
    skipped: false,
  });
});

test("loadFormState treats a pre-versioning payload (no version field) as empty", () => {
  const key = "legacy-key";
  localStorage.setItem(
    key,
    JSON.stringify({ values: { note: "old" }, uploads: {}, submitted: true, skipped: false }),
  );
  expect(loadFormState(key)).toEqual({
    values: {},
    uploads: {},
    submitted: false,
    skipped: false,
  });
});

test("loadFormState treats a major-version mismatch as empty", () => {
  const key = "future-key";
  localStorage.setItem(
    key,
    JSON.stringify({
      version: "2.0",
      values: { note: "future" },
      uploads: {},
      submitted: true,
      skipped: false,
    }),
  );
  expect(loadFormState(key)).toEqual({
    values: {},
    uploads: {},
    submitted: false,
    skipped: false,
  });
});
