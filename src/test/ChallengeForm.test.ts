import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import { authStore } from "../stores/authStore";
import ChallengeForm from "../components/ChallengeForm.svelte";
import { postFormSubmit } from "../utils/api";
import { buildFormStorageKey, saveFormState } from "../utils/formStorage";
import type { FormField } from "../types/data";

vi.mock("../utils/api", () => ({
  postFormSubmit: vi.fn().mockResolvedValue({ ok: true }),
  postPhotoUpload: vi.fn().mockResolvedValue({ ok: true, httpCode: 200 }),
}));

const form = [
  { id: "found_it", type: "boolean" as const, label: "Did you find it?" },
  { id: "note", type: "string" as const, label: "Your note", isRequired: true },
];

beforeEach(() => {
  localStorage.clear();
  authStore.loginParticipant("test_project", "Team A", "team@test.com");
});

afterEach(() => {
  vi.clearAllMocks();
});

test("renders form fields", () => {
  render(ChallengeForm, {
    props: { form, locationId: "1", routeId: "short_loop" },
  });
  expect(screen.getByText("Did you find it?")).toBeInTheDocument();
  expect(screen.getByText("Your note")).toBeInTheDocument();
});

test("shows validation error when required field is empty", async () => {
  render(ChallengeForm, {
    props: { form, locationId: "1", routeId: "short_loop" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.getByText("Required")).toBeInTheDocument();
  expect(screen.queryByText(/submit your answers/i)).not.toBeInTheDocument();
});

test("shows confirmation dialog when all required fields are filled", async () => {
  render(ChallengeForm, {
    props: { form, locationId: "1", routeId: "short_loop" },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.getByText(/submit your answers/i)).toBeInTheDocument();
});

test("calls postFormSubmit with correct payload on confirm", async () => {
  render(ChallengeForm, {
    props: { form, locationId: "1", routeId: "short_loop", cityId: "den_haag" },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  expect(postFormSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      locationId: "1",
      routeId: "short_loop",
      cityId: "den_haag",
      teamName: "Team A",
      contact: "team@test.com",
    }),
  );
});

test("no longer renders a flag-glyph divider", () => {
  render(ChallengeForm, { props: { form, locationId: "1", routeId: "short_loop" } });
  expect(document.querySelector(".cf-divider")).not.toBeInTheDocument();
});

test("multiple field: blocks selection beyond max and shows warning", async () => {
  const multiForm = [
    {
      id: "flags",
      type: "multiple" as const,
      label: "Pick flags",
      min: 1,
      max: 2,
      options: ["Dutch", "EU", "American"],
    },
  ];
  render(ChallengeForm, { props: { form: multiForm, locationId: "1" } });
  await fireEvent.click(screen.getByLabelText("Dutch"));
  await fireEvent.click(screen.getByLabelText("EU"));
  await fireEvent.click(screen.getByLabelText("American"));
  expect(screen.getByText(/you can only select 2/i)).toBeInTheDocument();
  expect(
    (screen.getByLabelText("American") as HTMLInputElement).checked,
  ).toBe(false);
});

test("photo field uses label as button text", () => {
  const photoForm = [
    { id: "pic", type: "photo" as const, label: "Take a photo" },
  ];
  render(ChallengeForm, { props: { form: photoForm, locationId: "1" } });
  expect(
    screen.getByRole("button", { name: /take a photo/i }),
  ).toBeInTheDocument();
});

test("photo upload sends cityId and taskTitle from props", async () => {
  const { postPhotoUpload } = await import("../utils/api");
  const photoForm = [
    { id: "pic", type: "photo" as const, label: "Take a photo" },
  ];
  const { container } = render(ChallengeForm, {
    props: {
      form: photoForm,
      locationId: "1",
      routeId: "short_loop",
      cityId: "den_haag",
      taskTitle: "The Final Civic Act",
    },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  expect(postPhotoUpload).toHaveBeenCalledWith(
    expect.objectContaining({
      locationId: "1",
      cityId: "den_haag",
      routeId: "short_loop",
      taskTitle: "The Final Civic Act",
    }),
  );
});

// ---------------------------------------------------------------------------
// Local storage persistence and resubmit behavior
// ---------------------------------------------------------------------------

test("form stays visible with a disabled Re-submit button after a successful submit (allowResubmit default true)", async () => {
  render(ChallengeForm, {
    props: { form, locationId: "1", routeId: "short_loop" },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  const savedBtn = await screen.findByRole("button", { name: /saved/i });
  expect(savedBtn).toBeDisabled();
  expect(screen.getByLabelText("Your note")).toBeInTheDocument();
});

test("Re-submit button enables after editing a previously-submitted form", async () => {
  render(ChallengeForm, {
    props: { form, locationId: "1", routeId: "short_loop" },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  await screen.findByRole("button", { name: /saved/i });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "updated text" },
  });
  expect(screen.getByRole("button", { name: "Re-submit" })).not.toBeDisabled();
});

test("form is replaced by a static success message when allowResubmit is false", async () => {
  render(ChallengeForm, {
    props: { form, locationId: "1", routeId: "short_loop", allowResubmit: false },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  expect(await screen.findByText("Submitted! ✓")).toBeInTheDocument();
  expect(screen.queryByLabelText("Your note")).not.toBeInTheDocument();
});

test("restores previously-entered values and submitted state from local storage on mount", async () => {
  const textOnlyForm = [
    { id: "note", type: "string" as const, label: "Your note", isRequired: true },
  ];
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1");
  saveFormState(key, {
    values: { note: "restored text" },
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  render(ChallengeForm, {
    props: { form: textOnlyForm, locationId: "1", routeId: "short_loop", cityId: "den_haag", project: "demo" },
  });
  expect((screen.getByLabelText("Your note") as HTMLInputElement).value).toBe(
    "restored text",
  );
  const btn = await screen.findByRole("button", { name: /no changes/i });
  expect(btn).toBeDisabled();
});

test("does not read or write local storage when storeInLocalStorage is false", async () => {
  render(ChallengeForm, {
    props: {
      form,
      locationId: "1",
      routeId: "short_loop",
      cityId: "den_haag",
      project: "demo",
      storeInLocalStorage: false,
    },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  expect(localStorage.getItem("demo/den_haag/short_loop/1/form")).toBeNull();
});

test("reports submitted status and missing labels via onFormStatusChange", async () => {
  const onFormStatusChange = vi.fn();
  render(ChallengeForm, {
    props: { form, locationId: "1", routeId: "short_loop", onFormStatusChange },
  });
  await waitFor(() => {
    expect(onFormStatusChange).toHaveBeenCalledWith({
      submitted: false,
      missingLabels: ["Your note"],
    });
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  await waitFor(() => {
    expect(onFormStatusChange).toHaveBeenLastCalledWith({
      submitted: true,
      missingLabels: [],
    });
  });
});

test("stamps submittedAt on first successful submit and keeps it across a re-submit", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1700000000000);
  render(ChallengeForm, {
    props: { form, locationId: "1", routeId: "short_loop", cityId: "den_haag", project: "demo" },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), { target: { value: "some text" } });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  await screen.findByRole("button", { name: /saved/i });
  const key = buildFormStorageKey("demo", "den_haag", "short_loop", "1");
  expect(JSON.parse(localStorage.getItem(key)!).submittedAt).toBe(1700000000000);

  vi.setSystemTime(1700000005000);
  await fireEvent.input(screen.getByLabelText("Your note"), { target: { value: "updated text" } });
  await fireEvent.click(screen.getByRole("button", { name: "Re-submit" }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  await screen.findByRole("button", { name: /saved/i });
  expect(JSON.parse(localStorage.getItem(key)!).submittedAt).toBe(1700000000000);
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Sourced textarea (cross-location prefill)
// ---------------------------------------------------------------------------

test("a sourced textarea seeds its value from another location's already-saved answer", () => {
  const sourceKey = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
  saveFormState(sourceKey, {
    values: { manifesto: "We pledge to keep fighting." },
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  const sourcedForm = [
    {
      id: "final_manifesto",
      type: "textarea" as const,
      label: "Final manifesto",
      source: "004_loc_lange_voorhout.form.manifesto",
    },
  ];
  render(ChallengeForm, {
    props: {
      form: sourcedForm,
      locationId: "007_loc_binnenhof",
      routeId: "short_loop",
      cityId: "den_haag",
      project: "demo",
    },
  });
  expect((screen.getByLabelText("Final manifesto") as HTMLTextAreaElement).value).toBe(
    "We pledge to keep fighting.",
  );
});

test("a sourced textarea is empty when the source location was never visited", () => {
  const sourcedForm = [
    {
      id: "final_manifesto",
      type: "textarea" as const,
      label: "Final manifesto",
      source: "999_loc_never_visited.form.manifesto",
    },
  ];
  render(ChallengeForm, {
    props: {
      form: sourcedForm,
      locationId: "007_loc_binnenhof",
      routeId: "short_loop",
      cityId: "den_haag",
      project: "demo",
    },
  });
  expect((screen.getByLabelText("Final manifesto") as HTMLTextAreaElement).value).toBe("");
});

test("editing a sourced textarea and remounting keeps the edit instead of re-syncing from a changed source", async () => {
  const sourceKey = buildFormStorageKey("demo", "den_haag", "short_loop", "004_loc_lange_voorhout");
  const targetKey = buildFormStorageKey("demo", "den_haag", "short_loop", "007_loc_binnenhof");
  saveFormState(sourceKey, {
    values: { manifesto: "Original draft." },
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
  });
  const sourcedForm = [
    {
      id: "final_manifesto",
      type: "textarea" as const,
      label: "Final manifesto",
      source: "004_loc_lange_voorhout.form.manifesto",
    },
  ];
  const { unmount } = render(ChallengeForm, {
    props: {
      form: sourcedForm,
      locationId: "007_loc_binnenhof",
      routeId: "short_loop",
      cityId: "den_haag",
      project: "demo",
    },
  });
  await fireEvent.input(screen.getByLabelText("Final manifesto"), {
    target: { value: "My own final words." },
  });
  await waitFor(() => {
    expect(JSON.parse(localStorage.getItem(targetKey)!).touchedFields).toEqual(["final_manifesto"]);
  });
  unmount();

  saveFormState(sourceKey, {
    values: { manifesto: "Revised draft." },
    uploads: {},
    submitted: true,
    skipped: false,
    touchedFields: [],
  });

  render(ChallengeForm, {
    props: {
      form: sourcedForm,
      locationId: "007_loc_binnenhof",
      routeId: "short_loop",
      cityId: "den_haag",
      project: "demo",
    },
  });
  expect((screen.getByLabelText("Final manifesto") as HTMLTextAreaElement).value).toBe(
    "My own final words.",
  );
});

// ---------------------------------------------------------------------------
// Cross-form isVisible (formContext pass-through)
// ---------------------------------------------------------------------------

test("passes formContext through to AppForm so cross-form isVisible conditions resolve", () => {
  localStorage.setItem(
    "demo/den_haag/short_loop/004_loc_lange_voorhout/form",
    JSON.stringify({
      version: "1.2",
      values: { manifesto: "the people" },
      uploads: {},
      submitted: true,
      skipped: false,
      touchedFields: [],
    }),
  );
  const form: FormField[] = [
    {
      id: "echo",
      type: "boolean",
      label: "Echo",
      isVisible: {
        initially: "conditional",
        condition: { source: "004_loc_lange_voorhout.form.manifesto", operator: "=", value: "the people" },
      },
    },
  ];
  render(ChallengeForm, {
    props: { form, locationId: "1", project: "demo", cityId: "den_haag", routeId: "short_loop" },
  });
  expect(screen.getByText("Echo")).toBeInTheDocument();
});
