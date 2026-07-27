import { loadText } from "../utils/loadText";
import { loadLocations } from "../utils/loadLocations";
import type { FormField, RouteEntry, LocationEntry } from "../types/data";

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
    const loc = { title: "Binnenhof" } as unknown as RouteEntry;
    vi.mocked(loadText).mockResolvedValueOnce(loc);
    const result = await loadLocations("en", [
      "projects/x/y/001_loc_binnenhof",
    ]);
    expect(result).toHaveLength(1);
    expect((result[0] as { title: string }).title).toBe("Binnenhof");
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
    } as unknown as RouteEntry);

    const result = await loadLocations("en", ["projects/test/001_loc_test"]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form).toHaveLength(1);
    expect(loc.challenge.form[0].id).toBe("form");
    expect(loc.challenge.form[0].label).toContain("inline array");
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
      } as unknown as RouteEntry)
      .mockResolvedValueOnce([
        { id: "obs", type: "string", label: "Observations", vodoo: "Baz" },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form).toHaveLength(1);
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("vodoo");
  });
});

describe("loadText content aliasing", () => {
  let realLoadText: typeof loadText;

  beforeAll(async () => {
    const mod = await vi.importActual<typeof import("../utils/loadText")>("../utils/loadText");
    realLoadText = mod.loadText;
  });

  it("resolves projects/demo/den_haag/den_haag to democrats_abroad's real content", async () => {
    const aliased = await realLoadText("en", "projects/demo/den_haag/den_haag");
    const real = await realLoadText("en", "projects/democrats_abroad/den_haag/den_haag");
    expect(aliased).toEqual(real);
    expect(aliased).not.toBeNull();
  });

  it("resolves projects/demo/den_haag/routes to democrats_abroad's real routes", async () => {
    const aliased = await realLoadText("en", "projects/demo/den_haag/routes");
    const real = await realLoadText("en", "projects/democrats_abroad/den_haag/routes");
    expect(aliased).toEqual(real);
  });

  it("resolves an oslo location path by reference", async () => {
    const aliased = await realLoadText("en", "projects/demo/oslo/oslo");
    const real = await realLoadText("en", "projects/democrats_abroad/oslo/oslo");
    expect(aliased).toEqual(real);
    expect(aliased).not.toBeNull();
  });

  it("does not alias projects/demo/demo (the project's own metadata file)", async () => {
    const result = await realLoadText("en", "projects/demo/demo");
    const wronglyAliased = await realLoadText("en", "projects/democrats_abroad/democrats_abroad");
    expect(result).not.toEqual(wronglyAliased);
  });

  it("does not alias projects/demo/paris paths", async () => {
    const result = await realLoadText("en", "projects/demo/paris/paris");
    expect(result).not.toBeNull();
  });
});
