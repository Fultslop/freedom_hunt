import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte/svelte5";
import HuntSummary from "../components/HuntSummary.svelte";

describe("HuntSummary", () => {
  it("renders stops/distance/duration chips when a summary is known", () => {
    render(HuntSummary, {
      props: {
        summary: { cityId: "den_haag", routeId: "short_loop", stopCount: 15, distanceMeters: 2400, durationMinutes: 120 },
        projectName: "Democrats Abroad",
        cityLabel: "Den Haag",
        organiser: "Democrats Abroad NL",
      },
    });
    expect(screen.getByText("15 stops")).toBeInTheDocument();
    expect(screen.getByText("2.4 km")).toBeInTheDocument();
    expect(screen.getByText("~2 hours")).toBeInTheDocument();
  });

  it("drops the distance chip when distanceMeters is null, without dropping the others", () => {
    render(HuntSummary, {
      props: {
        summary: { cityId: "den_haag", routeId: "short_loop", stopCount: 15, distanceMeters: null, durationMinutes: 120 },
        projectName: "Democrats Abroad",
        cityLabel: "Den Haag",
        organiser: "Democrats Abroad NL",
      },
    });
    expect(screen.getByText("15 stops")).toBeInTheDocument();
    expect(screen.queryByText(/km/)).not.toBeInTheDocument();
  });

  it("renders no chips at all, and a city-count line instead, when summary is null", () => {
    render(HuntSummary, {
      props: { summary: null, projectName: "Democrats Abroad", cityLabel: "3 cities", organiser: "Democrats Abroad NL" },
    });
    expect(screen.queryByText(/stops/)).not.toBeInTheDocument();
    expect(screen.getByText(/3 cities/)).toBeInTheDocument();
  });
});
