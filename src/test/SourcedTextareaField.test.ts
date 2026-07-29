import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import SourcedTextareaField from "../components/SourcedTextareaField.svelte";

test("renders the current value in the textarea", () => {
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "hello",
      sourceValue: "hello",
      touched: false,
      onChange: vi.fn(),
      onUpdateFromSource: vi.fn(),
    },
  });
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("hello");
});

test("calls onChange with the new value on input", async () => {
  const onChange = vi.fn();
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "hello",
      sourceValue: "hello",
      touched: false,
      onChange,
      onUpdateFromSource: vi.fn(),
    },
  });
  await fireEvent.input(screen.getByRole("textbox"), { target: { value: "hello world" } });
  expect(onChange).toHaveBeenCalledWith("hello world");
});

test("shows no Update button while untouched", () => {
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "hello",
      sourceValue: "newer text",
      touched: false,
      onChange: vi.fn(),
      onUpdateFromSource: vi.fn(),
    },
  });
  expect(screen.queryByRole("button", { name: /update available/i })).not.toBeInTheDocument();
});

test("shows the Update button once touched, when a source value has resolved", () => {
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "my edit",
      sourceValue: "newer text",
      touched: true,
      onChange: vi.fn(),
      onUpdateFromSource: vi.fn(),
    },
  });
  expect(screen.getByRole("button", { name: /update available/i })).toBeInTheDocument();
});

test("hides the Update button when touched but the source has never resolved", () => {
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "my edit",
      sourceValue: undefined,
      touched: true,
      onChange: vi.fn(),
      onUpdateFromSource: vi.fn(),
    },
  });
  expect(screen.queryByRole("button", { name: /update available/i })).not.toBeInTheDocument();
});

test("clicking Update shows a confirm prompt instead of applying immediately", async () => {
  const onUpdateFromSource = vi.fn();
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "my edit",
      sourceValue: "newer text",
      touched: true,
      onChange: vi.fn(),
      onUpdateFromSource,
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: /update available/i }));
  expect(screen.getByText(/replace your edits/i)).toBeInTheDocument();
  expect(onUpdateFromSource).not.toHaveBeenCalled();
});

test("confirming the update calls onUpdateFromSource and hides the confirm prompt", async () => {
  const onUpdateFromSource = vi.fn();
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "my edit",
      sourceValue: "newer text",
      touched: true,
      onChange: vi.fn(),
      onUpdateFromSource,
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: /update available/i }));
  await fireEvent.click(screen.getByRole("button", { name: /replace/i }));
  expect(onUpdateFromSource).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/replace your edits/i)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /update available/i })).toBeInTheDocument();
});

test("cancelling the confirm prompt leaves the value unchanged and re-shows the Update button", async () => {
  const onUpdateFromSource = vi.fn();
  render(SourcedTextareaField, {
    props: {
      domId: "f1",
      value: "my edit",
      sourceValue: "newer text",
      touched: true,
      onChange: vi.fn(),
      onUpdateFromSource,
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: /update available/i }));
  await fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
  expect(onUpdateFromSource).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /update available/i })).toBeInTheDocument();
});
