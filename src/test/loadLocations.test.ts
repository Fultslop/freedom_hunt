import { loadLocations } from "../utils/loadLocations";
import type { LocationEntry } from "../types/data";

const { mockLoadText } = vi.hoisted(() => ({ mockLoadText: vi.fn() }));

vi.mock("../utils/loadText", () => ({ loadText: mockLoadText }));

const rawLocation = {
  title: "Binnenhof",
  name: { value: "Binnenhof" },
  coordinates: { latitude: 52.08, longitude: 4.31 },
  storyline: "s",
  breadcrumb: "b",
  challenge: { name: "", description: "d", form: [] },
};

beforeEach(() => {
  mockLoadText.mockReset();
});

test("resolves a location entry with no template-type unchanged", async () => {
  mockLoadText.mockResolvedValueOnce(rawLocation);
  const [entry] = await loadLocations("en", ["path/001"]);
  expect(entry).toMatchObject({ title: "Binnenhof" });
  expect((entry as unknown as LocationEntry)["template-type"]).toBeUndefined();
});

test("passes through a text entry unchanged", async () => {
  const raw = { "template-type": "text", title: "Intro", text: "hello" };
  mockLoadText.mockResolvedValueOnce(raw);
  const [entry] = await loadLocations("en", ["path/002"]);
  expect(entry).toEqual(raw);
});

test("passes through a splash entry unchanged", async () => {
  const raw = { "template-type": "splash", image: "x.jpg", title: "Yay" };
  mockLoadText.mockResolvedValueOnce(raw);
  const [entry] = await loadLocations("en", ["path/003"]);
  expect(entry).toEqual(raw);
});

test("passes through an options entry unchanged", async () => {
  const raw = { "template-type": "options", title: "Next?", options: [] };
  mockLoadText.mockResolvedValueOnce(raw);
  const [entry] = await loadLocations("en", ["path/004"]);
  expect(entry).toEqual(raw);
});

test("still resolves challenge.form filename references for location entries", async () => {
  mockLoadText
    .mockResolvedValueOnce({ ...rawLocation, challenge: { ...rawLocation.challenge, form: "001_form_binnenhof" } })
    .mockResolvedValueOnce([{ id: "found_it", type: "boolean", label: "Found it?" }]);
  const [entry] = await loadLocations("en", ["projects/x/y/001_loc_binnenhof"]);
  expect((entry as unknown as LocationEntry).challenge.form).toEqual([{ id: "found_it", type: "boolean", label: "Found it?" }]);
});

test("filters out entries that fail to load", async () => {
  mockLoadText.mockResolvedValueOnce(null);
  const result = await loadLocations("en", ["path/missing"]);
  expect(result).toEqual([]);
});
