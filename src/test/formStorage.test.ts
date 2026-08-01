import { buildFormStorageKey, loadFormState, saveFormState } from "../utils/formStorage";

beforeEach(() => {
  localStorage.clear();
});

test("buildFormStorageKey composes project/team/city/route/locationId", () => {
  expect(buildFormStorageKey("demo", "den_haag", "short_loop", "3", "Team A")).toBe(
    "demo/Team A/den_haag/short_loop/3/form",
  );
});

test("buildFormStorageKey handles an undefined route", () => {
  expect(buildFormStorageKey("demo", "den_haag", undefined, "3", "Team A")).toBe(
    "demo/Team A/den_haag//3/form",
  );
});

test("different team names at the same project/city/route/location get independent form state", () => {
  const keyA = buildFormStorageKey("demo", "den_haag", "short_loop", "1", "Team A");
  const keyB = buildFormStorageKey("demo", "den_haag", "short_loop", "1", "Team B");
  saveFormState(keyA, {
    values: { note: "A's answer" },
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  expect(loadFormState(keyB).values).toEqual({});
  expect(loadFormState(keyA).values).toEqual({ note: "A's answer" });
});

test("the same team name shares form state regardless of contact (team members see each other's answers)", () => {
  // No contact dimension in this key at all — this test exists to document
  // that omission is deliberate, not an oversight. See spec §1.
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1", "Team A");
  saveFormState(key, {
    values: { note: "shared answer" },
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  expect(loadFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "1", "Team A")).values).toEqual({
    note: "shared answer",
  });
});

test("loadFormState returns empty defaults when nothing is stored", () => {
  expect(loadFormState("missing-key")).toEqual({
    values: {},
    uploads: {},
    submitted: false,
    skipped: false,
    touchedFields: [],
  });
});

test("saveFormState then loadFormState round-trips the exact state", () => {
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1", "Team A");
  const state = {
    values: { note: "hello" },
    uploads: { pic: { status: "success" as const, httpCode: 200 } },
    submitted: true,
    skipped: false,
    touchedFields: ["note"],
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
    touchedFields: [],
  });
});

test("saveFormState writes a version envelope that loadFormState reads back transparently", () => {
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1", "Team A");
  saveFormState(key, {
    values: { note: "hi" },
    uploads: {},
    submitted: false,
    skipped: false,
    touchedFields: [],
  });
  const raw = JSON.parse(localStorage.getItem(key)!);
  expect(raw.version).toBe("1.2");
  expect(loadFormState(key)).toEqual({
    values: { note: "hi" },
    uploads: {},
    submitted: false,
    skipped: false,
    touchedFields: [],
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
    touchedFields: [],
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
    touchedFields: [],
  });
});

test("saveFormState then loadFormState round-trips submittedAt when present", () => {
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1", "Team A");
  const state = {
    values: {},
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
    submittedAt: 1690000000000,
  };
  saveFormState(key, state);
  expect(loadFormState(key)).toEqual(state);
});

test("loadFormState reads a pre-submittedAt payload (version 1.1) with submittedAt undefined", () => {
  const key = "pre-submittedat-key";
  localStorage.setItem(
    key,
    JSON.stringify({
      version: "1.1",
      values: {},
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    }),
  );
  expect(loadFormState(key).submittedAt).toBeUndefined();
});

test("loadFormState reads a minor-version-only payload (pre-touchedFields shape) with touchedFields defaulting to empty", () => {
  const key = "spec1-key";
  localStorage.setItem(
    key,
    JSON.stringify({
      version: "1.0",
      values: { note: "kept" },
      uploads: {},
      submitted: true,
      skipped: false,
    }),
  );
  expect(loadFormState(key)).toEqual({
    values: { note: "kept" },
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
});
