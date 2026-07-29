import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import Ajv, { type ValidateFunction, type ErrorObject } from "ajv";
import { parseStoryline, validateStoryline, validateStatsDoc, findStatsRefs } from "../src/utils/storylineBlocks";
import type { StatsDoc } from "../src/types/storyline";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DATA_DIR = join(ROOT, "src", "data", "text", "en", "projects");

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

function checkStoryline(filePath: string): string[] {
  const content = readFileSync(filePath, "utf8");
  const data = loadYaml(content) as { storyline?: string };
  if (!data.storyline) {
    return [];
  }
  if (data.storyline.includes(":::")) {
    return ['found ":::" — the v0.1/v0.2 fence syntax has been retired, use v0.3 markdown-native syntax'];
  }
  const refs = findStatsRefs(data.storyline);
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
  const { blocks, warnings } = parseStoryline(data.storyline, elements);
  return [...warnings, ...validateStoryline(blocks)].map((msg) => `/storyline: ${msg}`);
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

const LOC_PATTERN = /^\d+_loc_.*\.yaml$/;
const FORM_PATTERN = /^\d+_form_.*\.yaml$/;
const TEXT_PATTERN = /^\d+_text_.*\.yaml$/;
const SPLASH_PATTERN = /^\d+_splash_.*\.yaml$/;
const OPTIONS_PATTERN = /^\d+_options_.*\.yaml$/;
const CHECKPOINT_PATTERN = /^\d+_checkpoint_.*\.yaml$/;
const STATS_PATTERN = /^\d+_stats_.*\.yaml$/;
const COMPLETION_PATTERN = /^\d+_completion_.*\.yaml$/;

const violations = [
  ...findFiles(DATA_DIR, LOC_PATTERN).flatMap((filePath) => [
    ...checkFile(filePath, validateLoc).map((msg) => ({ filePath, msg })),
    ...checkStoryline(filePath).map((msg) => ({ filePath, msg })),
  ]),
  ...findFiles(DATA_DIR, FORM_PATTERN).flatMap((filePath) =>
    checkFile(filePath, validateForm).map((msg) => ({ filePath, msg })),
  ),
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
];

violations.forEach(({ filePath, msg }) => {
  const rel = filePath.slice(ROOT.length);
  console.error(`ERROR: ${rel}: ${msg}`);
});

if (violations.length > 0) {
  process.exit(1);
}
