import { render, screen, waitFor, fireEvent } from "@testing-library/svelte/svelte5";
import PhotoGallery from "../components/PhotoGallery.svelte";
import { fetchGalleryPhotos } from "../utils/api";
import type { GalleryPhoto } from "../types/gallery";

vi.mock("../utils/api", () => ({
  fetchGalleryPhotos: vi.fn(),
}));

function makePhoto(id: string, team: string, task: string): GalleryPhoto {
  return {
    id,
    locationId: "1",
    taskTitle: task,
    teamName: team,
    uploadedAt: 1,
    thumbUrl: `/photos/${id}/thumb`,
    mediumUrl: `/photos/${id}/medium`,
    fullUrl: `/photos/${id}/full`,
  };
}

const PHOTOS = [
  makePhoto("p1", "Team A", "Plaque"),
  makePhoto("p2", "Team B", "Plaque"),
  makePhoto("p3", "Team A", "Statue"),
];

beforeEach(() => {
  (fetchGalleryPhotos as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, photos: PHOTOS });
});

afterEach(() => {
  vi.clearAllMocks();
});

test("renders all photos once loaded", async () => {
  render(PhotoGallery, {
    props: { project: "democrats_abroad", city: "den_haag", onSelectPhoto: vi.fn() },
  });
  await waitFor(() => expect(screen.getAllByTestId("photo-thumb")).toHaveLength(3));
});

test("filtering by team shows only that team's photos", async () => {
  render(PhotoGallery, {
    props: { project: "democrats_abroad", city: "den_haag", onSelectPhoto: vi.fn() },
  });
  await waitFor(() => expect(screen.getAllByTestId("photo-thumb")).toHaveLength(3));
  await fireEvent.change(screen.getByLabelText("Team"), { target: { value: "Team A" } });
  expect(screen.getAllByTestId("photo-thumb")).toHaveLength(2);
});

test("filtering by task shows only matching photos", async () => {
  render(PhotoGallery, {
    props: { project: "democrats_abroad", city: "den_haag", onSelectPhoto: vi.fn() },
  });
  await waitFor(() => expect(screen.getAllByTestId("photo-thumb")).toHaveLength(3));
  await fireEvent.change(screen.getByLabelText("Task"), { target: { value: "Statue" } });
  expect(screen.getAllByTestId("photo-thumb")).toHaveLength(1);
});

test("shows empty state when there are no photos at all", async () => {
  (fetchGalleryPhotos as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, photos: [] });
  render(PhotoGallery, {
    props: { project: "democrats_abroad", city: "den_haag", onSelectPhoto: vi.fn() },
  });
  await waitFor(() => expect(screen.getByText("No photos yet.")).toBeInTheDocument());
});

test("shows a filtered-empty message when filters match no photos", async () => {
  render(PhotoGallery, {
    props: { project: "democrats_abroad", city: "den_haag", onSelectPhoto: vi.fn() },
  });
  await waitFor(() => expect(screen.getAllByTestId("photo-thumb")).toHaveLength(3));
  await fireEvent.change(screen.getByLabelText("Team"), { target: { value: "Team B" } });
  await fireEvent.change(screen.getByLabelText("Task"), { target: { value: "Statue" } });
  expect(screen.getByText("No photos match your filters.")).toBeInTheDocument();
});

test("clicking a thumbnail calls onSelectPhoto with that photo", async () => {
  const onSelectPhoto = vi.fn();
  render(PhotoGallery, {
    props: { project: "democrats_abroad", city: "den_haag", onSelectPhoto },
  });
  await waitFor(() => expect(screen.getAllByTestId("photo-thumb")).toHaveLength(3));
  await fireEvent.click(screen.getAllByTestId("photo-thumb")[0]);
  expect(onSelectPhoto).toHaveBeenCalledWith(PHOTOS[0]);
});
