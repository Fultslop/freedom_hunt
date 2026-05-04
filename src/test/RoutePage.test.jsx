 
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "../theme/ThemeContext";
import { TitleBarProvider } from "../theme/TitleBarContext";
import RoutePage from "../pages/RoutePage";

const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(global, "localStorage", { value: localStorageMock });

vi.mock("../hooks/useText", () => ({
  useText: vi.fn(() => ({
    text: {
      route_a: {
        description: "Test route",
        locations: ["loc1", "loc2", "loc3"],
      },
    },
    loading: false,
  })),
}));

const mockLocations = [
  {
    locationId: 1,
    title: "Stop One",
    name: { value: "" },
    address: "",
    storyline: "First stop storyline.",
    coordinates: { latitude: 52.0, longitude: 4.0 },
    challenge: { description: "First challenge." },
    breadcrumb: "Head north.",
    image: null,
    themeColor: "#8B1A1A",
  },
  {
    locationId: 2,
    title: "Stop Two",
    name: { value: "" },
    address: "",
    storyline: "Second stop storyline.",
    coordinates: { latitude: 52.1, longitude: 4.1 },
    challenge: { description: "Second challenge." },
    breadcrumb: "Head south.",
    image: null,
    themeColor: "#2B5A27",
  },
  {
    locationId: 3,
    title: "Stop Three",
    name: { value: "" },
    address: "",
    storyline: "Third stop storyline.",
    coordinates: { latitude: 52.2, longitude: 4.2 },
    challenge: { description: "Third challenge." },
    breadcrumb: null,
    image: null,
    themeColor: "#002868",
  },
];

vi.mock("../hooks/useLocations", () => ({
  useLocations: vi.fn(() => ({ locations: mockLocations, loading: false })),
}));

/* eslint-disable react/prop-types */
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
}));

vi.mock("leaflet", () => ({
  default: { divIcon: () => ({}) },
}));
/* eslint-enable react/prop-types */

 
function Wrapper() {
  return (
    <MemoryRouter initialEntries={["/hunt/amsterdam/route_a"]}>
      <ThemeProvider>
        <TitleBarProvider>
          <Routes>
            <Route path="/:project/:city/:route" element={<RoutePage />} />
          </Routes>
        </TitleBarProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

test("renders first stop on mount", () => {
  render(<Wrapper />);
  expect(screen.getByText("Stop One")).toBeInTheDocument();
});

test("Next button advances to the next stop", () => {
  render(<Wrapper />);
  fireEvent.click(screen.getByLabelText("Next stop"));
  expect(screen.getByText("Stop Two")).toBeInTheDocument();
});

test("Prev button is not visible on the first stop", () => {
  render(<Wrapper />);
  expect(screen.queryByLabelText("Previous stop")).not.toBeInTheDocument();
});

test("Prev button returns to the previous stop", () => {
  render(<Wrapper />);
  fireEvent.click(screen.getByLabelText("Next stop"));
  fireEvent.click(screen.getByLabelText("Previous stop"));
  expect(screen.getByText("Stop One")).toBeInTheDocument();
});

test("Next button is not visible on the last stop", () => {
  render(<Wrapper />);
  fireEvent.click(screen.getByLabelText("Next stop"));
  fireEvent.click(screen.getByLabelText("Next stop"));
  expect(screen.queryByLabelText("Next stop")).not.toBeInTheDocument();
});
