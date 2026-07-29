import { isLocationEntry, locationTotal, locationOrdinalAt, locationIdAt, isNavBarVisible } from "../utils/routeEntries";
import type { RouteEntry } from "../types/data";

const location: RouteEntry = {
  title: "Loc",
  name: { value: "Loc" },
  coordinates: { latitude: 0, longitude: 0 },
  storyline: "s",
  breadcrumb: "b",
  challenge: { name: "", description: "d", form: [] },
};

const mixed: RouteEntry[] = [
  { ...location },
  { "template-type": "text", title: "T", text: "..." },
  { ...location },
  { "template-type": "splash", image: "x.jpg", title: "S" },
  { "template-type": "options", title: "O", options: [] },
  { ...location },
];

test("isLocationEntry is true for entries with no template-type", () => {
  expect(isLocationEntry(mixed[0])).toBe(true);
});

test("isLocationEntry is true for entries with template-type: location", () => {
  expect(isLocationEntry({ ...location, "template-type": "location" })).toBe(true);
});

test("isLocationEntry is false for text/splash/options entries", () => {
  expect(isLocationEntry(mixed[1])).toBe(false);
  expect(isLocationEntry(mixed[3])).toBe(false);
  expect(isLocationEntry(mixed[4])).toBe(false);
});

test("locationTotal counts only location entries", () => {
  expect(locationTotal(mixed)).toBe(3);
});

test("locationOrdinalAt returns the 1-based count of locations up to and including index", () => {
  expect(locationOrdinalAt(mixed, 0)).toBe(1); // loc
  expect(locationOrdinalAt(mixed, 1)).toBe(1); // text — holds at last location's ordinal
  expect(locationOrdinalAt(mixed, 2)).toBe(2); // loc
  expect(locationOrdinalAt(mixed, 3)).toBe(2); // splash — still holds
  expect(locationOrdinalAt(mixed, 5)).toBe(3); // loc
});

test("isNavBarVisible defaults to true when nav-bar is absent", () => {
  expect(isNavBarVisible(location)).toBe(true);
});

test("isNavBarVisible is true when nav-bar.visible is true", () => {
  expect(isNavBarVisible({ ...location, "nav-bar": { visible: true } })).toBe(true);
});

test("isNavBarVisible is false when nav-bar.visible is false", () => {
  expect(isNavBarVisible({ ...location, "nav-bar": { visible: false } })).toBe(false);
});

test("locationIdAt returns the location id string at the given index", () => {
  expect(locationIdAt(["001_loc_a", "002_loc_b"], 1)).toBe("002_loc_b");
});

test("locationIdAt falls back to an empty string when the index is out of range", () => {
  expect(locationIdAt(["001_loc_a"], 5)).toBe("");
});
