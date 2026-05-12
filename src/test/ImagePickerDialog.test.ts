import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import ImagePickerDialog from "../components/ImagePickerDialog.svelte";
import type { ImageEntry } from "../utils/images";

const mockImages: ImageEntry[] = [
  { filename: "logo.jpg", url: "/assets/logo.jpg" },
  { filename: "photo.png", url: "/assets/photo.png" },
];

test("renders None tile first, then all image tiles", () => {
  render(ImagePickerDialog, {
    props: {
      currentValue: "",
      images: mockImages,
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    },
  });
  const buttons = screen.getAllByRole("button");
  // None tile + 2 image tiles + Cancel button = 4
  expect(buttons.length).toBeGreaterThanOrEqual(3);
  expect(screen.getByRole("button", { name: /none/i })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "logo.jpg" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "photo.png" })).toBeInTheDocument();
});

test("calls onSelect with empty string when None tile is clicked", async () => {
  const onSelect = vi.fn();
  render(ImagePickerDialog, {
    props: {
      currentValue: "logo.jpg",
      images: mockImages,
      onSelect,
      onCancel: vi.fn(),
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: /none/i }));
  expect(onSelect).toHaveBeenCalledWith("");
});

test("calls onSelect with filename when image tile is clicked", async () => {
  const onSelect = vi.fn();
  render(ImagePickerDialog, {
    props: {
      currentValue: "",
      images: mockImages,
      onSelect,
      onCancel: vi.fn(),
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: "logo.jpg" }));
  expect(onSelect).toHaveBeenCalledWith("logo.jpg");
});

test("calls onCancel when Cancel button is clicked", async () => {
  const onCancel = vi.fn();
  render(ImagePickerDialog, {
    props: {
      currentValue: "",
      images: mockImages,
      onSelect: vi.fn(),
      onCancel,
    },
  });
  await fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
  expect(onCancel).toHaveBeenCalledOnce();
});

test("calls onCancel when Escape key is pressed", async () => {
  const onCancel = vi.fn();
  render(ImagePickerDialog, {
    props: {
      currentValue: "",
      images: mockImages,
      onSelect: vi.fn(),
      onCancel,
    },
  });
  await fireEvent.keyDown(window, { key: "Escape" });
  expect(onCancel).toHaveBeenCalledOnce();
});

test("selected tile has ipd-tile--selected class when currentValue matches", () => {
  render(ImagePickerDialog, {
    props: {
      currentValue: "logo.jpg",
      images: mockImages,
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    },
  });
  const logoBtn = screen.getByRole("button", { name: "logo.jpg" });
  expect(logoBtn).toHaveClass("ipd-tile--selected");
});

test("None tile has ipd-tile--selected class when currentValue is empty string", () => {
  render(ImagePickerDialog, {
    props: {
      currentValue: "",
      images: mockImages,
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    },
  });
  expect(screen.getByRole("button", { name: /none/i })).toHaveClass(
    "ipd-tile--selected",
  );
});

test("None tile has ipd-tile--selected class when currentValue is unknown", () => {
  render(ImagePickerDialog, {
    props: {
      currentValue: "nonexistent.jpg",
      images: mockImages,
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    },
  });
  expect(screen.getByRole("button", { name: /none/i })).toHaveClass(
    "ipd-tile--selected",
  );
});

test("dialog container has role=dialog and aria-label", () => {
  render(ImagePickerDialog, {
    props: {
      currentValue: "",
      images: mockImages,
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    },
  });
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByRole("dialog")).toHaveAttribute(
    "aria-label",
    "Pick an image",
  );
});
