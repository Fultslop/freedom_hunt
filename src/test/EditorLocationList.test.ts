import { render, screen } from "@testing-library/svelte/svelte5";
import EditorLocationList from "../pages/editor/EditorLocationList.svelte";

vi.mock("svelte-spa-router", () => ({
  push: vi.fn(),
  replace: vi.fn(),
}));

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    json: async () => ({
      ok: true,
      locations: [
        {
          filename: "001_loc_binnenhof.yaml",
          sha: "abc123",
          location: {
            locationId: 1,
            title: "Binnenhof",
            address: "Binnenhof 1",
            coordinates: { latitude: 52.0799, longitude: 4.3133 },
            storyline: "",
            breadcrumb: "",
            name: { label: "", value: "Binnenhof" },
            challenge: { name: "", description: "", notes: "", form: [] },
          },
        },
      ],
    }),
  } as Response);
});

test("renders location list", async () => {
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  expect(await screen.findByText("Binnenhof")).toBeInTheDocument();
});

test("renders Add location button", async () => {
  render(EditorLocationList, {
    props: { params: { project: "democrats_abroad", city: "den_haag" } },
  });
  expect(await screen.findByRole("button", { name: /add location/i })).toBeInTheDocument();
});
