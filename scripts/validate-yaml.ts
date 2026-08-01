import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import Ajv, { type ValidateFunction, type ErrorObject } from "ajv";
import { parseStoryline, validateStoryline, validateStatsDoc, findStatsRefs } from "../src/utils/storylineBlocks";
import { findReservedFunctionUsage } from "../src/utils/visibility";
import type { StatsDoc } from "../src/types/storyline";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DATA_DIR = join(ROOT, "src", "data", "text", "en", "projects");
const TEXT_EN_DIR = join(ROOT, "src", "data", "text", "en");

function loadSchema(name: string): object {
  const schemaPath = join(ROOT, "src", "data", "schemas", name);
  return JSON.parse(readFileSync(schemaPath, "utf8"));
}

const ajv = new Ajv({ allErrors: true, strict: false });
const validateLoc = ajv.compile(loadSchema("location.schema.json"));
const validateForm = ajv.compile(loadSchema("form.schema.json"));
const validateText = ajv.compile(loadSchema("text.schema.json"));
const validateSplash = ajv.compile(loadSchema("splash.schema.json"));
const validateOptions = ajv.compile(loadSchema("options.schema.json"));
const validateCheckpoint = ajv.compile(loadSchema("checkpoint.schema.json"));
const validateStats = ajv.compile(loadSchema("stats.schema.json"));
const validateCompletion = ajv.compile(loadSchema("completion.schema.json"));
const validateConsent = ajv.compile(loadSchema("consent.schema.json"));
const validateConsentDefaults = ajv.compile(loadSchema("consent-defaults.schema.json"));

