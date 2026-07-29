import { describe, it, expect } from "vitest";
import {
  teamsForRoute,
  submissionsForCell,
  latestOf,
  earliestOf,
  buildRouteGrid,
  completionCount,
  buildLocationReport,
  visibleFields,
  formatAnswerValue,
  type RouteLocationEntry,
} from "../utils/resultsData";
import type { ResultsSubmission } from "../types/results";
import type { FormField } from "../types/data";

function makeSubmission(overrides: Partial<ResultsSubmission>): ResultsSubmission {
  return {
    id: "s1", locationId: "1", routeId: "riverside_route", teamName: "Team A",
    answers: {}, submittedAt: 100, ...overrides,
  };
}

const ENTRY: RouteLocationEntry = {
  ordinal: 1,
  locationId: "1",
  name: "Eiffel Tower",
  fields: [
    { id: "found", type: "boolean", label: "Did you find it?" },
    { id: "notes", type: "string", label: "Any notes?" },
  ],
};

describe("teamsForRoute", () => {
  it("returns distinct, sorted team names for the given route only", () => {
    const submissions = [
      makeSubmission({ teamName: "Team B", routeId: "riverside_route" }),
      makeSubmission({ teamName: "Team A", routeId: "riverside_route" }),
      makeSubmission({ teamName: "Team A", routeId: "riverside_route" }),
      makeSubmission({ teamName: "Team C", routeId: "left_bank_route" }),
    ];
    expect(teamsForRoute(submissions, "riverside_route")).toEqual(["Team A", "Team B"]);
  });
});

describe("submissionsForCell", () => {
  it("matches on routeId, locationId, and teamName together", () => {
    const submissions = [
      makeSubmission({ id: "s1", routeId: "riverside_route", locationId: "1", teamName: "Team A" }),
      makeSubmission({ id: "s2", routeId: "left_bank_route", locationId: "1", teamName: "Team A" }),
      makeSubmission({ id: "s3", routeId: "riverside_route", locationId: "2", teamName: "Team A" }),
      makeSubmission({ id: "s4", routeId: "riverside_route", locationId: "1", teamName: "Team B" }),
    ];
    const result = submissionsForCell(submissions, "riverside_route", "1", "Team A");
    expect(result.map((sub) => sub.id)).toEqual(["s1"]);
  });
});

describe("latestOf / earliestOf", () => {
  const subs = [
    makeSubmission({ id: "s1", submittedAt: 200 }),
    makeSubmission({ id: "s2", submittedAt: 100 }),
    makeSubmission({ id: "s3", submittedAt: 300 }),
  ];

  it("latestOf returns the submission with the greatest submittedAt", () => {
    expect(latestOf(subs)?.id).toBe("s3");
  });

  it("earliestOf returns the submission with the smallest submittedAt", () => {
    expect(earliestOf(subs)?.id).toBe("s2");
  });

  it("both return undefined for an empty array", () => {
    expect(latestOf([])).toBeUndefined();
    expect(earliestOf([])).toBeUndefined();
  });
});

describe("buildRouteGrid", () => {
  it("cross-products teams x entries, with dash-equivalent undefined for missing cells", () => {
    const submissions = [makeSubmission({ teamName: "Team A", locationId: "1" })];
    const rows = buildRouteGrid([ENTRY], ["Team A", "Team B"], submissions, "riverside_route");
    expect(rows).toHaveLength(2);
    const rowA = rows.find((row) => row.teamName === "Team A");
    const rowB = rows.find((row) => row.teamName === "Team B");
    expect(rowA?.submission?.teamName).toBe("Team A");
    expect(rowB?.submission).toBeUndefined();
  });

  it("uses the latest submission and reports the submission count for a resubmitted cell", () => {
    const submissions = [
      makeSubmission({ id: "s1", teamName: "Team A", locationId: "1", submittedAt: 100 }),
      makeSubmission({ id: "s2", teamName: "Team A", locationId: "1", submittedAt: 200 }),
    ];
    const rows = buildRouteGrid([ENTRY], ["Team A"], submissions, "riverside_route");
    expect(rows[0].submission?.id).toBe("s2");
    expect(rows[0].submissionCount).toBe(2);
  });
});

describe("completionCount", () => {
  it("counts teams with at least one submission against the route's total team count", () => {
    const submissions = [makeSubmission({ teamName: "Team A", locationId: "1" })];
    const result = completionCount(ENTRY, ["Team A", "Team B", "Team C"], submissions, "riverside_route");
    expect(result).toEqual({ answered: 1, total: 3 });
  });
});

describe("buildLocationReport", () => {
  it("includes only teams with a submission, ordered by their earliest submission at that location", () => {
    const submissions = [
      makeSubmission({ id: "s1", teamName: "Team A", locationId: "1", submittedAt: 500 }),
      makeSubmission({ id: "s2", teamName: "Team B", locationId: "1", submittedAt: 100 }),
    ];
    const report = buildLocationReport(ENTRY, ["Team A", "Team B", "Team C"], submissions, "riverside_route");
    expect(report.map((row) => row.teamName)).toEqual(["Team B", "Team A"]);
  });

  it("orders by a team's earliest submission even if their latest answer came later", () => {
    const submissions = [
      makeSubmission({ id: "s1", teamName: "Team A", locationId: "1", submittedAt: 50 }),
      makeSubmission({ id: "s2", teamName: "Team A", locationId: "1", submittedAt: 900 }),
      makeSubmission({ id: "s3", teamName: "Team B", locationId: "1", submittedAt: 400 }),
    ];
    const report = buildLocationReport(ENTRY, ["Team A", "Team B"], submissions, "riverside_route");
    expect(report.map((row) => row.teamName)).toEqual(["Team A", "Team B"]);
    expect(report[0].submission.id).toBe("s2");
  });
});

describe("visibleFields", () => {
  it("drops section and photo fields, keeps everything else", () => {
    const fields: FormField[] = [
      { type: "section", label: "Heading" },
      { id: "photo", type: "photo", label: "Upload" },
      { id: "found", type: "boolean", label: "Found it?" },
    ];
    expect(visibleFields(fields).map((field) => field.id)).toEqual(["found"]);
  });
});

describe("formatAnswerValue", () => {
  const boolField: FormField = { id: "found", type: "boolean", label: "Found it?" };
  const multipleField: FormField = { id: "cats", type: "multiple", label: "Categories", options: [] };

  it("renders boolean true/false as Yes/No", () => {
    expect(formatAnswerValue(boolField, true)).toBe("Yes");
    expect(formatAnswerValue(boolField, false)).toBe("No");
  });

  it("joins multiple-select array values with commas", () => {
    expect(formatAnswerValue(multipleField, ["Race", "History"])).toBe("Race, History");
  });

  it("returns 'No answer' for an empty multi-select array", () => {
    expect(formatAnswerValue(multipleField, [])).toBe("No answer");
  });

  it("returns 'No answer' for undefined, null, or empty string", () => {
    const strField: FormField = { id: "notes", type: "string", label: "Notes" };
    expect(formatAnswerValue(strField, undefined)).toBe("No answer");
    expect(formatAnswerValue(strField, null)).toBe("No answer");
    expect(formatAnswerValue(strField, "")).toBe("No answer");
  });

  it("stringifies other values as-is", () => {
    const numField: FormField = { id: "count", type: "number", label: "Count" };
    expect(formatAnswerValue(numField, 42)).toBe("42");
  });
});
