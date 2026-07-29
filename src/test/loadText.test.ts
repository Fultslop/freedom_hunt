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

  it("accepts a random_value field's values property without flagging it as unknown", async () => {
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
        {
          id: "assigned_child",
          type: "random_value",
          label: "Reveal",
          values: ["Alpha", "Beta"],
        },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form).toHaveLength(1);
    expect(loc.challenge.form[0].type).toBe("random_value");
    expect(loc.challenge.form[0].values).toEqual(["Alpha", "Beta"]);
  });

  it("passes through a valid value/storeDefaultValue on every supported type", async () => {
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
        { id: "note", type: "string", label: "Note", value: "Default text" },
        { id: "story", type: "textarea", label: "Story", value: "Default story" },
        { id: "count", type: "number", label: "Count", value: 3 },
        { id: "agree", type: "boolean", label: "Agree", value: true },
        {
          id: "time",
          type: "radio",
          label: "Time",
          options: ["Morning", "Afternoon"],
          value: "Afternoon",
        },
        {
          id: "interests",
          type: "multiple",
          label: "Interests",
          options: ["History", "Food", "Art"],
          min: 1,
          max: 2,
          value: ["History", "Art"],
          storeDefaultValue: false,
        },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form).toHaveLength(6);
    expect(loc.challenge.form.every((f) => f.type !== "schema_error")).toBe(true);
    expect(loc.challenge.form[5].storeDefaultValue).toBe(false);
  });

  it("flags value/storeDefaultValue on an unsupported field type as a schema_error", async () => {
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
        { id: "pic", type: "photo", label: "Take a photo", value: "oops" },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("not supported on type 'photo'");
  });

  it("flags a value whose JS shape doesn't match the field type as a schema_error", async () => {
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
        { id: "count", type: "number", label: "Count", value: "three" },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("must be a number");
  });

  it("flags a radio value not present in options as a schema_error", async () => {
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
        {
          id: "time",
          type: "radio",
          label: "Time",
          options: ["Morning", "Afternoon"],
          value: "Evenign",
        },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("must be one of this field's 'options'");
  });

  it("flags a multiple value with one entry not present in options as a schema_error for the whole field", async () => {
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
        {
          id: "interests",
          type: "multiple",
          label: "Interests",
          options: ["History", "Food", "Art"],
          min: 1,
          max: 2,
          value: ["History", "Musci"],
        },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("must be an array of this field's 'options'");
  });

  it("passes through a valid config.lineCount on a textarea field", async () => {
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
        { id: "story", type: "textarea", label: "Story", config: { lineCount: 8 } },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("textarea");
    expect(loc.challenge.form[0].config).toEqual({ lineCount: 8 });
  });

  it("flags config present on a non-textarea type as a schema_error", async () => {
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
        { id: "note", type: "string", label: "Note", config: { lineCount: 3 } },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("not supported on type 'string'");
  });

  it("flags an unknown config key as a schema_error", async () => {
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
        { id: "story", type: "textarea", label: "Story", config: { fontSize: 12 } },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("unknown config properties: fontSize");
  });

  it("flags a non-integer config.lineCount as a schema_error", async () => {
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
        { id: "story", type: "textarea", label: "Story", config: { lineCount: 2.5 } },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("must be a positive integer");
  });

  it("flags a non-positive config.lineCount as a schema_error", async () => {
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
        { id: "story", type: "textarea", label: "Story", config: { lineCount: 0 } },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", [
      "projects/test/city/001_loc_test",
    ]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("must be a positive integer");
  });

  it("passes through a valid source on a textarea field", async () => {
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
        {
          id: "final",
          type: "textarea",
          label: "Final manifesto",
          source: "004_loc_lange_voorhout.form.manifesto",
        },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", ["projects/test/city/001_loc_test"]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("textarea");
    expect(loc.challenge.form[0].source).toBe("004_loc_lange_voorhout.form.manifesto");
  });

  it("flags source present on a non-textarea type as a schema_error", async () => {
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
        {
          id: "note",
          type: "string",
          label: "Note",
          source: "004_loc_lange_voorhout.form.manifesto",
        },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", ["projects/test/city/001_loc_test"]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("not supported on type 'string'");
  });

  it("flags a malformed source shape as a schema_error", async () => {
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
        {
          id: "final",
          type: "textarea",
          label: "Final manifesto",
          source: "004_loc_lange_voorhout.manifesto",
        },
      ] as unknown as FormField[]);

    const result = await loadLocations("en", ["projects/test/city/001_loc_test"]);

    const loc = result[0] as unknown as LocationEntry;
    expect(loc.challenge.form[0].type).toBe("schema_error");
    expect(loc.challenge.form[0].label).toContain("must match");
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
