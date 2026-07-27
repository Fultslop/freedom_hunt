import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import ResultsAnswerDialog from "../components/ResultsAnswerDialog.svelte";
import type { ResultsSubmission } from "../types/results";
import type { FormField } from "../types/data";

const FIELDS: FormField[] = [
  { id: "found", type: "boolean", label: "Did you find it?" },
  { id: "notes", type: "string", label: "Any notes?" },
  { id: "photo", type: "photo", label: "Upload a photo" },
];

const SUBMISSION: ResultsSubmission = {
  id: "sub-1", locationId: "1", routeId: "riverside_route", teamName: "Team A",
  answers: { found: true }, submittedAt: 1735300000,
};

test("renders nothing when submission is null", () => {
  render(ResultsAnswerDialog, {
    props: { submission: null, fields: FIELDS, submissionCount: 1, onClose: vi.fn() },
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("renders each visible field's question and formatted answer", () => {
  render(ResultsAnswerDialog, {
    props: { submission: SUBMISSION, fields: FIELDS, submissionCount: 1, onClose: vi.fn() },
  });
  expect(screen.getByText("Did you find it?")).toBeInTheDocument();
  expect(screen.getByText("Yes")).toBeInTheDocument();
  expect(screen.getByText("Any notes?")).toBeInTheDocument();
  expect(screen.getByText("No answer")).toBeInTheDocument();
});

test("omits photo fields and shows a note pointing to the Gallery", () => {
  render(ResultsAnswerDialog, {
    props: { submission: SUBMISSION, fields: FIELDS, submissionCount: 1, onClose: vi.fn() },
  });
  expect(screen.queryByText("Upload a photo")).not.toBeInTheDocument();
  expect(screen.getByText(/gallery/i)).toBeInTheDocument();
});

test("shows the submission id and a resubmission note only when submissionCount > 1", () => {
  const { rerender } = render(ResultsAnswerDialog, {
    props: { submission: SUBMISSION, fields: FIELDS, submissionCount: 1, onClose: vi.fn() },
  });
  expect(screen.getByText(/sub-1/)).toBeInTheDocument();
  expect(screen.queryByText(/latest of/i)).not.toBeInTheDocument();

  rerender({ submission: SUBMISSION, fields: FIELDS, submissionCount: 3, onClose: vi.fn() });
  expect(screen.getByText(/latest of 3/i)).toBeInTheDocument();
});

test("clicking the close button calls onClose", async () => {
  const onClose = vi.fn();
  render(ResultsAnswerDialog, {
    props: { submission: SUBMISSION, fields: FIELDS, submissionCount: 1, onClose },
  });
  const buttons = screen.getAllByRole("button", { name: /close/i });
  await fireEvent.click(buttons[0]);
  expect(onClose).toHaveBeenCalled();
});
