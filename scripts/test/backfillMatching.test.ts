import { describe, it, expect } from "vitest";
import { parseR2Key, matchPhotoToSheetRow, type SheetRow } from "../backfillMatching";

describe("parseR2Key", () => {
  it("parses the old {locationId}_{timestamp}.{ext} key format", () => {
    expect(parseR2Key("1_1731234567890.jpg")).toEqual({
      key: "1_1731234567890.jpg",
      locationId: "1",
      timestamp: 1731234567890,
    });
  });

  it("returns null for a key that doesn't match the expected format", () => {
    expect(parseR2Key("not-a-valid-key")).toBeNull();
  });
});

describe("matchPhotoToSheetRow", () => {
  const photo = { key: "1_1731234567890.jpg", locationId: "1", timestamp: 1731234567890 };

  it("matches the sheet row with the same locationId and closest timestamp", () => {
    const rows: SheetRow[] = [
      { timestamp: "1731234000000", routeId: "short_loop", locationId: "1", teamName: "Team A", email: "a@b.com", fields: "{}" },
      { timestamp: "1731234567900", routeId: "short_loop", locationId: "1", teamName: "Team B", email: "b@c.com", fields: "{}" },
      { timestamp: "1731234567890", routeId: "extended_route", locationId: "2", teamName: "Team C", email: "c@d.com", fields: "{}" },
    ];
    const result = matchPhotoToSheetRow(photo, rows);
    expect(result).toMatchObject({ matched: true, teamName: "Team B", routeId: "short_loop", contact: "b@c.com" });
  });

  it("ignores rows for a different locationId even if the timestamp is closer", () => {
    const rows: SheetRow[] = [
      { timestamp: "1731234567890", routeId: "extended_route", locationId: "2", teamName: "Team C", email: "c@d.com", fields: "{}" },
    ];
    const result = matchPhotoToSheetRow(photo, rows);
    expect(result.matched).toBe(false);
    expect(result.teamName).toBe("Unknown");
  });

  it("does not match a row outside the 10-minute window even with the same locationId", () => {
    const rows: SheetRow[] = [
      { timestamp: String(1731234567890 - 11 * 60 * 1000), routeId: "short_loop", locationId: "1", teamName: "Team A", email: "a@b.com", fields: "{}" },
    ];
    const result = matchPhotoToSheetRow(photo, rows);
    expect(result.matched).toBe(false);
    expect(result.teamName).toBe("Unknown");
  });

  it("returns an Unknown-team match when there are no candidate rows at all", () => {
    const result = matchPhotoToSheetRow(photo, []);
    expect(result).toMatchObject({ matched: false, teamName: "Unknown", routeId: null, contact: null });
  });

  it("ignores rows with a non-numeric timestamp", () => {
    const rows: SheetRow[] = [
      { timestamp: "not-a-number", routeId: "short_loop", locationId: "1", teamName: "Team A", email: "a@b.com", fields: "{}" },
    ];
    const result = matchPhotoToSheetRow(photo, rows);
    expect(result.matched).toBe(false);
  });
});
