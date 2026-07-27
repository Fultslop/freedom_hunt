import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import CheckpointGateModal from "../components/CheckpointGateModal.svelte";

test("renders the message", () => {
  render(CheckpointGateModal, { props: { message: "Please finish up", mode: "fail", onStay: vi.fn() } });
  expect(screen.getByText("Please finish up")).toBeInTheDocument();
});

test("fail mode with skippable shows Go Back and Skip, and wires each action", async () => {
  const onStay = vi.fn();
  const onProceed = vi.fn();
  render(CheckpointGateModal, {
    props: { message: "msg", mode: "fail", skippable: true, onStay, onProceed },
  });
  await fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  expect(onProceed).toHaveBeenCalledOnce();
  await fireEvent.click(screen.getByRole("button", { name: "Go Back" }));
  expect(onStay).toHaveBeenCalledOnce();
});

test("fail mode without skippable shows only Go Back", () => {
  render(CheckpointGateModal, { props: { message: "msg", mode: "fail", skippable: false, onStay: vi.fn() } });
  expect(screen.getByRole("button", { name: "Go Back" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
});

test("succeed mode shows Cancel and Continue, and wires each action", async () => {
  const onStay = vi.fn();
  const onProceed = vi.fn();
  render(CheckpointGateModal, { props: { message: "msg", mode: "succeed", onStay, onProceed } });
  await fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(onProceed).toHaveBeenCalledOnce();
  await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onStay).toHaveBeenCalledOnce();
});

test("never auto-dismisses", () => {
  vi.useFakeTimers();
  const onStay = vi.fn();
  render(CheckpointGateModal, { props: { message: "msg", mode: "fail", onStay } });
  vi.advanceTimersByTime(10_000);
  expect(onStay).not.toHaveBeenCalled();
  vi.useRealTimers();
});
