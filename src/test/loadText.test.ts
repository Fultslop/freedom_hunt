import { loadText } from "../utils/loadText";
import { loadLocations } from "../utils/loadLocations";
import type { Location } from "../types/data";

vi.mock("../utils/loadText", () => ({
  loadText: vi.fn(),
}));

describe("loadLocations", () => {
  it("returns empty array for empty paths", async () => {
    const result = await loadLocations("en", []);
    expect(result).toEqual([]);
  });

  it("filters null results", async () => {
    vi.mocked(loadText).mockResolvedValueOnce(null);
    const result = await loadLocations("en", ["projects/x/y/missing"]);
    expect(result).toEqual([]);
  });

  it("returns loaded locations in order", async () => {
    const loc = { title: "Binnenhof" } as unknown as Location;
    vi.mocked(loadText).mockResolvedValueOnce(loc);
    const result = await loadLocations("en", [
      "projects/x/y/001_loc_binnenhof",
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Binnenhof");
  });
});
