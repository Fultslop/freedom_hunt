import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import Ajv from "ajv";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DATA_DIR = join(ROOT, "src", "data", "text", "en", "projects");

function loadSchema(name) {
  const schemaPath = join(ROOT, "src", "data", "schemas", name);
  return JSON.parse(readFileSync(schemaPath, "utf8"));
}

const ajv = new Ajv({ allErrors: true });
const validateLoc = ajv.compile(loadSchema("location.schema.json"));
const validateForm = ajv.compile(loadSchema("form.schema.json"));

function findFiles(dir, pattern) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      return findFiles(fullPath, pattern);
    }
    if (pattern.test(entry.name)) {
      return [fullPath];
    }
    return [];
  });
}

function formatError(err) {
  const path = err.instancePath || "(root)";
  const extra = err.params?.additionalProperty
    ? ` ('${err.params.additionalProperty}')`
    : "";
  return `${path}: ${err.message}${extra}`;
}

function checkFile(filePath, validator) {
  const content = readFileSync(filePath, "utf8");
  const data = loadYaml(content);
  if (validator(data)) {
    return [];
  }
  return (validator.errors ?? []).map(formatError);
}

const LOC_PATTERN = /^\d+_loc_.*\.yaml$/;
const FORM_PATTERN = /^\d+_form_.*\.yaml$/;

const violations = [
  ...findFiles(DATA_DIR, LOC_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateLoc).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, FORM_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateForm).map((msg) => ({ filePath, msg })),
  ),
];

violations.forEach(({ filePath, msg }) => {
  const rel = filePath.slice(ROOT.length);
  console.error(`ERROR: ${rel}: ${msg}`);
});

if (violations.length > 0) {
  process.exit(1);
}
