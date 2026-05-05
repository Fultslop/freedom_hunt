import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import { authStore } from "../stores/authStore";
import ChallengeForm from "../components/ChallengeForm.svelte";

const form = [
  { id: "found_it", type: "boolean" as const, label: "Did you find it?" },
  { id: "note", type: "string" as const, label: "Your note" },
];

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    json: async () => ({ ok: true }),
  } as Response);
  authStore.login("test_project", "Team A", "team@test.com");
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("renders form fields", () => {
  render(ChallengeForm, { props: { form, locationId: 1, routeId: "short_loop" } });
  expect(screen.getByText("Did you find it?")).toBeInTheDocument();
  expect(screen.getByText("Your note")).toBeInTheDocument();
});

test("shows confirmation dialog on submit", async () => {
  render(ChallengeForm, { props: { form, locationId: 1, routeId: "short_loop" } });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(screen.getByText(/submit your answers/i)).toBeInTheDocument();
});

test("submits on confirm", async () => {
  render(ChallengeForm, { props: { form, locationId: 1, routeId: "short_loop" } });
  await fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  await fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
  expect(fetch).toHaveBeenCalledWith("/form-submit", expect.objectContaining({ method: "POST" }));
});

test("renders two ornamental dividers framing the field list", () => {
  const { container } = render(ChallengeForm, {
    props: { form, locationId: 1, routeId: "short_loop" },
  });
  expect(container.querySelectorAll(".cf-divider")).toHaveLength(2);
});

test("photo field renders nothing", () => {
  const photoForm = [{ id: "pic", type: "photo" as const, label: "Photo" }];
  render(ChallengeForm, { props: { form: photoForm, locationId: 1 } });
  expect(screen.queryByText("Photo")).not.toBeInTheDocument();
});