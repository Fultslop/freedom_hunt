import { getNextLocationId, locationFilenameToString, tryParseLocationName } from "../pages/editor/editorUtils";

describe("getNextLocationId", () => {
  it("returns 0 for an empty list", () => {
    expect(getNextLocationId([])).toBe(0);
  });

  it("returns 1 for a list with one valid id", () => {
    expect(getNextLocationId(["001_file1"])).toBe(2);
  });

  it("returns the correct next id for a list with multiple valid ids", () => {
    expect(getNextLocationId(["001_file1", "002_file2", "003_file3"])).toBe(4);
  });
});

describe("tryParseLocationName", () => {
  it("returns null for an null or undefined filename", () => {
    expect(tryParseLocationName(null)).toBeNull();
    expect(tryParseLocationName(undefined)).toBeNull();
  });

  it("returns null for an filename which is too short", () => {
    // should be rejected because it doesn't have enough characters to accommodate a valid location name and extension
    expect(tryParseLocationName("01234567")).toBeNull();
  });

  it("should reject an invalid location index", () => {
    expect(tryParseLocationName("1_loc_file1.yaml")).toBeNull();
    expect(tryParseLocationName("01_loc_file1.yaml")).toBeNull();
    expect(tryParseLocationName("a01_loc_file1.yaml")).toBeNull();
    expect(tryParseLocationName("10b_loc_file1.yaml")).toBeNull();
  });

  it("should parse a valid location ", () => {
    const location1 = tryParseLocationName("001_loc_file1.yaml");
    expect(location1).not.toBeNull();
    expect(location1?.id).toBe(1);
    expect(location1?.title).toBe("file1");
    expect(location1  ?.extension).toBe("yaml");

    const location2 = tryParseLocationName("942_loc_abc_def.json");
    expect(location2).not.toBeNull();
    expect(location2?.id).toBe(942);
    expect(location2?.title).toBe("abc_def");
    expect(location2  ?.extension).toBe("json");
  });
});

describe("locationFilenameToString", () => {
  it("should create a valid location filename", () => {
    const location = { id: 1, title: "file1", extension: "yaml" };
    expect(locationFilenameToString(location)).toBe("001_loc_file1.yaml");
  });

  it("should remove special characters from the title", () => {
    const location = { id: 42, title: "*file1", extension: "txt" };
    expect(locationFilenameToString(location)).toBe("042_loc_file1.txt");
  });

  it("should cut off index if it exceeds the maximum length", () => {
    const location = { id: 1042, title: "*file1", extension: "txt" };
    const result = locationFilenameToString(location);
    expect(result).toBe("104_loc_file1.txt");
  });
});