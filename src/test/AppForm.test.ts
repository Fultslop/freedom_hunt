import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import AppForm from "../components/AppForm.svelte";
import type { FormField, FormFieldType } from "../types/data";

vi.mock("../utils/images", () => ({
  getAvailableImages: () => [
    { filename: "logo.jpg", url: "/assets/logo.jpg" },
    { filename: "photo.png", url: "/assets/photo.png" },
  ],
}));

import { leafletMap } from "../actions/leafletMap";
import type { LeafletMapParams } from "../actions/leafletMap";

vi.mock("../actions/leafletMap", () => ({
  leafletMap: vi.fn(() => ({ update: vi.fn(), destroy: vi.fn() })),
}));

beforeEach(() => {
  vi.mocked(leafletMap).mockClear();
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

test("renders string and number field labels", () => {
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Your note" },
    { id: "count", type: "number", label: "Count" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByText("Your note")).toBeInTheDocument();
  expect(screen.getByText("Count")).toBeInTheDocument();
});

test("renders textarea field", () => {
  const fields: FormField[] = [
    { id: "story", type: "textarea", label: "Your story" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByLabelText("Your story").tagName).toBe("TEXTAREA");
});

test("renders section heading without an input", () => {
  const fields: FormField[] = [
    { type: "section", label: "Basic info" },
    { id: "title", type: "string", label: "Title" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByText("Basic info")).toBeInTheDocument();
  expect(screen.queryByLabelText("Basic info")).not.toBeInTheDocument();
});

test("renders boolean field as checkbox", () => {
  const fields: FormField[] = [
    { id: "agree", type: "boolean", label: "I agree" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByRole("checkbox")).toBeInTheDocument();
});

test("renders radio options", () => {
  const fields: FormField[] = [
    {
      id: "time",
      type: "radio",
      label: "Time of day",
      options: ["Morning", "Afternoon"],
    },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByLabelText("Morning")).toBeInTheDocument();
  expect(screen.getByLabelText("Afternoon")).toBeInTheDocument();
});

test("renders photo button with field label", () => {
  const onPhotoUpload = vi.fn();
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn(), onPhotoUpload } });
  expect(
    screen.getByRole("button", { name: /take a photo/i }),
  ).toBeInTheDocument();
});

test("renders field label for unknown field type", () => {
  const fields: FormField[] = [
    { id: "bad", type: "inline_form" as FormFieldType, label: "Bad Field" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByText("Bad Field")).toBeInTheDocument();
});

test("renders schema error label for field with unknown properties", () => {
  const fields: FormField[] = [
    {
      id: "obs",
      type: "schema_error" as FormFieldType,
      label: "unknown properties on 'obs': vodoo",
    },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(
    screen.getByText("unknown properties on 'obs': vodoo"),
  ).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Initial values
// ---------------------------------------------------------------------------

test("pre-populates string field from initialValues", () => {
  const fields: FormField[] = [
    { id: "title", type: "string", label: "Title" },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { title: "Hello world" },
      onSubmit: vi.fn(),
    },
  });
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
    "Hello world",
  );
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

test("shows required error for empty string field on submit", async () => {
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Your note", isRequired: true },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  // Input something then clear it to trigger hasChanges = true
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "x" },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.getByText("Required")).toBeInTheDocument();
});

test("shows required error for empty textarea on submit", async () => {
  const fields: FormField[] = [
    { id: "story", type: "textarea", label: "Your story", isRequired: true },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  // Input something then clear it to trigger hasChanges = true
  await fireEvent.input(screen.getByLabelText("Your story"), {
    target: { value: "x" },
  });
  await fireEvent.input(screen.getByLabelText("Your story"), {
    target: { value: "" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.getByText("Required")).toBeInTheDocument();
});

test("does not validate section or boolean fields as required", async () => {
  const fields: FormField[] = [
    { type: "section", label: "Group" },
    { id: "agree", type: "boolean", label: "I agree" },
  ];
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(AppForm, { props: { fields, onSubmit } });
  // Toggle boolean to trigger hasChanges = true
  await fireEvent.click(screen.getByLabelText("I agree"));
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.queryByText("Required")).not.toBeInTheDocument();
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
});

test("does not show required error for non-required empty string on submit", async () => {
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Your note", isRequired: false },
  ];
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(AppForm, { props: { fields, onSubmit } });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "x" },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.queryByText("Required")).not.toBeInTheDocument();
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
});

test("required field label has af-label--required class, non-required does not", () => {
  const fields: FormField[] = [
    { id: "title", type: "string", label: "Title", isRequired: true },
    { id: "note", type: "string", label: "Note" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  const titleLabel = screen.getByLabelText("Title").closest(".af-field")?.querySelector("label");
  const noteLabel = screen.getByLabelText("Note").closest(".af-field")?.querySelector("label");
  expect(titleLabel).toHaveClass("af-label--required");
  expect(noteLabel).not.toHaveClass("af-label--required");
});

// ---------------------------------------------------------------------------
// Confirmation dialog
// ---------------------------------------------------------------------------

test("shows confirm dialog when confirmMessage is set and form is valid", async () => {
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Note" },
  ];
  render(AppForm, {
    props: {
      fields,
      onSubmit: vi.fn().mockResolvedValue(undefined),
      confirmMessage: "Are you sure?",
    },
  });
  await fireEvent.input(screen.getByLabelText("Note"), {
    target: { value: "hello" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.getByText("Are you sure?")).toBeInTheDocument();
});

test("calls onSubmit after confirming", async () => {
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Note" },
  ];
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(AppForm, {
    props: { fields, onSubmit, confirmMessage: "Sure?" },
  });
  await fireEvent.input(screen.getByLabelText("Note"), {
    target: { value: "hello" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
});

// ---------------------------------------------------------------------------
// coord-picker field type
// ---------------------------------------------------------------------------

test("renders coord-picker field as latitude and longitude inputs", () => {
  const fields: FormField[] = [
    { id: "coordinates", type: "coord-picker" as FormFieldType, label: "Coordinates" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(screen.getByLabelText(/latitude/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/longitude/i)).toBeInTheDocument();
});

test("coord-picker value change propagates to onSubmit as coordinates object", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const fields: FormField[] = [
    {
      id: "coordinates",
      type: "coord-picker" as FormFieldType,
      label: "Coordinates",
      isRequired: true,
    },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { coordinates: { latitude: 52.0799, longitude: 4.3133 } },
      onSubmit,
    },
  });
  const actionParams = vi.mocked(leafletMap).mock.calls[0][1] as LeafletMapParams;
  actionParams.onClick!(53.0, 5.0);
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ coordinates: { latitude: 53.0, longitude: 5.0 } }),
    );
  });
});

test("does not call onSubmit when confirmation is cancelled", async () => {
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Note" },
  ];
  const onSubmit = vi.fn();
  render(AppForm, {
    props: { fields, onSubmit, confirmMessage: "Sure?" },
  });
  await fireEvent.input(screen.getByLabelText("Note"), {
    target: { value: "hello" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
  expect(onSubmit).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// onSuccess callback and dotted-path output
// ---------------------------------------------------------------------------

test("calls onSuccess after successful submission", async () => {
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Note" },
  ];
  const onSuccess = vi.fn();
  render(AppForm, {
    props: {
      fields,
      onSubmit: vi.fn().mockResolvedValue(undefined),
      onSuccess,
    },
  });
  await fireEvent.input(screen.getByLabelText("Note"), {
    target: { value: "hello" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
});

test("passes nested values for dotted-path field IDs to onSubmit", async () => {
  const fields: FormField[] = [
    { id: "coordinates.latitude", type: "string", label: "Latitude" },
  ];
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(AppForm, { props: { fields, onSubmit } });
  await fireEvent.input(screen.getByLabelText("Latitude"), {
    target: { value: "52.07" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({
      coordinates: { latitude: "52.07" },
    }),
  );
});

// ---------------------------------------------------------------------------
// multiple field
// ---------------------------------------------------------------------------

test("multiple field: blocks selection beyond max and shows warning", async () => {
  const fields: FormField[] = [
    {
      id: "flags",
      type: "multiple",
      label: "Pick flags",
      min: 1,
      max: 2,
      options: ["Dutch", "EU", "American"],
    },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  await fireEvent.click(screen.getByLabelText("Dutch"));
  await fireEvent.click(screen.getByLabelText("EU"));
  await fireEvent.click(screen.getByLabelText("American"));
  expect(screen.getByText(/you can only select 2/i)).toBeInTheDocument();
  expect(
    (screen.getByLabelText("American") as HTMLInputElement).checked,
  ).toBe(false);
});

// ---------------------------------------------------------------------------
// hasChanges
// ---------------------------------------------------------------------------

test("submit button shows 'No changes' and is disabled when values equal initialValues", async () => {
  const fields: FormField[] = [
    { id: "title", type: "string", label: "Title" },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { title: "Binnenhof" },
      onSubmit: vi.fn(),
    },
  });
  const btn = await screen.findByRole("button", { name: /no changes/i });
  expect(btn).toBeDisabled();
});

test("submit button is enabled after user changes a field", async () => {
  const fields: FormField[] = [
    { id: "title", type: "string", label: "Title" },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { title: "Binnenhof" },
      onSubmit: vi.fn(),
    },
  });
  await fireEvent.input(screen.getByLabelText("Title"), {
    target: { value: "Binnenhof Updated" },
  });
  const btn = screen.getByRole("button", { name: /submit/i });
  expect(btn).not.toBeDisabled();
});

test("baseValues overrides initialValues as the hasChanges baseline", async () => {
  const fields: FormField[] = [
    { id: "title", type: "string", label: "Title" },
  ];
  // initialValues = draft (differs from server)
  // baseValues = server data (the committed baseline)
  render(AppForm, {
    props: {
      fields,
      initialValues: { title: "Draft Title" },
      baseValues: { title: "Server Title" },
      onSubmit: vi.fn(),
    },
  });
  // Form pre-populated with "Draft Title", which differs from baseValues "Server Title"
  // → hasChanges = true → submit is enabled (not "No changes")
  const btn = await screen.findByRole("button", { name: /submit/i });
  expect(btn).not.toBeDisabled();
  expect(btn).not.toHaveTextContent(/no changes/i);
});

// ---------------------------------------------------------------------------
// onValuesChange
// ---------------------------------------------------------------------------

test("onValuesChange is called when a field value changes", async () => {
  const fields: FormField[] = [
    { id: "title", type: "string", label: "Title" },
  ];
  const onValuesChange = vi.fn();
  render(AppForm, {
    props: { fields, onSubmit: vi.fn(), onValuesChange },
  });
  await fireEvent.input(screen.getByLabelText("Title"), {
    target: { value: "hello" },
  });
  await waitFor(() => {
    expect(onValuesChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: "hello" }),
    );
  });
});

// ---------------------------------------------------------------------------
// image-picker field
// ---------------------------------------------------------------------------

test("image-picker renders 'Choose image' button when value is empty", () => {
  const fields: FormField[] = [
    { id: "image", type: "image-picker" as FormFieldType, label: "Image" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  expect(
    screen.getByRole("button", { name: /choose image/i }),
  ).toBeInTheDocument();
});

test("image-picker opens dialog and selects image on tile click", async () => {
  const fields: FormField[] = [
    { id: "image", type: "image-picker" as FormFieldType, label: "Image" },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn() } });
  await fireEvent.click(screen.getByRole("button", { name: /choose image/i }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  await fireEvent.click(screen.getByRole("button", { name: "logo.jpg" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: "logo.jpg" })).toBeInTheDocument();
  expect(screen.getByText("logo.jpg")).toBeInTheDocument();
});

test("image-picker shows warning for unknown filename in initialValues", () => {
  const fields: FormField[] = [
    { id: "image", type: "image-picker" as FormFieldType, label: "Image" },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { image: "missing.jpg" },
      onSubmit: vi.fn(),
    },
  });
  expect(
    screen.getByText("⚠ file missing.jpg not found in project"),
  ).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

test("required image-picker shows Required error when empty on submit", async () => {
  const fields: FormField[] = [
    {
      id: "image",
      type: "image-picker" as FormFieldType,
      label: "Image",
      isRequired: true,
    },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { image: "logo.jpg" },
      onSubmit: vi.fn(),
    },
  });
  // Open dialog and select None to set value to ""
  const changeButtons = screen.getAllByRole("button", { name: /change/i });
  await fireEvent.click(changeButtons[0]);
  await fireEvent.click(screen.getByRole("button", { name: /none/i }));
  // hasChanges is now true ("" !== "logo.jpg"), submit is enabled
  await waitFor(() => {
    const submitBtn = screen.getByRole("button", { name: /submit/i });
    expect(submitBtn).not.toBeDisabled();
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.getByText("Required")).toBeInTheDocument();
});

test("optional image-picker with empty value passes validation", async () => {
  const fields: FormField[] = [
    {
      id: "image",
      type: "image-picker" as FormFieldType,
      label: "Image",
      isRequired: false,
    },
  ];
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(AppForm, {
    props: {
      fields,
      initialValues: { image: "logo.jpg" },
      onSubmit,
    },
  });
  const changeButtons = screen.getAllByRole("button", { name: /change/i });
  await fireEvent.click(changeButtons[0]);
  await fireEvent.click(screen.getByRole("button", { name: /none/i }));
  await waitFor(() => {
    const submitBtn = screen.getByRole("button", { name: /submit/i });
    expect(submitBtn).not.toBeDisabled();
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.queryByText("Required")).not.toBeInTheDocument();
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
});

// ---------------------------------------------------------------------------
// onHasChangesChange
// ---------------------------------------------------------------------------

test("calls onHasChangesChange(true) when a field value differs from initialValues", async () => {
  const onHasChangesChange = vi.fn();
  const fields: FormField[] = [
    { id: "name", type: "string", label: "Name" },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { name: "Alice" },
      onSubmit: vi.fn(),
      onHasChangesChange,
    },
  });
  await fireEvent.input(screen.getByLabelText("Name"), {
    target: { value: "Bob" },
  });
  await waitFor(() => {
    expect(onHasChangesChange).toHaveBeenCalledWith(true);
  });
});

// ---------------------------------------------------------------------------
// Photo field — required validation and per-field state
// ---------------------------------------------------------------------------

// These two use a photo field alongside a plain field so the form isn't
// "photo-only" and the auto-submit/hide-button behavior (tested separately
// below) doesn't kick in — keeping the manual submit-button flow isolated.

test("required photo field blocks submit until a successful upload", async () => {
  const onPhotoUpload = vi.fn().mockResolvedValue({ ok: true, httpCode: 200 });
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo", isRequired: true },
    { id: "note", type: "string", label: "Note" },
  ];
  const { container } = render(AppForm, {
    props: { fields, onSubmit, onPhotoUpload },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
  });
  expect(screen.getByRole("button", { name: /photo uploaded/i })).toBeInTheDocument();
});

test("required photo field: failed upload keeps Required validation blocking submit", async () => {
  const onPhotoUpload = vi.fn().mockResolvedValue({ ok: false, httpCode: 500 });
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo", isRequired: true },
    { id: "note", type: "string", label: "Note" },
  ];
  const { container } = render(AppForm, {
    props: { fields, onSubmit, onPhotoUpload },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByText("Upload failed. Try again.")).toBeInTheDocument();
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(onSubmit).not.toHaveBeenCalled();
});

test("two AppForm instances with an identical field id don't collide in the DOM (RoutePage's carousel keeps prev/current/next cards mounted at once)", async () => {
  const onPhotoUploadA = vi.fn().mockResolvedValue({ ok: true, httpCode: 200 });
  const onPhotoUploadB = vi.fn().mockResolvedValue({ ok: true, httpCode: 200 });
  const fields: FormField[] = [
    { id: "photo", type: "photo", label: "Take a photo" },
  ];
  render(AppForm, {
    props: { fields, onSubmit: vi.fn(), onPhotoUpload: onPhotoUploadA },
  });
  render(AppForm, {
    props: { fields, onSubmit: vi.fn(), onPhotoUpload: onPhotoUploadB },
  });

  const inputs = document.querySelectorAll<HTMLInputElement>(".af-photo-input");
  expect(inputs).toHaveLength(2);
  // The camera button resolves its hidden input via document.getElementById,
  // so a shared id here would mean the button always opens whichever input
  // happens to come first in the DOM, regardless of which card is visible.
  expect(inputs[0].id).not.toBe(inputs[1].id);

  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  await fireEvent.change(inputs[1], { target: { files: [file] } });
  await waitFor(() => expect(onPhotoUploadB).toHaveBeenCalledOnce());
  expect(onPhotoUploadA).not.toHaveBeenCalled();
});

test("two photo fields track upload state independently", async () => {
  const onPhotoUpload = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, httpCode: 200 })
    .mockResolvedValueOnce({ ok: false, httpCode: 500 });
  const fields: FormField[] = [
    { id: "pic1", type: "photo", label: "Photo one" },
    { id: "pic2", type: "photo", label: "Photo two" },
  ];
  const { container } = render(AppForm, {
    props: { fields, onSubmit: vi.fn(), onPhotoUpload },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const inputs = container.querySelectorAll(".af-photo-input");
  await fireEvent.change(inputs[0], { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /photo uploaded/i })).toBeInTheDocument();
  });
  await fireEvent.change(inputs[1], { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByText("Upload failed. Try again.")).toBeInTheDocument();
  });
  expect(screen.getByRole("button", { name: /photo uploaded/i })).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Photo-only forms — auto-submit (e.g. 001_form_nieuwe_kerk.yaml: a single
// required photo field and nothing else)
// ---------------------------------------------------------------------------

test("auto-submits a photo-only form once the required photo upload succeeds, bypassing the confirm dialog", async () => {
  const onPhotoUpload = vi.fn().mockResolvedValue({ ok: true, httpCode: 200 });
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onSuccess = vi.fn();
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo", isRequired: true },
  ];
  const { container } = render(AppForm, {
    props: {
      fields,
      onSubmit,
      onPhotoUpload,
      onSuccess,
      confirmMessage: "Submit your answers?",
    },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(onSuccess).toHaveBeenCalledOnce();
  expect(screen.queryByText("Submit your answers?")).not.toBeInTheDocument();
});

test("hides the submit button entirely for a photo-only form, before and after the upload", async () => {
  const onPhotoUpload = vi.fn().mockResolvedValue({ ok: true, httpCode: 200 });
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo", isRequired: true },
  ];
  const { container } = render(AppForm, {
    props: { fields, onSubmit, onPhotoUpload },
  });
  expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(screen.queryByRole("button", { name: /submit|no changes/i })).not.toBeInTheDocument();
});

test("does not auto-submit when the form has a required field besides the photo", async () => {
  const onPhotoUpload = vi.fn().mockResolvedValue({ ok: true, httpCode: 200 });
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo", isRequired: true },
    { id: "note", type: "string", label: "Note", isRequired: true },
  ];
  const { container } = render(AppForm, {
    props: { fields, onSubmit, onPhotoUpload },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /photo uploaded/i })).toBeInTheDocument();
  });
  expect(onSubmit).not.toHaveBeenCalled();
});

