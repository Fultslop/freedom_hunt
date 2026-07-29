import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import ResultsTable from "../components/ResultsTable.svelte";
import type { ResultsSubmission } from "../types/results";
import type { RouteLocationEntry } from "../utils/resultsData";

const ENTRIES: RouteLocationEntry[] = [
  { ordinal: 1, locationId: "1", name: "Eiffel Tower", fields: [{ id: "found", type: "boolean", label: "Found?" }] },
];

const SUBMISSIONS: ResultsSubmission[] = [
  {
    id: "s1", locationId: "1", routeId: "riverside_route", teamName: "Team A",
    answers: { found: true }, submittedAt: 100,
  },
];

test("renders a View button when a submission exists and a dash when it doesn't", () => {
  render(ResultsTable, {
    props: {
      routeId: "riverside_route", entries: ENTRIES, teams: ["Team A", "Team B"],
      submissions: SUBMISSIONS, onView: vi.fn(),
    },
  });
  expect(screen.getAllByRole("button", { name: /view/i })).toHaveLength(1);
  expect(screen.getAllByText("-").length).toBeGreaterThan(0);
});

test("shows an (edited) tag when a cell has more than one submission", () => {
  const submissions: ResultsSubmission[] = [
    { id: "s1", locationId: "1", routeId: "riverside_route", teamName: "Team A", answers: {}, submittedAt: 100 },
    { id: "s2", locationId: "1", routeId: "riverside_route", teamName: "Team A", answers: {}, submittedAt: 200 },
  ];
  render(ResultsTable, {
    props: { routeId: "riverside_route", entries: ENTRIES, teams: ["Team A"], submissions, onView: vi.fn() },
  });
  expect(screen.getByText(/edited/i)).toBeInTheDocument();
});

test("clicking View calls onView with the latest submission, its entry, and the submission count", async () => {
  const onView = vi.fn();
  render(ResultsTable, {
    props: { routeId: "riverside_route", entries: ENTRIES, teams: ["Team A"], submissions: SUBMISSIONS, onView },
  });
  await fireEvent.click(screen.getByRole("button", { name: /view/i }));
  expect(onView).toHaveBeenCalledWith(SUBMISSIONS[0], ENTRIES[0], 1);
});

test("'Show only missing' filters out rows that have a submission", async () => {
  render(ResultsTable, {
    props: {
      routeId: "riverside_route", entries: ENTRIES, teams: ["Team A", "Team B"],
      submissions: SUBMISSIONS, onView: vi.fn(),
    },
  });
  expect(screen.getAllByRole("row")).toHaveLength(3);
  await fireEvent.click(screen.getByLabelText(/show only missing/i));
  expect(screen.getAllByRole("row")).toHaveLength(2);
});
