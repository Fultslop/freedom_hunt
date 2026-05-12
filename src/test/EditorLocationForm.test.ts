import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/svelte/svelte5";
import EditorLocationForm from "../pages/editor/EditorLocationForm.svelte";
import { saveEditorLocation, fetchEditorLocation, fetchPrStatuses } from "../utils/api";
import { getDraft, saveDraft, addPending } from "../pages/editor/editorStorage";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue([
    { id: "identity", type: "string", label: "Id" },
    { id: "title", type: "string", label: "Title" },
    { id: "storyline", type: "textarea", label: "Storyline" },
  ]),
}));

vi.mock("../utils/api", () => ({
  fetchEditorLocation: vi.fn().mockResolvedValue({ ok: false }),
  saveEditorLocation: vi
    .fn()
    .mockResolvedValue({ ok: true, prUrl: "https://github.com/org/repo/pull/42" }),
  fetchPrStatuses: vi.fn().mockResolvedValue({ ok: false }),
}));

vi.mock("../actions/leafletMap", () => ({
  leafletMap: vi.fn(() => ({ update: vi.fn(), destroy: vi.fn() })),
}));

import { loadText } from "../utils/loadText";

beforeEach(() => {
  localStorage.clear();
  vi.mocked(saveEditorLocation).mockClear();
  vi.mocked(fetchEditorLocation).mockClear();
  vi.mocked(fetchPrStatuses).mockClear();
});

test("renders form in new-location mode", async () => {
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  expect(
    await screen.findByRole("button", { name: /no changes/i }),
  ).toBeInTheDocument();
});

test("renders identity section once YAML loads", async () => {
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  expect(await screen.findByText(/^Id$/i)).toBeInTheDocument();
});

