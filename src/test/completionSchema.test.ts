import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";

const schemaPath = join(__dirname, "..", "data", "schemas", "completion.schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const validDoc = {
  "template-type": "completion",
  image: "lange-vijverberg.jpg",
  title: "You made it.",
  subtitle: "Democrats Abroad 2026 Scavenger Hunt",
  place: "The Hague · short loop",
  registration: {
    text: "Check your voter registration",
    url: "https://www.democratsabroad.org/nl",
  },
};

test("accepts a well-formed completion entry", () => {
  expect(validate(validDoc)).toBe(true);
});

test("accepts the optional caption, closing_text, hint, and nav-bar fields", () => {
  expect(
    validate({
      ...validDoc,
      caption: "Recorded 29 July 2026.",
      closing_text: "Thank you.",
      hint: "Takes about 2 minutes.",
      "nav-bar": { visible: false },
    }),
  ).toBe(true);
});

test("rejects a completion entry missing registration", () => {
  const { registration: _registration, ...withoutRegistration } = validDoc;
  expect(validate(withoutRegistration)).toBe(false);
});

test("rejects a registration object missing url", () => {
  expect(validate({ ...validDoc, registration: { text: "Check" } })).toBe(false);
});

test("rejects an unknown top-level property", () => {
  expect(validate({ ...validDoc, unexpected_field: true })).toBe(false);
});
