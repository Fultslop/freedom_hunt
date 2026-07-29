import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import ResultsLocationReports from "../components/ResultsLocationReports.svelte";
import type { ResultsSubmission } from "../types/results";
import type { RouteLocationEntry } from "../utils/resultsData";

const ENTRIES: RouteLocationEntry[] = [
  { ordinal: 1, locationId: "1", name: "Eiffel Tower", fields: [{ id: "found", type: "boolean", label: "Found it?" }] },
];

const SUBMISSIONS: ResultsSubmission[] = [
  {
    id: "s1", locationId: "1", routeId: "riverside_route", teamName: "Team A",
    answers: { found: true }, submittedAt: 100,
  },
];

test("shows a completion count in the collapsed header", () => {
  render(ResultsLocationReports, {
    props: { routeId: "riverside_route", entries: ENTRIES, teams: ["Team A", "Team B"], submissions: SUBMISSIONS },
  });
  expect(screen.getByText(/1\s*\/\s*2 teams answered/i)).toBeInTheDocument();
});

test("expanding a location renders each answering team's Q&A inline", async () => {
  render(ResultsLocationReports, {
    props: { routeId: "riverside_route", entries: ENTRIES, teams: ["Team A"], submissions: SUBMISSIONS },
  });
  await fireEvent.click(screen.getByText(/Location 1 — Eiffel Tower/i));
  expect(screen.getByText("Team A")).toBeInTheDocument();
  expect(screen.getByText("Found it?")).toBeInTheDocument();
  expect(screen.getByText("Yes")).toBeInTheDocument();
});

test("a team with no submission at that location does not appear when expanded", async () => {
  render(ResultsLocationReports, {
    props: { routeId: "riverside_route", entries: ENTRIES, teams: ["Team A", "Team B"], submissions: SUBMISSIONS },
  });
  await fireEvent.click(screen.getByText(/Location 1 — Eiffel Tower/i));
  expect(screen.queryByText("Team B")).not.toBeInTheDocument();
});