test("a failed auto-submit on a photo-only form falls back to a manual retry via the visible button", async () => {
  const onPhotoUpload = vi.fn().mockResolvedValue({ ok: true, httpCode: 200 });
  const onSubmit = vi
    .fn()
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(undefined);
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo", isRequired: true },
  ];
  const { container } = render(AppForm, {
    props: { fields, onSubmit, onPhotoUpload },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  const retryBtn = await screen.findByRole("button", { name: /try again/i });
  await fireEvent.click(retryBtn);
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
});

// ---------------------------------------------------------------------------
// onStatusChange and onUploadsChange
// ---------------------------------------------------------------------------

test("onStatusChange reports missing required field labels", async () => {
  const onStatusChange = vi.fn();
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Your note", isRequired: true },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn(), onStatusChange } });
  await waitFor(() => {
    expect(onStatusChange).toHaveBeenCalledWith({ missingLabels: ["Your note"] });
  });
});

test("onStatusChange reports empty missingLabels once the required field is filled", async () => {
  const onStatusChange = vi.fn();
  const fields: FormField[] = [
    { id: "note", type: "string", label: "Your note", isRequired: true },
  ];
  render(AppForm, { props: { fields, onSubmit: vi.fn(), onStatusChange } });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "hello" },
  });
  await waitFor(() => {
    expect(onStatusChange).toHaveBeenLastCalledWith({ missingLabels: [] });
  });
});

