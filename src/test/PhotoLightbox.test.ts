import { render, screen, fireEvent } from "@testing-library/svelte/svelte5";
import PhotoLightbox from "../components/PhotoLightbox.svelte";
import type { GalleryPhoto } from "../types/gallery";

const PHOTO: GalleryPhoto = {
  id: "p1",
  locationId: "1",
  taskTitle: "The Final Civic Act",
  teamName: "Team A",
  uploadedAt: 1,
  thumbUrl: "/photos/p1/thumb",
  mediumUrl: "/photos/p1/medium",
  fullUrl: "/photos/p1/full",
};

test("renders nothing when photo is null", () => {
  render(PhotoLightbox, { props: { photo: null, onClose: vi.fn() } });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("shows team, task, and a download button that fetches the full-resolution variant on click", () => {
  render(PhotoLightbox, { props: { photo: PHOTO, onClose: vi.fn() } });
  expect(screen.getByText("Team A")).toBeInTheDocument();
  expect(screen.getByText("The Final Civic Act")).toBeInTheDocument();
  const downloadBtn = screen.getByRole("button", { name: /download photo/i });
  expect(downloadBtn).toBeInTheDocument();
});

test("calls onClose when the close button is clicked", async () => {
  const onClose = vi.fn();
  render(PhotoLightbox, { props: { photo: PHOTO, onClose } });
  await fireEvent.click(screen.getByLabelText("Close"));
  expect(onClose).toHaveBeenCalledOnce();
});

test("calls onClose when the backdrop is clicked", async () => {
  const onClose = vi.fn();
  render(PhotoLightbox, { props: { photo: PHOTO, onClose } });
  await fireEvent.click(screen.getByLabelText("Close photo preview"));
  expect(onClose).toHaveBeenCalledOnce();
});

test("calls onClose when Escape is pressed", async () => {
  const onClose = vi.fn();
  render(PhotoLightbox, { props: { photo: PHOTO, onClose } });
  await fireEvent.keyDown(window, { key: "Escape" });
  expect(onClose).toHaveBeenCalledOnce();
});
