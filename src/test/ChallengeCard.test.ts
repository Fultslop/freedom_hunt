import { render, screen } from "@testing-library/svelte/svelte5";
import { authStore } from "../stores/authStore";
import ChallengeCard from "../components/ChallengeCard.svelte";

vi.mock("../assets/AssetManager", () => ({
  fetchImage: vi.fn().mockResolvedValue("blob:test"),
}));

vi.mock("../actions/leafletMap", () => ({
  leafletMap: vi.fn(() => ({ update: vi.fn(), destroy: vi.fn() })),
}));

const location = {
  locationId: 1,
  title: "The Binnenhof",
  image: "binnenhof.jpg",
  name: { label: "", value: "Binnenhof" },
  address: "Binnenhof 1",
  coordinates: { latitude: 52.0799, longitude: 4.3133 },
  storyline: "A historic place.",
  breadcrumb: "Look for the gate.",
  challenge: {
    name: "",
    description: "Find the plaque.",
    notes: "",
    form: [{ id: "found_it", type: "boolean" as const, label: "Found it?" }],
  },
};

beforeEach(() => {
  authStore.login("test_project", "Team A", "team@test.com");
});

test("renders location title", () => {
  render(ChallengeCard, { props: { location } });
  expect(screen.getByText("The Binnenhof")).toBeInTheDocument();
});

test("renders location badge with index", () => {
  render(ChallengeCard, { props: { location, index: 3 } });
  expect(screen.getByTestId("location-badge")).toHaveTextContent("3");
});

test("renders challenge form when form fields present", () => {
  render(ChallengeCard, { props: { location } });
  expect(screen.getByText("Found it?")).toBeInTheDocument();
});

test("hides breadcrumb when isLast=true", () => {
  render(ChallengeCard, { props: { location, isLast: true } });
  expect(screen.queryByText("Look for the gate.")).not.toBeInTheDocument();
});
