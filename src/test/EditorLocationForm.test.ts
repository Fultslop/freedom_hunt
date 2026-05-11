import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/svelte/svelte5";
import EditorLocationForm from "../pages/editor/EditorLocationForm.svelte";
import { saveEditorLocation, fetchEditorLocation, fetchPrStatuses } from "../utils/api";
import { getDraft, saveDraft, addPending, clearDraft } from "../pages/editor/editorStorage";

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

test("submits form and shows success state", async () => {
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
      screen.getByText(/changes submitted for review/i),
    ).toBeInTheDocument();
  });
});

test("edit: calls saveEditorLocation with original filename, not a recomputed one", async () => {
  vi.mocked(saveEditorLocation).mockClear();
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
  localStorage.clear();
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
  localStorage.clear();
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
  localStorage.clear();
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
  localStorage.clear();
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
  localStorage.clear();

  // Set up a pending entry for a closed PR
  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prUrl: "https://github.com/org/repo/pull/99",
    prTitle: "Edit location: Binnenhof",
    submittedAt: new Date().toISOString(),
  });

  // Save a stale draft
  const draftKey = "editor_draft_democrats_abroad/den_haag/locations_001_loc_binnenhof.yaml";
  saveDraft(draftKey, {
    title: "Stale Draft Title",
    identity: "binnenhof",
    storyline: "Stale.",
  });

  // Mock: PR #99 is closed
  vi.mocked(fetchPrStatuses).mockResolvedValueOnce({
    ok: true,
    statuses: { "99": "closed" },
  });

  // Mock: server data for reload
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

  // Wait for server data to appear (draft was cleared, so server values are used)
  await waitFor(() => {
    expect(
      (screen.getByLabelText(/^Title$/i) as HTMLInputElement).value,
    ).toBe("Server Title");
  });
});

test("keeps draft when PR is still open", async () => {
  localStorage.clear();

  addPending("democrats_abroad/den_haag/locations", {
    filename: "001_loc_binnenhof.yaml",
    locationTitle: "Binnenhof",
    prUrl: "https://github.com/org/repo/pull/55",
    prTitle: "Edit location: Binnenhof",
    submittedAt: new Date().toISOString(),
  });

  const draftKey = "editor_draft_democrats_abroad/den_haag/locations_001_loc_binnenhof.yaml";
  saveDraft(draftKey, {
    title: "Draft Title",
    identity: "binnenhof",
    storyline: "Draft.",
  });

  // Mock: PR #55 is still open
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

  // Wait for draft to be shown (draft preserved since PR is open)
  await waitFor(() => {
    expect(
      (screen.getByLabelText(/^Title$/i) as HTMLInputElement).value,
    ).toBe("Draft Title");
  });

  // Draft should still exist
  expect(getDraft(draftKey)).not.toBeNull();
});