import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";

const schemaPath = join(__dirname, "..", "data", "schemas", "consent.schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const validDoc = {
  "template-type": "consent",
  heading: "Before you begin",
  intro: "A few things to know before you head out.",
  chips: [{ icon: "Route", text: "2.4 km" }, { icon: "Clock", text: "~2 hours" }],
  safety: { heading: "Stay safe", items: [{ icon: "Phone", text: "Call 112." }] },
  photos: { heading: "About your photos", items: [{ icon: "Eye", text: "Others can see your photos." }] },
  fields: [],
  primaryButtonText: "I understand — start the hunt",
};

test("accepts a well-formed consent entry", () => {
  expect(validate(validDoc)).toBe(true);
});

test("accepts the optional chips, privacyLinkUrl, footerText, and nav-bar fields", () => {
  expect(
    validate({
      ...validDoc,
      privacyLinkUrl: "https://example.org/privacy",
      footerText: "Questions during the hunt? Contact your organiser.",
      "nav-bar": { visible: false },
    }),
  ).toBe(true);
});

test("accepts a document with no chips (optional)", () => {
  const { chips: _chips, ...withoutChips } = validDoc;
  expect(validate(withoutChips)).toBe(true);
});

test("rejects a consent entry missing heading", () => {
  const { heading: _heading, ...withoutHeading } = validDoc;
  expect(validate(withoutHeading)).toBe(false);
});

test("rejects a safety/photos section missing items", () => {
  expect(validate({ ...validDoc, safety: { heading: "Stay safe" } })).toBe(false);
});

test("rejects a bullet item missing icon", () => {
  expect(
    validate({ ...validDoc, safety: { heading: "Stay safe", items: [{ text: "Call 112." }] } }),
  ).toBe(false);
});

test("rejects a chip missing icon", () => {
  expect(validate({ ...validDoc, chips: [{ text: "2.4 km" }] })).toBe(false);
});

test("rejects an unknown top-level property", () => {
  expect(validate({ ...validDoc, unexpected_field: true })).toBe(false);
});
