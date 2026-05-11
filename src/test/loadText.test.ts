import { loadText } from "../utils/loadText";
import { loadLocations } from "../utils/loadLocations";
import type { FormField, Location } from "../types/data";

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

  it("replaces inline form array with a sentinel field", async () => {
    vi.mocked(loadText).mockResolvedValueOnce({
      title: "Test",
      name: { value: "Test Location" },
      coordinates: { latitude: 0, longitude: 0 },
      storyline: "Test storyline",
      breadcrumb: "Test breadcrumb",
      challenge: {
        name: "",
        description: "Do the thing",
        notes: "",
        form: [{ id: "field1", type: "string", label: "Some field" }],
      },
    } as unknown as Location);

    const result = await loadLocations("en", ["projects/test/001_loc_test"]);

    expect(result[0].challenge.form).toHaveLength(1);
    expect(result[0].challenge.form[0].id).toBe("form");
    expect(result[0].challenge.form[0].label).toContain("inline array");
  });

  it("replaces form fields with unknown properties with a schema_error sentinel", async () => {
    vi.mocked(loadText)
      .mockResolvedValueOnce({
        title: "Test",
        name: { value: "Test Location" },
        coordinates: { latitude: 0, longitude: 0 },
        storyline: "Test storyline",
        breadcrumb: "Test breadcrumb",
        challenge: {
          name: "",
          description: "Do the thing",
          notes: "",
          form: "001_form_test.yaml",
        },
      } as unknown as Location)
      .mockResolvedValueOnce([
        { id: "obs", type: "string", label: "Observations", vodoo: "Baz" },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    expect(result[0].challenge.form).toHaveLength(1);
    expect(result[0].challenge.form[0].type).toBe("schema_error");
    expect(result[0].challenge.form[0].label).toContain("vodoo");
  });
});
