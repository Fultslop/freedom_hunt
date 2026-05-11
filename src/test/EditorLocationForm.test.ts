import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/svelte/svelte5";
import EditorLocationForm from "../pages/editor/EditorLocationForm.svelte";

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
}));

test("renders form in new-location mode", async () => {
  render(EditorLocationForm, {
    props: {
      params: { project: "democrats_abroad", city: "den_haag", newId: 0 },
    },
  });
  expect(
    await screen.findByRole("button", { name: /submit for review/i }),
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
