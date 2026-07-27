import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import ResultsFilters from "../components/ResultsFilters.svelte";

const LOCATIONS = [{ ordinal: 1, name: "Eiffel Tower" }, { ordinal: 2, name: "Louvre" }];

test("renders team and location options plus a missing-only checkbox", () => {
  render(ResultsFilters, {
    props: {
      teams: ["Team A", "Team B"], locations: LOCATIONS,
      selectedTeam: "", selectedOrdinal: "", missingOnly: false,
      onTeamChange: vi.fn(), onLocationChange: vi.fn(), onMissingOnlyChange: vi.fn(),
    },
  });
  expect(screen.getByRole("option", { name: "Team A" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Louvre" })).toBeInTheDocument();
  expect(screen.getByLabelText(/show only missing/i)).toBeInTheDocument();
});

test("calls onTeamChange when the team select changes", async () => {
  const onTeamChange = vi.fn();
  render(ResultsFilters, {
    props: {
      teams: ["Team A", "Team B"], locations: LOCATIONS,
      selectedTeam: "", selectedOrdinal: "", missingOnly: false,
      onTeamChange, onLocationChange: vi.fn(), onMissingOnlyChange: vi.fn(),
    },
  });
  await fireEvent.change(screen.getByLabelText("Team"), { target: { value: "Team B" } });
  expect(onTeamChange).toHaveBeenCalledWith("Team B");
});

test("calls onMissingOnlyChange when the checkbox is toggled", async () => {
  const onMissingOnlyChange = vi.fn();
  render(ResultsFilters, {
    props: {
      teams: [], locations: LOCATIONS,
      selectedTeam: "", selectedOrdinal: "", missingOnly: false,
      onTeamChange: vi.fn(), onLocationChange: vi.fn(), onMissingOnlyChange,
    },
  });
  await fireEvent.click(screen.getByLabelText(/show only missing/i));
  expect(onMissingOnlyChange).toHaveBeenCalledWith(true);
});