test("submits form and shows modal in success state", async () => {
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByLabelText(/^Id$/i);
  await fireEvent.input(screen.getByLabelText(/^Id$/i), {
    target: { value: "binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Title$/i), {
    target: { value: "Binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Storyline$/i), {
    target: { value: "A great place." },
  });
  await fireEvent.click(
    screen.getByRole("button", { name: /submit for review/i }),
  );
  await waitFor(() => {
    expect(
      screen.getByText(/form submitted for review/i),
    ).toBeInTheDocument();
  });
});

test("shows failure modal when API returns an error", async () => {
  vi.mocked(saveEditorLocation).mockResolvedValueOnce({
    ok: false,
    error: "GitHub 422: branch exists",
  });
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByLabelText(/^Id$/i);
  await fireEvent.input(screen.getByLabelText(/^Id$/i), {
    target: { value: "binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Title$/i), {
    target: { value: "Binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Storyline$/i), {
    target: { value: "A great place." },
  });
  await fireEvent.click(
    screen.getByRole("button", { name: /submit for review/i }),
  );
  await waitFor(() => {
    expect(screen.getByText(/submission failed/i)).toBeInTheDocument();
    expect(screen.getByText(/GitHub 422: branch exists/)).toBeInTheDocument();
  });
});

test("retry re-submits and shows success modal on second attempt", async () => {
  vi.mocked(saveEditorLocation)
    .mockResolvedValueOnce({ ok: false, error: "First attempt failed" })
    .mockResolvedValueOnce({
      ok: true,
      prUrl: "https://github.com/org/repo/pull/42",
    });

  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByLabelText(/^Id$/i);
  await fireEvent.input(screen.getByLabelText(/^Id$/i), {
    target: { value: "binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Title$/i), {
    target: { value: "Binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Storyline$/i), {
    target: { value: "A great place." },
  });
  await fireEvent.click(
    screen.getByRole("button", { name: /submit for review/i }),
  );
  await waitFor(() => {
    expect(screen.getByText(/submission failed/i)).toBeInTheDocument();
  });
  await fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  await waitFor(() => {
    expect(screen.getByText(/form submitted for review/i)).toBeInTheDocument();
  });
  expect(vi.mocked(saveEditorLocation)).toHaveBeenCalledTimes(2);
});

test("edit: calls saveEditorLocation with original filename, not a recomputed one", async () => {
  vi.mocked(fetchEditorLocation).mockResolvedValueOnce({
    ok: true,
    sha: "def456",
    location: {
      locationId: 1,
      title: "Binnenhof",
      address: "Binnenhof 1",
      coordinates: { latitude: 52.0799, longitude: 4.3133 },
      storyline: "Story",
      breadcrumb: "",
      name: { label: "", value: "" },
      challenge: { name: "", description: "", notes: "", form: [] },
    },
  });

  render(EditorLocationForm, {
    props: {
      params: {
        project: "democrats_abroad",
        city: "den_haag",
        filename: "001_loc_binnenhof.yaml",
        newId: undefined as unknown as number,
      },
    },
  });

  // Wait for the form to load server data (storyline from fetched data)
  await screen.findByDisplayValue("Story");

  // Change the title so the submit button is enabled
  await fireEvent.input(screen.getByLabelText(/^Title$/i), {
    target: { value: "Binnenhof Updated" },
  });

  await fireEvent.click(
    screen.getByRole("button", { name: /submit for review/i }),
  );

  await waitFor(() => {
    // The last call should have the original filename, not a recomputed one
    const calls = vi.mocked(saveEditorLocation).mock.calls;
    const lastCall = calls[calls.length - 1]?.[0];
    expect(lastCall?.filename).toBe("001_loc_binnenhof.yaml");
  });
});

// ---------------------------------------------------------------------------
// Draft save
// ---------------------------------------------------------------------------

test("saves a draft to localStorage as the user types", async () => {
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByLabelText(/^Title$/i);
  await fireEvent.input(screen.getByLabelText(/^Title$/i), {
    target: { value: "New Location Title" },
  });
  await waitFor(() => {
    const draft = getDraft(
      "editor_draft_democrats_abroad/den_haag/locations_new",
    );
    expect(draft).not.toBeNull();
    expect((draft as Record<string, unknown>)["title"]).toBe(
      "New Location Title",
    );
  });
});

test("restores draft values into the form on mount", async () => {
  saveDraft("editor_draft_democrats_abroad/den_haag/locations_new", {
    title: "Restored Title",
    identity: "restored",
    storyline: "A story.",
  });

  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });

  await screen.findByLabelText(/^Title$/i);
  expect(
    (screen.getByLabelText(/^Title$/i) as HTMLInputElement).value,
  ).toBe("Restored Title");
});

test("preserves draft in localStorage after successful submit", async () => {
  const draftKey = "editor_draft_democrats_abroad/den_haag/locations_new";

  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });

  await screen.findByLabelText(/^Id$/i);
  await fireEvent.input(screen.getByLabelText(/^Id$/i), {
    target: { value: "test" },
  });
  await fireEvent.input(screen.getByLabelText(/^Title$/i), {
    target: { value: "Test" },
  });
  await fireEvent.input(screen.getByLabelText(/^Storyline$/i), {
    target: { value: "Story." },
  });
  await fireEvent.click(
    screen.getByRole("button", { name: /submit for review/i }),
  );

  await waitFor(() => {
    const draft = getDraft(draftKey);
    expect(draft).not.toBeNull();
    expect((draft as Record<string, unknown>)["title"]).toBe("Test");
  });
});

test("edit: restores draft instead of server values when draft exists", async () => {
  const draftKey = "editor_draft_democrats_abroad/den_haag/locations_001_loc_binnenhof.yaml";
  saveDraft(draftKey, {
    title: "Draft Title (unsaved)",
    identity: "binnenhof",
    storyline: "Draft storyline.",
  });

  vi.mocked(fetchEditorLocation).mockResolvedValueOnce({
    ok: true,
    sha: "abc123",
    location: {
      locationId: 1,
      title: "Server Title",
      address: "",
      coordinates: { latitude: 52.0799, longitude: 4.3133 },
      storyline: "Server storyline.",
      breadcrumb: "",
      name: { label: "", value: "" },
      challenge: { name: "", description: "", notes: "", form: [] },
    },
  });

  render(EditorLocationForm, {
    props: {
      params: {
        project: "democrats_abroad",
        city: "den_haag",
        filename: "001_loc_binnenhof.yaml",
        newId: undefined as unknown as number,
      },
    },
  });

  // Wait for server fetch to complete
  await screen.findByDisplayValue("Draft Title (unsaved)");

  // Draft value should be shown, not the server value
  expect(
    (screen.getByLabelText(/^Title$/i) as HTMLInputElement).value,
  ).toBe("Draft Title (unsaved)");
});

// ---------------------------------------------------------------------------
// Draft staleness — PR closed/merged clears the draft
// ---------------------------------------------------------------------------

test("clears draft and reloads server values when PR is closed", async () => {
  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prUrl: "https://github.com/org/repo/pull/99",
    prTitle: "Edit location: Binnenhof",
    submittedAt: new Date().toISOString(),
    status: "pending",
  });

  const draftKey = "editor_draft_democrats_abroad/den_haag/locations_001_loc_binnenhof.yaml";
  saveDraft(draftKey, {
    title: "Stale Draft Title",
    identity: "binnenhof",
    storyline: "Stale.",
  });

  vi.mocked(fetchPrStatuses).mockResolvedValueOnce({
    ok: true,
    statuses: { "99": "closed" },
  });

  vi.mocked(fetchEditorLocation).mockResolvedValueOnce({
    ok: true,
    sha: "abc123",
    location: {
      locationId: 1,
      title: "Server Title",
      address: "",
      coordinates: { latitude: 52.0799, longitude: 4.3133 },
      storyline: "Server storyline.",
      breadcrumb: "",
      name: { label: "", value: "" },
      challenge: { name: "", description: "", notes: "", form: [] },
    },
  });

  render(EditorLocationForm, {
    props: {
      params: {
        project: "democrats_abroad",
        city: "den_haag",
        filename: "001_loc_binnenhof.yaml",
        newId: undefined as unknown as number,
      },
    },
  });

  await waitFor(() => {
    expect(
      (screen.getByLabelText(/^Title$/i) as HTMLInputElement).value,
    ).toBe("Server Title");
  });
});

