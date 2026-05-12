import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import { authStore } from "../stores/authStore";
import ChallengeForm from "../components/ChallengeForm.svelte";
import { postFormSubmit } from "../utils/api";

vi.mock("../utils/api", () => ({
  postFormSubmit: vi.fn().mockResolvedValue({ ok: true }),
  postPhotoUpload: vi.fn().mockResolvedValue({ ok: true }),
}));

const form = [
  { id: "found_it", type: "boolean" as const, label: "Did you find it?" },
  { id: "note", type: "string" as const, label: "Your note", isRequired: true },
];

beforeEach(() => {
  authStore.login("test_project", "Team A", "team@test.com");
});

afterEach(() => {
  vi.clearAllMocks();
});

test("renders form fields", () => {
  render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop" },
  });
  expect(screen.getByText("Did you find it?")).toBeInTheDocument();
  expect(screen.getByText("Your note")).toBeInTheDocument();
});

test("shows validation error when required field is empty", async () => {
  render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.getByText("Required")).toBeInTheDocument();
  expect(screen.queryByText(/submit your answers/i)).not.toBeInTheDocument();
});

test("shows confirmation dialog when all required fields are filled", async () => {
  render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop" },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.getByText(/submit your answers/i)).toBeInTheDocument();
});

test("calls postFormSubmit with correct payload on confirm", async () => {
  render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop" },
  });
  await fireEvent.input(screen.getByLabelText("Your note"), {
    target: { value: "some text" },
  });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  expect(postFormSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      locationId: 1,
      routeId: "short_loop",
      teamName: "Team A",
      contact: "team@test.com",
    }),
  );
});

test("renders two ornamental dividers framing the field list", () => {
  const { container } = render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop" },
  });
  expect(container.querySelectorAll(".cf-divider")).toHaveLength(2);
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
  render(ChallengeForm, { props: { form: multiForm, locationId: 1 } });
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
  render(ChallengeForm, { props: { form: photoForm, locationId: 1 } });
  expect(
    screen.getByRole("button", { name: /take a photo/i }),
  ).toBeInTheDocument();
});
