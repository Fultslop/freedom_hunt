import { describe, it, expect } from "vitest";
import { buildResultsMarkdown } from "../utils/resultsMarkdown";
import type { RouteIndex } from "../utils/resultsData";
import type { ResultsSubmission } from "../types/results";

const ROUTE_INDEX: RouteIndex = {
  riverside_route: [
    {
      ordinal: 1,
      name: "Eiffel Tower",
      fields: [{ id: "found", type: "boolean", label: "Found it?" }],
    },
  ],
};

function makeSubmission(overrides: Partial<ResultsSubmission>): ResultsSubmission {
  return {
    id: "s1", locationId: "1", routeId: "riverside_route", teamName: "Team A",
    answers: { found: true }, submittedAt: 1735300000, ...overrides,
  };
}

describe("buildResultsMarkdown", () => {
  it("includes a title line built from project and city", () => {
    const doc = buildResultsMarkdown("demo", "paris", ROUTE_INDEX, []);
    expect(doc).toContain("demo / paris Results");
    expect(doc).toContain("=====");
  });

  it("lists every team across all routes, alphabetically, under Teams", () => {
    const submissions = [
      makeSubmission({ teamName: "Team B" }),
      makeSubmission({ teamName: "Team A" }),
    ];
    const doc = buildResultsMarkdown("demo", "paris", ROUTE_INDEX, submissions);
    const teamsSection = doc.split("## Teams")[1].split("## Answers")[0];
    expect(teamsSection.indexOf("Team A")).toBeLessThan(teamsSection.indexOf("Team B"));
  });

  it("groups Answers by route, then by location, with fastest team first", () => {
    const submissions = [
      makeSubmission({ id: "s1", teamName: "Team A", submittedAt: 500 }),
      makeSubmission({ id: "s2", teamName: "Team B", submittedAt: 100 }),
    ];
    const doc = buildResultsMarkdown("demo", "paris", ROUTE_INDEX, submissions);
    expect(doc).toContain("### Route: riverside route");
    expect(doc).toContain("#### Location 1 — Eiffel Tower");
    expect(doc.indexOf("*Team*: Team B")).toBeLessThan(doc.indexOf("*Team*: Team A"));
  });

  it("renders each visible field as a Question/Answer pair", () => {
    const doc = buildResultsMarkdown("demo", "paris", ROUTE_INDEX, [makeSubmission({})]);
    expect(doc).toContain("Question: Found it?");
    expect(doc).toContain("Answer: Yes");
  });

  it("omits teams with no submission at a location entirely", () => {
    const doc = buildResultsMarkdown("demo", "paris", ROUTE_INDEX, [
      makeSubmission({ teamName: "Team A" }),
    ]);
    expect(doc).not.toContain("Team B");
  });
});
