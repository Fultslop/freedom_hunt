import { render, screen, waitFor, fireEvent } from "@testing-library/svelte/svelte5";
import ResultsDownloadPage from "../pages/ResultsDownloadPage.svelte";
import { fetchResultsSubmissions } from "../utils/api";
import { buildRouteIndex } from "../utils/resultsRouteIndex";

vi.mock("../utils/api", () => ({
  fetchResultsSubmissions: vi.fn(),
}));
vi.mock("../utils/resultsRouteIndex", () => ({
  buildRouteIndex: vi.fn(),
}));

const ROUTE_INDEX = {
  riverside_route: [
    { ordinal: 1, name: "Eiffel Tower", fields: [{ id: "found", type: "boolean", label: "Found?" }] },
  ],
};

const SUBMISSIONS = [
  {
    id: "s1", locationId: "1", routeId: "riverside_route", teamName: "Team A",
    answers: { found: true }, submittedAt: 100,
  },
];

beforeEach(() => {
  (buildRouteIndex as ReturnType<typeof vi.fn>).mockResolvedValue(ROUTE_INDEX);
  (fetchResultsSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true, submissions: SUBMISSIONS,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

test("renders a route section heading and the grid/report once loaded", async () => {
  render(ResultsDownloadPage, { props: { params: { project: "demo", city: "paris" } } });
  await waitFor(() => expect(screen.getByText(/riverside route/i)).toBeInTheDocument());
  expect(screen.getByRole("button", { name: /view/i })).toBeInTheDocument();
});

test("shows an empty state when there are no submissions at all", async () => {
  (fetchResultsSubmissions as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, submissions: [] });
  render(ResultsDownloadPage, { props: { params: { project: "demo", city: "paris" } } });
  await waitFor(() => expect(screen.getByText(/no results yet/i)).toBeInTheDocument());
});

test("clicking View opens the answer dialog for that submission", async () => {
  render(ResultsDownloadPage, { props: { params: { project: "demo", city: "paris" } } });
  await waitFor(() => expect(screen.getByRole("button", { name: /view/i })).toBeInTheDocument());
  await fireEvent.click(screen.getByRole("button", { name: /view/i }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

test("renders a Download button that can be clicked without throwing", async () => {
  const createUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
  const revokeUrlSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(ResultsDownloadPage, { props: { params: { project: "demo", city: "paris" } } });
  const downloadButton = await screen.findByRole("button", { name: /download/i });
  await fireEvent.click(downloadButton);
  expect(clickSpy).toHaveBeenCalled();
  clickSpy.mockRestore();
  createUrlSpy.mockRestore();
  revokeUrlSpy.mockRestore();
});
