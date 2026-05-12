import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import SubmitModal from "../pages/editor/SubmitModal.svelte";

vi.mock("svelte-spa-router", () => ({ push: vi.fn() }));

test("submitting state: shows heading and 'Opening PR' subtext for new PR", async () => {
  render(SubmitModal, {
    props: {
      state: "submitting",
      prTitle: "Add location: Binnenhof",
      isNewPr: true,
      onBack: vi.fn(),
      onRetry: vi.fn(),
    },
  });
  expect(await screen.findByText(/submitting form for review/i)).toBeInTheDocument();
  expect(screen.getByText(/Opening PR:.*Binnenhof/)).toBeInTheDocument();
});

test("submitting state: shows 'Updating PR #47' subtext when updating existing PR", async () => {
  render(SubmitModal, {
    props: {
      state: "submitting",
      prTitle: "Edit location: Binnenhof",
      isNewPr: false,
      existingPrUrl: "https://github.com/org/repo/pull/47",
      onBack: vi.fn(),
      onRetry: vi.fn(),
    },
  });
  expect(await screen.findByText(/Updating PR #47/)).toBeInTheDocument();
});

test("success state: shows heading and PR link", async () => {
  render(SubmitModal, {
    props: {
      state: "success",
      prTitle: "Add location: Binnenhof",
      isNewPr: true,
      newPrUrl: "https://github.com/org/repo/pull/42",
      onBack: vi.fn(),
      onRetry: vi.fn(),
    },
  });
  expect(await screen.findByText(/form submitted for review/i)).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /PR #42 opened/i }),
  ).toHaveAttribute("href", "https://github.com/org/repo/pull/42");
});

test("success state: shows 'updated' label when updating existing PR", async () => {
  render(SubmitModal, {
    props: {
      state: "success",
      prTitle: "Edit location: Binnenhof",
      isNewPr: false,
      existingPrUrl: "https://github.com/org/repo/pull/47",
      newPrUrl: "https://github.com/org/repo/pull/47",
      onBack: vi.fn(),
      onRetry: vi.fn(),
    },
  });
  expect(await screen.findByRole("link", { name: /PR #47 updated/i })).toBeInTheDocument();
});

test("failed state: shows heading and selectable error text", async () => {
  render(SubmitModal, {
    props: {
      state: "failed",
      prTitle: "Add location: Binnenhof",
      isNewPr: true,
      error: "GitHub API 422: branch already exists",
      onBack: vi.fn(),
      onRetry: vi.fn(),
    },
  });
  expect(await screen.findByText(/submission failed/i)).toBeInTheDocument();
  expect(screen.getByText(/GitHub API 422: branch already exists/)).toBeInTheDocument();
});

test("failed state: Retry button calls onRetry", async () => {
  const onRetry = vi.fn();
  render(SubmitModal, {
    props: {
      state: "failed",
      prTitle: "Edit location: Test",
      isNewPr: false,
      error: "Something went wrong",
      onBack: vi.fn(),
      onRetry,
    },
  });
  await screen.findByText(/submission failed/i);
  await fireEvent.click(screen.getByRole("button", { name: /retry/i }));
  expect(onRetry).toHaveBeenCalledOnce();
});

test("Back button calls onBack in all states", async () => {
  const onBack = vi.fn();
  render(SubmitModal, {
    props: {
      state: "submitting",
      prTitle: "Add location: Test",
      isNewPr: true,
      onBack,
      onRetry: vi.fn(),
    },
  });
  await screen.findByText(/submitting form for review/i);
  await fireEvent.click(screen.getByRole("button", { name: /back to location list/i }));
  expect(onBack).toHaveBeenCalledOnce();
});
