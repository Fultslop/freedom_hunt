import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import Toast from "../components/Toast.svelte";

test("renders the message", () => {
  render(Toast, { props: { message: "Please complete: Your note", onDismiss: vi.fn() } });
  expect(screen.getByText("Please complete: Your note")).toBeInTheDocument();
});

test("does not render a skip button when skipLabel/onSkip are absent", () => {
  render(Toast, { props: { message: "msg", onDismiss: vi.fn() } });
  expect(screen.queryByRole("button", { name: /skip/i })).not.toBeInTheDocument();
});

test("renders and triggers the skip action when provided", async () => {
  const onSkip = vi.fn();
  render(Toast, {
    props: { message: "msg", onDismiss: vi.fn(), skipLabel: "Skip", onSkip },
  });
  await fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  expect(onSkip).toHaveBeenCalledOnce();
});

test("calls onDismiss when the close button is clicked", async () => {
  const onDismiss = vi.fn();
  render(Toast, { props: { message: "msg", onDismiss } });
  await fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
  expect(onDismiss).toHaveBeenCalledOnce();
});

test("auto-dismisses after autoDismissMs", () => {
  vi.useFakeTimers();
  const onDismiss = vi.fn();
  render(Toast, { props: { message: "msg", onDismiss, autoDismissMs: 1000 } });
  vi.advanceTimersByTime(1000);
  expect(onDismiss).toHaveBeenCalledOnce();
  vi.useRealTimers();
});
