import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { ThemeProvider } from "../theme/ThemeContext";
import ChallengeCard from "../components/ChallengeCard";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
}));

vi.mock("leaflet", () => ({
  default: { divIcon: () => ({}) },
}));

vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(() => ({ activeAuth: null })),
}));

const location = {
  locationId: 1,
  title: "The Final Civic Act",
  name: { value: "Binnenhof / Het Plein" },
  address: "Binnenhof 1",
  storyline: "The Binnenhof is the oldest seat of parliament.",
  coordinates: { latitude: 52.0799, longitude: 4.3133 },
  challenge: { name: "", description: "Register to vote.", form: [] },
  breadcrumb: "Find the inner courtyard.",
  themeColor: "#8B1A1A",
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

test("renders locationId badge", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} index={1} />
    </Wrapper>,
  );
  expect(screen.getByText("1")).toBeInTheDocument();
});

test("renders title", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(screen.getByText("The Final Civic Act")).toBeInTheDocument();
});

test("renders name.value when present", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(screen.getByText("Binnenhof / Het Plein")).toBeInTheDocument();
});

test("omits name when value is empty", () => {
  const loc = { ...location, name: { value: "" } };
  render(
    <Wrapper>
      <ChallengeCard location={loc} />
    </Wrapper>,
  );
  expect(screen.queryByText("Binnenhof / Het Plein")).not.toBeInTheDocument();
});

test("renders address when present", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(screen.getByText("Binnenhof 1")).toBeInTheDocument();
});

test("omits address when empty", () => {
  const loc = { ...location, address: "" };
  render(
    <Wrapper>
      <ChallengeCard location={loc} />
    </Wrapper>,
  );
  expect(screen.queryByText("Binnenhof 1")).not.toBeInTheDocument();
});

test("renders storyline", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(
    screen.getByText("The Binnenhof is the oldest seat of parliament."),
  ).toBeInTheDocument();
});

test("renders map", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(screen.getByTestId("map")).toBeInTheDocument();
});

test("renders challenge description", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(screen.getByText("Register to vote.")).toBeInTheDocument();
});

test("renders breadcrumb", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(screen.getByText("Find the inner courtyard.")).toBeInTheDocument();
});

test("badge background uses location themeColor", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} index={1} />
    </Wrapper>,
  );
  expect(screen.getByTestId("location-badge")).toHaveStyle({
    background: "#8B1A1A",
  });
});

test("badge falls back to theme accent when themeColor absent", () => {
  const loc = { ...location, themeColor: undefined };
  render(
    <Wrapper>
      <ChallengeCard location={loc} index={1} />
    </Wrapper>,
  );
  expect(screen.getByTestId("location-badge")).toHaveStyle({
    background: "#f59e0b",
  });
});

test("does not render hero image when image field absent", () => {
  render(
    <Wrapper>
      <ChallengeCard location={location} />
    </Wrapper>,
  );
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

describe("ChallengeForm integration", () => {
  test("renders ChallengeForm when challenge.form is present", () => {
    const loc = {
      ...location,
      challenge: {
        ...location.challenge,
        form: [{ id: "q1", type: "string" as const, label: "What do you see?" }],
      },
    };
    render(
      <Wrapper>
        <ChallengeCard location={loc} />
      </Wrapper>,
    );
    expect(screen.getByLabelText("What do you see?")).toBeInTheDocument();
  });

  test("does not render ChallengeForm when challenge.form is absent", () => {
    render(
      <Wrapper>
        <ChallengeCard location={location} />
      </Wrapper>,
    );
    expect(screen.queryByLabelText("What do you see?")).not.toBeInTheDocument();
  });

  test("does not render ChallengeForm when challenge.form is empty array", () => {
    const loc = {
      ...location,
      challenge: { ...location.challenge, form: [] },
    };
    render(
      <Wrapper>
        <ChallengeCard location={loc} />
      </Wrapper>,
    );
    expect(screen.queryByLabelText("What do you see?")).not.toBeInTheDocument();
  });
});
