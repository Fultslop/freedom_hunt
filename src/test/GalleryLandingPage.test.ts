import { render, screen, waitFor, fireEvent } from "@testing-library/svelte/svelte5";
import GalleryLandingPage from "../pages/GalleryLandingPage.svelte";
import { loadText } from "../utils/loadText";

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn().mockResolvedValue({}),
}));

vi.mock("../utils/api", () => ({
  fetchRandomPhotos: vi.fn().mockResolvedValue({ ok: true, photos: [] }),
  fetchGalleryPhotos: vi.fn().mockResolvedValue({ ok: true, photos: [] }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

test("renders the project/city title", () => {
  render(GalleryLandingPage, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  expect(screen.getByText("democrats abroad Scavenger Hunt")).toBeInTheDocument();
});

test("does not render an organizer link when the project YAML has no organizer_url", async () => {
  render(GalleryLandingPage, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  await waitFor(() => expect(loadText).toHaveBeenCalled());
  expect(screen.queryByRole("link", { name: /event organizer/i })).not.toBeInTheDocument();
});

test("renders an organizer link that opens in a new tab when organizer_url is set", async () => {
  (loadText as ReturnType<typeof vi.fn>).mockResolvedValue({ organizer_url: "https://example.org" });
  render(GalleryLandingPage, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  const link = await screen.findByRole("link", { name: /event organizer/i });
  expect(link).toHaveAttribute("href", "https://example.org");
  expect(link).toHaveAttribute("target", "_blank");
});

test("'Browse All Photos' scrolls the gallery grid into view", async () => {
  render(GalleryLandingPage, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  const scrollSpy = vi.fn();
  const gallery = document.getElementById("gallery");
  if (gallery) {
    gallery.scrollIntoView = scrollSpy;
  }
  await fireEvent.click(screen.getByRole("button", { name: /browse all photos/i }));
  expect(scrollSpy).toHaveBeenCalled();
});

test("'Find / Download My Photos' scrolls to the gallery and focuses the team filter", async () => {
  render(GalleryLandingPage, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  await waitFor(() => expect(document.getElementById("gallery-team-filter")).toBeInTheDocument());
  const gallery = document.getElementById("gallery");
  const select = document.getElementById("gallery-team-filter") as unknown as HTMLSelectElement;
  if (gallery) {
    gallery.scrollIntoView = vi.fn();
  }
  const focusSpy = vi.spyOn(select, "focus");
  await fireEvent.click(screen.getByRole("button", { name: /find.*download my photos/i }));
  expect(focusSpy).toHaveBeenCalled();
});
