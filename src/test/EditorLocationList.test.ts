import { render, screen } from "@testing-library/svelte/svelte5";
import EditorLocationList from "../pages/editor/EditorLocationList.svelte";
import { addPending } from "../pages/editor/editorStorage";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../utils/api", () => ({
  fetchEditorLocations: vi.fn().mockResolvedValue({
    ok: true,
    locations: [
      {
        filename: "001_loc_binnenhof.yaml",
        sha: "abc123",
        location: {
          locationId: 1,
          title: "Binnenhof",
          address: "Binnenhof 1",
          coordinates: { latitude: 52.0799, longitude: 4.3133 },
          storyline: "",
          breadcrumb: "",
          name: { label: "", value: "Binnenhof" },
          challenge: { name: "", description: "", notes: "", form: [] },
        },
      },
    ],
  }),
  fetchPrStatuses: vi.fn().mockResolvedValue({ ok: true, statuses: {} }),
  saveEditorLocation: vi.fn().mockResolvedValue({ ok: true }),
}));

test("renders location list", async () => {
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  expect(await screen.findByText("Binnenhof")).toBeInTheDocument();
});

test("renders Add location button", async () => {
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  expect(
    await screen.findByRole("button", { name: /add location/i }),
  ).toBeInTheDocument();
});

test("shows 'Pending additions' section for new locations not yet in GitHub", async () => {
  localStorage.clear();
  addPending("democrats_abroad/den_haag/locations", {
    filename: "008_loc_new_place.yaml",
    locationTitle: "New Place",
    prUrl: "https://github.com/org/repo/pull/99",
    prTitle: "Add location: New Place",
    submittedAt: new Date().toISOString(),
  });

  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });

  // The GitHub mock returns only "Binnenhof" — "New Place" is pending-only
  expect(await screen.findByText("Pending additions")).toBeInTheDocument();
  expect(screen.getByText("New Place")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /pending — view pr/i })).toHaveAttribute(
    "href",
    "https://github.com/org/repo/pull/99",
  );
});

test("does not show 'Pending additions' when all pending entries are in GitHub list", async () => {
  localStorage.clear();
  // "Binnenhof" IS in the GitHub mock, so it's not a new pending addition
  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prUrl: "https://github.com/org/repo/pull/1",
  });

  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });

  await screen.findByText("Binnenhof"); // wait for list to load
  expect(screen.queryByText("Pending additions")).not.toBeInTheDocument();
});