test("keeps draft when PR is still open", async () => {
  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prUrl: "https://github.com/org/repo/pull/55",
    prTitle: "Edit location: Binnenhof",
    submittedAt: new Date().toISOString(),
    status: "pending",
  });

  const draftKey = "editor_draft_democrats_abroad/den_haag/locations_001_loc_binnenhof.yaml";
  saveDraft(draftKey, {
    title: "Draft Title",
    identity: "binnenhof",
    storyline: "Draft.",
  });

  vi.mocked(fetchPrStatuses).mockResolvedValueOnce({
    ok: true,
    statuses: { "55": "open" },
  });

  vi.mocked(fetchEditorLocation).mockResolvedValueOnce({
    ok: true,
    sha: "abc123",
    location: {
      locationId: 1,
      title: "Server Title",
      address: "",
      coordinates: { latitude: 52.0799, longitude: 4.3133 },
      storyline: "Server storyline.",
      breadcrumb: "",
      name: { label: "", value: "" },
      challenge: { name: "", description: "", notes: "", form: [] },
    },
  });

  render(EditorLocationForm, {
    props: {
      params: {
        project: "democrats_abroad",
        city: "den_haag",
        filename: "001_loc_binnenhof.yaml",
        newId: undefined as unknown as number,
      },
    },
  });

  await waitFor(() => {
    expect(
      (screen.getByLabelText(/^Title$/i) as HTMLInputElement).value,
    ).toBe("Draft Title");
  });

  expect(getDraft(draftKey)).not.toBeNull();
});

// ---------------------------------------------------------------------------
// SubmitModal — isNewPr detection
// ---------------------------------------------------------------------------