function findFiles(dir: string, pattern: RegExp): string[] {
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

function formatError(err: ErrorObject): string {
  const path = err.instancePath || "(root)";
  const extra = err.params?.additionalProperty
    ? ` ('${err.params.additionalProperty}')`
    : "";
  return `${path}: ${err.message}${extra}`;
}

function checkFile(filePath: string, validator: ValidateFunction): string[] {
  const content = readFileSync(filePath, "utf8");
  const data = loadYaml(content);
  if (validator(data)) {
    return [];
  }
  return (validator.errors ?? []).map(formatError);
}

function checkStorylineField(filePath: string, fieldName: string): string[] {
  const content = readFileSync(filePath, "utf8");
  const data = loadYaml(content) as Record<string, unknown>;
  const text = data[fieldName];
  if (typeof text !== "string" || !text) {
    return [];
  }
  if (text.includes(":::")) {
    return [`/${fieldName}: found ":::" — the v0.1/v0.2 fence syntax has been retired, use v0.3 markdown-native syntax`];
  }
  const refs = findStatsRefs(text);
  const dir = dirname(filePath);
  const elements = Object.fromEntries(
    refs.flatMap((ref) => {
      try {
        const refContent = readFileSync(join(dir, ref), "utf8");
        return [[ref, loadYaml(refContent)]] as const;
      } catch {
        return [];
      }
    }),
  );
  const { blocks, warnings } = parseStoryline(text, elements);
  return [...warnings, ...validateStoryline(blocks)].map((msg) => `/${fieldName}: ${msg}`);
}

function checkStatsFile(filePath: string): string[] {
  const structural = checkFile(filePath, validateStats);
  if (structural.length > 0) {
    return structural;
  }
  const content = readFileSync(filePath, "utf8");
  const doc = loadYaml(content) as StatsDoc;
  return validateStatsDoc(doc);
}

function checkVisibilityFunctions(filePath: string): string[] {
  const content = readFileSync(filePath, "utf8");
  const data = loadYaml(content);
  if (!Array.isArray(data)) {
    return [];
  }
  return findReservedFunctionUsage(data).map(
    (msg) => `${msg} (not yet implemented — see doc/superpowers/specs/2026-07-31-conditional-visibility-design.md §4.3)`,
  );
}

// A consent screen's `fields` array is authored inline (not a separate
// `*_form_*.yaml` file referenced by filename, unlike `challenge.form`), so
// it never goes through the FORM_PATTERN dispatch below. Validate it here
// against the same form.schema.json instead, or it would go entirely
// unchecked — every field-level constraint (type enum, isVisible shape,
// segmented variant, etc.) still needs to apply to it.
function checkConsentFields(filePath: string): string[] {
  const content = readFileSync(filePath, "utf8");
  const data = loadYaml(content) as { fields?: unknown };
  if (!Array.isArray(data.fields)) {
    return [];
  }
  const structural = validateForm(data.fields)
    ? []
    : (validateForm.errors ?? []).map((err) => `/fields${formatError(err)}`);
  const reservedFn = findReservedFunctionUsage(data.fields).map(
    (msg) => `${msg} (not yet implemented — see doc/superpowers/specs/2026-07-31-conditional-visibility-design.md §4.3)`,
  );
  return [...structural, ...reservedFn];
}

const FOLD_MARKER_LINE = /^\s*\[\+\]\s*(.*)$/;

function checkConsentFoldLabel(filePath: string): string[] {
  const content = readFileSync(filePath, "utf8");
  const data = loadYaml(content) as { whyWereAsking?: string };
  if (!data.whyWereAsking) {
    return [];
  }
  const lines = data.whyWereAsking.split("\n");
  const foldLine = lines.find((line) => FOLD_MARKER_LINE.test(line));
  if (!foldLine) {
    return ['/whyWereAsking: no "[+]" fold marker found — the whole field is meant to be a collapsed disclosure'];
  }
  const match = FOLD_MARKER_LINE.exec(foldLine) as RegExpExecArray;
  if (!match[1].trim()) {
    return ['/whyWereAsking: "[+]" marker has no label — would silently fall back to "Read the full story"'];
  }
  return [];
}

const LOC_PATTERN = /^\d+_loc_.*\.yaml$/;
const FORM_PATTERN = /^\d+_form_.*\.yaml$/;
const TEXT_PATTERN = /^\d+_text_.*\.yaml$/;
const SPLASH_PATTERN = /^\d+_splash_.*\.yaml$/;
const OPTIONS_PATTERN = /^\d+_options_.*\.yaml$/;
const CHECKPOINT_PATTERN = /^\d+_checkpoint_.*\.yaml$/;
const STATS_PATTERN = /^\d+_stats_.*\.yaml$/;
const COMPLETION_PATTERN = /^\d+_completion_.*\.yaml$/;
const CONSENT_PATTERN = /^\d+_consent_.*\.yaml$/;

const violations = [
  ...findFiles(DATA_DIR, LOC_PATTERN).flatMap((filePath) => [
    ...checkFile(filePath, validateLoc).map((msg) => ({ filePath, msg })),
    ...checkStorylineField(filePath, "storyline").map((msg) => ({ filePath, msg })),
  ]),
  ...findFiles(DATA_DIR, FORM_PATTERN).flatMap((filePath) => [
    ...checkFile(filePath, validateForm).map((msg) => ({ filePath, msg })),
    ...checkVisibilityFunctions(filePath).map((msg) => ({ filePath, msg })),
  ]),
  ...findFiles(DATA_DIR, TEXT_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateText).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, SPLASH_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateSplash).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, OPTIONS_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateOptions).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, CHECKPOINT_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateCheckpoint).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, STATS_PATTERN).flatMap((filePath) =>
    checkStatsFile(filePath).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, COMPLETION_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateCompletion).map((msg) => ({ filePath, msg })),
  ),
  ...findFiles(DATA_DIR, CONSENT_PATTERN).flatMap((filePath) => [
    ...checkFile(filePath, validateConsent).map((msg) => ({ filePath, msg })),
    ...checkConsentFields(filePath).map((msg) => ({ filePath, msg })),
    ...checkStorylineField(filePath, "whyWereAsking").map((msg) => ({ filePath, msg })),
    ...checkConsentFoldLabel(filePath).map((msg) => ({ filePath, msg })),
  ]),
  ...checkFile(join(TEXT_EN_DIR, "consent_defaults.yaml"), validateConsentDefaults).map((msg) => ({
    filePath: join(TEXT_EN_DIR, "consent_defaults.yaml"),
    msg,
  })),
];

violations.forEach(({ filePath, msg }) => {
  const rel = filePath.slice(ROOT.length);
  console.error(`ERROR: ${rel}: ${msg}`);
});

if (violations.length > 0) {
  process.exit(1);
}
