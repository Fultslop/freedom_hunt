import { render, screen, waitFor } from "@testing-library/svelte/svelte5";
import PhotoHero from "../components/PhotoHero.svelte";
import { fetchRandomPhotos } from "../utils/api";
import type { GalleryPhoto } from "../types/gallery";

vi.mock("../utils/api", () => ({
  fetchRandomPhotos: vi.fn(),
}));

function makePhoto(id: string, team: string): GalleryPhoto {
  return {
    id,
    locationId: "1",
    taskTitle: `Task ${id}`,
    teamName: team,
    uploadedAt: 1,
    thumbUrl: `/photos/${id}/thumb`,
    mediumUrl: `/photos/${id}/medium`,
    fullUrl: `/photos/${id}/full`,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

test("renders nothing while loading", () => {
  (fetchRandomPhotos as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));
  render(PhotoHero, { props: { project: "democrats_abroad", city: "den_haag" } });
  expect(screen.queryByTestId("photo-hero-card")).not.toBeInTheDocument();
});

test("hides itself when fewer than 3 photos are returned", async () => {
  (fetchRandomPhotos as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    photos: [makePhoto("p1", "Team A"), makePhoto("p2", "Team B")],
  });
  render(PhotoHero, { props: { project: "democrats_abroad", city: "den_haag" } });
  await waitFor(() => expect(fetchRandomPhotos).toHaveBeenCalled());
  expect(screen.queryByTestId("photo-hero-card")).not.toBeInTheDocument();
});

test("shows the first photo's team and task caption once loaded", async () => {
  (fetchRandomPhotos as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    photos: [makePhoto("p1", "Team A"), makePhoto("p2", "Team B"), makePhoto("p3", "Team C")],
  });
  render(PhotoHero, { props: { project: "democrats_abroad", city: "den_haag" } });
  await waitFor(() => expect(screen.getByTestId("photo-hero-card")).toBeInTheDocument());
  expect(screen.getByText("Team A")).toBeInTheDocument();
  expect(screen.getByText("Task p1")).toBeInTheDocument();
});

test("rotates to the next photo after the interval elapses", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  (fetchRandomPhotos as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    photos: [makePhoto("p1", "Team A"), makePhoto("p2", "Team B"), makePhoto("p3", "Team C")],
  });
  render(PhotoHero, { props: { project: "democrats_abroad", city: "den_haag" } });
  await waitFor(() => expect(screen.getByTestId("photo-hero-card")).toBeInTheDocument());
  expect(screen.getByText("Team A")).toBeInTheDocument();
  await vi.advanceTimersByTimeAsync(3500);
  expect(screen.getByText("Team B")).toBeInTheDocument();
});
