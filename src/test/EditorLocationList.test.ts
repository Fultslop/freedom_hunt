import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import EditorLocationList from "../pages/editor/EditorLocationList.svelte";
import { addPending } from "../pages/editor/editorStorage";
import { push } from "svelte-spa-router";
import { fetchEditorLocations } from "../utils/api";
import { loadText } from "../utils/loadText";

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

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({
    items: [
      { id: "den_haag", name: "Den Haag", country: "Netherlands" },
      { id: "oslo", name: "Oslo", country: "Norway" },
    ],
  }),
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

test("renders pending-only item inline without 'Pending additions' heading", async () => {
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

  expect(await screen.findByText("New Place")).toBeInTheDocument();
  expect(screen.queryByText("Pending additions")).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /pending — view pr/i }),
  ).toHaveAttribute("href", "https://github.com/org/repo/pull/99");
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

test("shows only the add row when there are no locations and no pending entries", async () => {
  vi.mocked(fetchEditorLocations).mockResolvedValueOnce({ ok: true, locations: [] });

  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });

  const addBtn = await screen.findByRole("button", { name: /\+ add location …/i });
  expect(addBtn).toBeInTheDocument();
  expect(screen.queryByText("Binnenhof")).not.toBeInTheDocument();
  expect(vi.mocked(loadText)).toHaveBeenCalled();
});

test("clicking add row accounts for pending filenames when computing next ID", async () => {
  addPending("democrats_abroad/den_haag/locations", {
    filename: "008_loc_new_place.yaml",
    locationTitle: "New Place",
    prTitle: "Add location: New Place",
    submittedAt: new Date().toISOString(),
    status: "pending",
  });

  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });

  await screen.findByText("New Place");
  await fireEvent.click(screen.getByRole("button", { name: /\+ add location …/i }));
  // live: [001], pending: [008] → max(1, 8) + 1 = 9
  expect(push).toHaveBeenCalledWith(
    "/editor/locations/democrats_abroad/den_haag/new/9",
  );
});

test("toolbar shows ↻ Refresh and ✕ Clear completed labels", async () => {
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

  await screen.findByText("Binnenhof");
  expect(screen.getByRole("button", { name: /↻ refresh/i })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /✕ clear completed/i }),
  ).toBeInTheDocument();
});

test("renders city dropdown with city names from loadText", async () => {
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  const select = await screen.findByRole("combobox");
  expect(select).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Den Haag" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Oslo" })).toBeInTheDocument();
});

test("selecting a city navigates to the new city URL", async () => {
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  const select = await screen.findByRole("combobox");
  await fireEvent.change(select, { target: { value: "oslo" } });
  expect(push).toHaveBeenCalledWith(
    "/editor/locations/democrats_abroad/oslo",
  );
});

test("selecting a city saves it to localStorage", async () => {
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  const select = await screen.findByRole("combobox");
  await fireEvent.change(select, { target: { value: "oslo" } });
  expect(localStorage.getItem("editor_last_city_democrats_abroad")).toBe("oslo");
});

test("on mount, saves the current city to localStorage", async () => {
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  await screen.findByRole("combobox");
  expect(localStorage.getItem("editor_last_city_democrats_abroad")).toBe("den_haag");
});
