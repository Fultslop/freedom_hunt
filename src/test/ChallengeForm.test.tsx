import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { vi } from "vitest";
import ChallengeForm from "../components/ChallengeForm";
import type { FormFieldType } from "../types/data";

vi.mock("../auth/AuthContext", () => ({
  useAuth: vi.fn(() => ({ activeAuth: null })),
}));

import { useAuth } from "../auth/AuthContext";

function Wrapper({ children }: { children: React.ReactNode }) {
  return children;
}

const stringField = {
  id: "motto",
  type: "string" as const,
  label: "What is the motto?",
};
const numberField = { id: "trees", type: "number" as const, label: "How many trees?" };
const booleanField = {
  id: "found",
  type: "boolean" as const,
  label: "Did you find it?",
};
const radioField = {
  id: "time",
  type: "radio" as const,
  label: "Time of day?",
  options: ["Morning", "Afternoon", "Evening"],
};

test("always renders submit button", () => {
  render(<ChallengeForm form={[stringField]} locationId={1} />);
  expect(
    screen.getByRole("button", { name: "Submit" }),
  ).toBeInTheDocument();
});

test("renders string field as text input", () => {
  render(<ChallengeForm form={[stringField]} locationId={1} />);
  expect(screen.getByLabelText("What is the motto?")).toHaveAttribute(
    "type",
    "text",
  );
});

test("renders number field as number input", () => {
  render(<ChallengeForm form={[numberField]} locationId={1} />);
  expect(screen.getByLabelText("How many trees?")).toHaveAttribute(
    "type",
    "number",
  );
});

test("renders boolean field as checkbox", () => {
  render(<ChallengeForm form={[booleanField]} locationId={1} />);
  expect(screen.getByLabelText("Did you find it?")).toHaveAttribute(
    "type",
    "checkbox",
  );
});

test("renders radio field with all options", () => {
  render(<ChallengeForm form={[radioField]} locationId={1} />);
  expect(screen.getByText("Time of day?")).toBeInTheDocument();
  expect(screen.getByLabelText("Morning")).toHaveAttribute("type", "radio");
  expect(screen.getByLabelText("Afternoon")).toHaveAttribute("type", "radio");
  expect(screen.getByLabelText("Evening")).toHaveAttribute("type", "radio");
});

test("renders error placeholder for unknown field type", () => {
  const bad = { id: "oops", type: "nmber" as FormFieldType, label: "Typo field" };
  render(<ChallengeForm form={[bad]} locationId={1} />);
  expect(
    screen.getByText(/Invalid field "oops".*unknown type "nmber"/),
  ).toBeInTheDocument();
});

test("renders error placeholder for radio field missing options", () => {
  const bad = { id: "pick", type: "radio" as FormFieldType, label: "Pick one" };
  render(<ChallengeForm form={[bad]} locationId={1} />);
  expect(
    screen.getByText(/Invalid field "pick".*missing options/),
  ).toBeInTheDocument();
});

test("renders error placeholder for radio field with empty options array", () => {
  const bad = { id: "pick", type: "radio" as FormFieldType, label: "Pick one", options: [] };
  render(<ChallengeForm form={[bad]} locationId={1} />);
  expect(
    screen.getByText(/Invalid field "pick".*missing options/),
  ).toBeInTheDocument();
});

test("renders submit button", () => {
  render(<ChallengeForm form={[stringField]} locationId={1} />);
  expect(
    screen.getByRole("button", { name: "Submit" }),
  ).toBeInTheDocument();
});