test("onUploadsChange reports only settled upload statuses, keyed by field id", async () => {
  const onPhotoUpload = vi.fn().mockResolvedValue({ ok: true, httpCode: 200 });
  const onUploadsChange = vi.fn();
  const fields: FormField[] = [
    { id: "pic", type: "photo", label: "Take a photo" },
  ];
  const { container } = render(AppForm, {
    props: { fields, onSubmit: vi.fn(), onPhotoUpload, onUploadsChange },
  });
  const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
  const input = container.querySelector(".af-photo-input") as HTMLInputElement;
  await fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => {
    expect(onUploadsChange).toHaveBeenLastCalledWith({
      pic: { status: "success", httpCode: 200 },
    });
  });
});

test("calls onHasChangesChange(false) when value is restored to initialValues", async () => {
  const onHasChangesChange = vi.fn();
  const fields: FormField[] = [
    { id: "name", type: "string", label: "Name" },
  ];
  render(AppForm, {
    props: {
      fields,
      initialValues: { name: "Alice" },
      onSubmit: vi.fn(),
      onHasChangesChange,
    },
  });
  const input = screen.getByLabelText("Name");
  await fireEvent.input(input, { target: { value: "Bob" } });
  await fireEvent.input(input, { target: { value: "Alice" } });
  await waitFor(() => {
    expect(onHasChangesChange).toHaveBeenLastCalledWith(false);
  });
});
