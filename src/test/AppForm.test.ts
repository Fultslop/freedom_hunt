import { render, screen, fireEvent, waitFor } from "@testing-library/svelte/svelte5";
import AppForm from "../components/AppForm.svelte";
import type { FormField, FormFieldType } from "../types/data";

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
    { id: "note", type: "string", label: "Your note" },
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
    { id: "story", type: "textarea", label: "Your story" },
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