describe("submission validation", () => {
  test("shows error when string field is empty on submit", () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      activeAuth: { projectId: "test", teamName: "Alice", contact: "a@b.com" },
    });
    render(<ChallengeForm form={[stringField]} locationId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });

  test("shows error when number field is empty on submit", () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      activeAuth: { projectId: "test", teamName: "Alice", contact: "a@b.com" },
    });
    render(<ChallengeForm form={[numberField]} locationId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });

  test("shows error when radio field is unselected on submit", () => {
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      activeAuth: { projectId: "test", teamName: "Alice", contact: "a@b.com" },
    });
    render(<ChallengeForm form={[radioField]} locationId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByText("Please select an option")).toBeInTheDocument();
  });

  test("boolean field does not require selection", async () => {
    globalThis.fetch = vi.fn();
    vi.mocked(globalThis.fetch).mockResolvedValue({
      json: () => Promise.resolve({ ok: true }),
    } as unknown as Response);
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      activeAuth: { projectId: "test", teamName: "Alice", contact: "a@b.com" },
    });
    render(<ChallengeForm form={[booleanField]} locationId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(screen.getByText("✓ Answers submitted")).toBeInTheDocument(),
    );
    vi.restoreAllMocks();
  });

  test("does not call fetch when validation fails", () => {
    globalThis.fetch = vi.fn();
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      activeAuth: { projectId: "test", teamName: "Alice", contact: "a@b.com" },
    });
    render(<ChallengeForm form={[stringField]} locationId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(globalThis.fetch).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("submission states", () => {
  afterEach(() => vi.restoreAllMocks());

  test("POSTs correct payload to /form-submit", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      json: () => Promise.resolve({ ok: true }),
    } as unknown as Response);
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      activeAuth: { projectId: "test", teamName: "Alice", contact: "a@b.com" },
    });
    render(
      <ChallengeForm form={[stringField, booleanField]} locationId={1} />,
    );
    fireEvent.change(screen.getByLabelText("What is the motto?"), {
      target: { value: "Pro Rege" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const [url, options] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/form-submit");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body);
    expect(body.locationId).toBe("1");
    expect(body.teamName).toBe("Alice");
    expect(body.fields.motto).toBe("Pro Rege");
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("shows Submitting… while fetch is pending", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(() => new Promise(() => {}));
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      activeAuth: { projectId: "test", teamName: "Alice", contact: "a@b.com" },
    });
    render(<ChallengeForm form={[booleanField]} locationId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(screen.getByText("Submitting…")).toBeInTheDocument(),
    );
  });

  test("shows success confirmation after ok response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      json: () => Promise.resolve({ ok: true }),
    } as unknown as Response);
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      activeAuth: { projectId: "test", teamName: "Alice", contact: "a@b.com" },
    });
    render(<ChallengeForm form={[booleanField]} locationId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(screen.getByText("✓ Answers submitted")).toBeInTheDocument(),
    );
  });

  test("shows Try again after non-ok response", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      json: () => Promise.resolve({ ok: false }),
    } as unknown as Response);
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      activeAuth: { projectId: "test", teamName: "Alice", contact: "a@b.com" },
    });
    render(<ChallengeForm form={[booleanField]} locationId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(screen.getByText("Try again")).toBeInTheDocument(),
    );
    expect(
      screen.getByText("Submission failed. Please try again."),
    ).toBeInTheDocument();
  });

  test("shows Try again when fetch throws", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("Network error"));
    (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
      activeAuth: { projectId: "test", teamName: "Alice", contact: "a@b.com" },
    });
    render(<ChallengeForm form={[booleanField]} locationId={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(screen.getByText("Try again")).toBeInTheDocument(),
    );
  });
});

const photoField = { id: "proof", type: "photo" as const, label: "Photo proof" };

test("photo field does not render a form field (it renders as a separate photo section)", () => {
  render(<ChallengeForm form={[photoField]} locationId={1} />);
  const textInputs = screen.queryAllByRole("textbox");
  expect(textInputs).toHaveLength(0);
  expect(screen.getByText("Photo proof")).toBeInTheDocument();
});

test("photo field does not block submission of other fields", async () => {
  vi.mocked(globalThis.fetch).mockResolvedValue({
    json: () => Promise.resolve({ ok: true }),
  } as unknown as Response);
  (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
    activeAuth: { projectId: "test", teamName: "Alice", contact: "a@b.com" },
  });
  render(<ChallengeForm form={[booleanField, photoField]} locationId={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  await waitFor(() =>
    expect(screen.getByText("✓ Answers submitted")).toBeInTheDocument(),
  );
  vi.restoreAllMocks();
});

describe("photo upload", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("photo upload section appears before submit button when form has photo field", () => {
    render(<ChallengeForm form={[photoField]} locationId={1} />);
    const submitBtn = screen.getByRole("button", { name: "Submit" });
    const photoBtn = screen.getByTestId("submit-btn");
    const pos = submitBtn.compareDocumentPosition(photoBtn);
    expect(pos & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  test("photo button uses label from form field data", () => {
    render(<ChallengeForm form={[photoField]} locationId={1} />);
    expect(screen.getByText("Photo proof")).toBeInTheDocument();
  });

  test("shows uploading state while fetch is pending", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(() => new Promise(() => {}));
    render(<ChallengeForm form={[photoField]} locationId={1} />);
    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, {
      target: {
        files: [new File(["img"], "photo.jpg", { type: "image/jpeg" })],
      },
    });
    await waitFor(() =>
      expect(screen.getByText("Uploading…")).toBeInTheDocument(),
    );
  });

  test("shows success confirmation after upload", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      json: () => Promise.resolve({ ok: true }),
    } as unknown as Response);
    render(<ChallengeForm form={[photoField]} locationId={1} />);
    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, {
      target: {
        files: [new File(["img"], "photo.jpg", { type: "image/jpeg" })],
      },
    });
    await waitFor(() =>
      expect(screen.getByText("✓ Photo submitted")).toBeInTheDocument(),
    );
  });

  test("shows retry button on failed upload", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      json: () => Promise.resolve({ ok: false }),
    } as unknown as Response);
    render(<ChallengeForm form={[photoField]} locationId={1} />);
    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, {
      target: {
        files: [new File(["img"], "photo.jpg", { type: "image/jpeg" })],
      },
    });
    await waitFor(() =>
      expect(screen.getByText("Try again")).toBeInTheDocument(),
    );
  });
});