test("shows 'Opening PR' when previous failed entry has no prUrl", async () => {
  addPending("democrats_abroad/den_haag/locations", {
    filename: "000_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prTitle: "Add location: Binnenhof",
    submittedAt: new Date().toISOString(),
    status: "failed",
    isNew: true,
  });

  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  await screen.findByLabelText(/^Id$/i);
  await fireEvent.input(screen.getByLabelText(/^Id$/i), {
    target: { value: "binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Title$/i), {
    target: { value: "Binnenhof" },
  });
  await fireEvent.input(screen.getByLabelText(/^Storyline$/i), {
    target: { value: "A great place." },
  });
  await fireEvent.click(
    screen.getByRole("button", { name: /submit for review/i }),
  );
  await waitFor(() => {
    expect(screen.getByText(/Opening PR:/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// City coordinate defaults and initialValues reconstruction
// ---------------------------------------------------------------------------

test("new location with no draft: coordinates seeded from city data", async () => {
  vi.mocked(loadText)
    .mockResolvedValueOnce([
      { id: "coordinates", type: "coord-picker", label: "Coordinates", isRequired: true },
    ])
    .mockResolvedValueOnce({
      items: [
        {
          id: "den_haag",
          name: "Den Haag",
          country: "Netherlands",
          coordinates: { latitude: 52.0799, longitude: 4.3133 },
        },
      ],
    });

  render(EditorLocationForm, {
    props: { params: { project: "democrats_abroad", city: "den_haag", newId: 1 } },
  });

  await waitFor(() => {
    expect(
      (screen.getByLabelText(/latitude/i) as HTMLInputElement).value,
    ).toBe("52.0799");
  });
  expect(
    (screen.getByLabelText(/longitude/i) as HTMLInputElement).value,
  ).toBe("4.3133");
});

test("new location with existing draft: draft takes precedence over city coords", async () => {
  // Pre-seed a draft with different coordinates
  const draftKey = "editor_draft_democrats_abroad/den_haag/locations_new";
  localStorage.setItem(
    draftKey,
    JSON.stringify({ coordinates: { latitude: 51.0, longitude: 3.0 } }),
  );

  vi.mocked(loadText)
    .mockResolvedValueOnce([
      { id: "coordinates", type: "coord-picker", label: "Coordinates", isRequired: true },
    ])
    .mockResolvedValueOnce({
      items: [
        {
          id: "den_haag",
          name: "Den Haag",
          country: "Netherlands",
          coordinates: { latitude: 52.0799, longitude: 4.3133 },
        },
      ],
    });

  render(EditorLocationForm, {
    props: { params: { project: "democrats_abroad", city: "den_haag", newId: 1 } },
  });

  await waitFor(() => {
    expect(
      (screen.getByLabelText(/latitude/i) as HTMLInputElement).value,
    ).toBe("51");
  });
  expect(
    (screen.getByLabelText(/longitude/i) as HTMLInputElement).value,
  ).toBe("3");
});

test("edit mode: initialValues.coordinates is a compound object, not dotted-path keys", async () => {
  vi.mocked(fetchEditorLocation).mockResolvedValueOnce({
    ok: true,
    sha: "abc123",
    location: {
      locationId: 1,
      title: "Binnenhof",
      coordinates: { latitude: 52.0799, longitude: 4.3133 },
      storyline: "A historic place.",
      breadcrumb: "Look for the gate.",
      name: { label: "", value: "Binnenhof" },
      challenge: { name: "", description: "Find it.", notes: "", form: [] },
    },
  });

  vi.mocked(loadText)
    .mockResolvedValueOnce([
      { id: "coordinates", type: "coord-picker", label: "Coordinates", isRequired: true },
    ])
    .mockResolvedValueOnce({
      items: [
        {
          id: "den_haag",
          name: "Den Haag",
          country: "Netherlands",
          coordinates: { latitude: 52.0799, longitude: 4.3133 },
        },
      ],
    });

  render(EditorLocationForm, {
    props: {
      params: {
        project: "democrats_abroad",
        city: "den_haag",
        filename: "001_loc_binnenhof.yaml",
        newId: 0,
      },
    },
  });

  await waitFor(() => {
    expect(
      (screen.getByLabelText(/latitude/i) as HTMLInputElement).value,
    ).toBe("52.0799");
  });
  expect(
    (screen.getByLabelText(/longitude/i) as HTMLInputElement).value,
  ).toBe("4.3133");
});
