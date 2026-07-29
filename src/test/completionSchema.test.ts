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
  buttons: [
    {
      text: "Check your voter registration",
      target: { type: "link", value: "https://www.democratsabroad.org/nl" },
    },
    {
      text: "See your results",
      target: { type: "page", value: "results" },
      color: "secondary",
    },
  ],
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

test("rejects a completion entry missing buttons", () => {
  const { buttons: _buttons, ...withoutButtons } = validDoc;
  expect(validate(withoutButtons)).toBe(false);
});

test("rejects an empty buttons array", () => {
  expect(validate({ ...validDoc, buttons: [] })).toBe(false);
});

test("rejects a button missing target", () => {
  expect(validate({ ...validDoc, buttons: [{ text: "Go" }] })).toBe(false);
});

test("rejects a page-target button with value 'start_route'", () => {
  expect(
    validate({
      ...validDoc,
      buttons: [{ text: "Go", target: { type: "page", value: "start_route" } }],
    }),
  ).toBe(false);
});

test("rejects an unknown top-level property", () => {
  expect(validate({ ...validDoc, unexpected_field: true })).toBe(false);
});
