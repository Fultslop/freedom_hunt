import { buildFormStorageKey, saveFormState } from "../utils/formStorage";
import {
  computePhotosTaken,
  computeElapsedSinceFirstSubmission,
  formatElapsed,
} from "../utils/completionStats";

beforeEach(() => {
  localStorage.clear();
});

test("computePhotosTaken sums successful uploads across every location", () => {
  saveFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "001", "Team A"), {
    values: {},
    uploads: {
      pic: { status: "success", httpCode: 200 },
      pic2: { status: "error", httpCode: 500 },
    },
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  saveFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "002", "Team A"), {
    values: {},
    uploads: { pic: { status: "success", httpCode: 200 } },
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  expect(computePhotosTaken("demo", "den_haag", "short_loop", ["001", "002"], "Team A")).toBe(2);
});

test("computePhotosTaken returns 0 when no location has ever been visited", () => {
  expect(computePhotosTaken("demo", "den_haag", "short_loop", ["001", "002"], "Team A")).toBe(0);
});

test("computePhotosTaken does not count another team's uploads at the same locations", () => {
  saveFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "001", "Team A"), {
    values: {},
    uploads: { pic: { status: "success", httpCode: 200 } },
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  expect(computePhotosTaken("demo", "den_haag", "short_loop", ["001"], "Team B")).toBe(0);
});

test("computeElapsedSinceFirstSubmission returns now minus the earliest submittedAt across all locations", () => {
  saveFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "001", "Team A"), {
    values: {},
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
    submittedAt: 1_000,
  });
  saveFormState(buildFormStorageKey("demo", "den_haag", "short_loop", "002", "Team A"), {
    values: {},
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
    submittedAt: 5_000,
  });
  expect(
    computeElapsedSinceFirstSubmission("demo", "den_haag", "short_loop", ["001", "002"], 10_000, "Team A"),
  ).toBe(9_000);
});

test("computeElapsedSinceFirstSubmission returns undefined when nothing was ever submitted", () => {
  expect(
    computeElapsedSinceFirstSubmission("demo", "den_haag", "short_loop", ["001", "002"], 10_000, "Team A"),
  ).toBeUndefined();
});

test("formatElapsed renders minutes only under an hour", () => {
  expect(formatElapsed(45 * 60_000)).toBe("45m");
});

test("formatElapsed renders hours and minutes over an hour", () => {
  expect(formatElapsed((2 * 60 + 18) * 60_000)).toBe("2h 18m");
});

test("formatElapsed rounds to the nearest minute", () => {
  expect(formatElapsed(90_000)).toBe("2m");
});
