import { describe, it, expect, vi } from "vitest";
import { buildRouteIndex } from "../utils/resultsRouteIndex";
import { loadText } from "../utils/loadText";
import { loadLocations } from "../utils/loadLocations";

vi.mock("../utils/loadText");
vi.mock("../utils/loadLocations");

const ROUTES_DATA = {
  riverside_route: { description: "...", locations: ["001_loc_eiffel", "002_text_bridge", "003_loc_louvre"] },
};

const RIVERSIDE_ENTRIES = [
  {
    "template-type": "location", title: "Eiffel Tower", name: { value: "Eiffel Tower" },
    challenge: { name: "", description: "", form: [{ id: "found", type: "boolean", label: "Found it?" }] },
  },
  { "template-type": "text", title: "Bridge", text: "..." },
  {
    "template-type": "location", title: "Louvre", name: { value: "The Louvre" },
    challenge: { name: "", description: "" },
  },
];

describe("buildRouteIndex", () => {
  it("returns an empty object when the city has no routes.yaml", async () => {
    (loadText as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const result = await buildRouteIndex("en", "demo", "unknown_city");
    expect(result).toEqual({});
  });

  it("only counts location-type entries toward ordinal, skipping non-location entries", async () => {
    (loadText as ReturnType<typeof vi.fn>).mockResolvedValue(ROUTES_DATA);
    (loadLocations as ReturnType<typeof vi.fn>).mockResolvedValue(RIVERSIDE_ENTRIES);
    const result = await buildRouteIndex("en", "demo", "paris");
    expect(result.riverside_route.map((entry) => entry.ordinal)).toEqual([1]);
  });

  it("excludes location entries that have no form", async () => {
    (loadText as ReturnType<typeof vi.fn>).mockResolvedValue(ROUTES_DATA);
    (loadLocations as ReturnType<typeof vi.fn>).mockResolvedValue(RIVERSIDE_ENTRIES);
    const result = await buildRouteIndex("en", "demo", "paris");
    expect(result.riverside_route).toHaveLength(1);
    expect(result.riverside_route[0].name).toBe("Eiffel Tower");
  });

  it("passes the correct loadLocations paths for a route", async () => {
    (loadText as ReturnType<typeof vi.fn>).mockResolvedValue(ROUTES_DATA);
    (loadLocations as ReturnType<typeof vi.fn>).mockResolvedValue(RIVERSIDE_ENTRIES);
    await buildRouteIndex("en", "demo", "paris");
    expect(loadLocations).toHaveBeenCalledWith("en", [
      "projects/demo/paris/001_loc_eiffel",
      "projects/demo/paris/002_text_bridge",
      "projects/demo/paris/003_loc_louvre",
    ]);
  });
});
