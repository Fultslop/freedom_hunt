import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import EditorLocationList from "../pages/editor/EditorLocationList.svelte";
import { addPending } from "../pages/editor/editorStorage";
import { push } from "svelte-spa-router";

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

beforeEach(() => localStorage.clear());

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
  addPending("democrats_abroad/den_haag/locations", {
    filename: "008_loc_new_place.yaml",
    locationTitle: "New Place",
    prUrl: "https://github.com/org/repo/pull/99",
    prTitle: "Add location: New Place",
    submittedAt: new Date().toISOString(),
    status: "pending",
  });

  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });

  expect(await screen.findByText("Pending additions")).toBeInTheDocument();
  expect(screen.getByText("New Place")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /pending — view pr/i })).toHaveAttribute(
    "href",
    "https://github.com/org/repo/pull/99",
  );
});

test("does not show 'Pending additions' when all pending entries are in GitHub list", async () => {
  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prUrl: "https://github.com/org/repo/pull/1",
    status: "pending",
  });

  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });

  await screen.findByText("Binnenhof");
  expect(screen.queryByText("Pending additions")).not.toBeInTheDocument();
});

test("shows 'Submitting…' badge for a pending entry with status submitting", async () => {
  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prTitle: "Edit location: Binnenhof",
    submittedAt: new Date().toISOString(),
    status: "submitting",
  });
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  expect(await screen.findByText(/Submitting…/)).toBeInTheDocument();
});

test("shows 'Up to date' badge for a pending entry with status up_to_date", async () => {
  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prTitle: "Edit location: Binnenhof",
    submittedAt: new Date().toISOString(),
    status: "up_to_date",
  });
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  expect(await screen.findByText(/Up to date/)).toBeInTheDocument();
});

test("shows 'Submission failed' badge with Retry button for failed edit entry", async () => {
  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prTitle: "Edit location: Binnenhof",
    submittedAt: new Date().toISOString(),
    status: "failed",
    isNew: false,
  });
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  await screen.findByText(/Submission failed/);
  await fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(push).toHaveBeenCalledWith(
    "/editor/locations/democrats_abroad/den_haag/edit/001_loc_binnenhof.yaml",
  );
});

test("Retry for isNew=true failed entry navigates to new route", async () => {
  addPending("democrats_abroad/den_haag/locations", {
    filename: "002_loc_new_place.yaml",
    locationTitle: "New Place",
    prTitle: "Add location: New Place",
    submittedAt: new Date().toISOString(),
    status: "failed",
    isNew: true,
  });
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  await screen.findByText(/Submission failed/);
  await fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(push).toHaveBeenCalledWith(
    "/editor/locations/democrats_abroad/den_haag/new/2",
  );
});

test("'Clear completed' button appears when up_to_date entries exist and removes them", async () => {
  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prTitle: "Edit location: Binnenhof",
    submittedAt: new Date().toISOString(),
    status: "up_to_date",
  });
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  const clearBtn = await screen.findByRole("button", { name: /clear completed/i });
  expect(clearBtn).toBeInTheDocument();
  await fireEvent.click(clearBtn);
  expect(screen.queryByText(/Up to date/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /clear completed/i })).not.toBeInTheDocument();
});
