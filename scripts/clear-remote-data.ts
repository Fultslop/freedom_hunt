#!/usr/bin/env node
import { createInterface } from "readline";
import { d1Query, d1Execute, runWrangler } from "./wranglerRemote";

const BUCKET_NAME = "gwc-2026-photos";
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
// Every object a `photos` row can own: image variants (photo rows always have
// full.jpg, thumb/medium are best-effort) plus the video + its poster variants
// (video rows). Deleting a suffix that was never written is a no-op in R2.
const R2_OBJECT_SUFFIXES = ["thumb.jpg", "medium.jpg", "full.jpg", "video.mp4", "video.webm"];

interface Scope {
  project: string;
  city?: string;
  route?: string;
}

interface ParsedFlags {
  project?: string;
  city?: string;
  route?: string;
  dryRun: boolean;
  skipConfirm: boolean;
}

function applyArg(arg: string, flags: ParsedFlags): void {
  if (arg === "--dry-run") {
    flags.dryRun = true;
  } else if (arg === "--yes" || arg === "-y") {
    flags.skipConfirm = true;
  } else {
    const match = arg.match(/^--(project|city|route)=(.+)$/);
    if (!match) {
      throw new Error(`Unrecognized argument: ${arg}`);
    } else {
      const [, key, value] = match;
      if (key === "project") {
        flags.project = value;
      } else if (key === "city") {
        flags.city = value;
      } else {
        flags.route = value;
      }
    }
  }
}

function validateId(name: string, value: string | undefined): void {
  if (value && !ID_PATTERN.test(value)) {
    throw new Error(`Invalid ${name} id "${value}" — only letters, numbers, underscore, hyphen allowed`);
  }
}

function parseArgs(argv: string[]): { scope: Scope; dryRun: boolean; skipConfirm: boolean } {
  const flags: ParsedFlags = { dryRun: false, skipConfirm: false };
  for (const arg of argv) {
    applyArg(arg, flags);
  }

  if (!flags.project) {
    throw new Error("Missing required --project=<id>");
  }
  if (flags.route && !flags.city) {
    throw new Error("--route requires --city");
  }
  validateId("project", flags.project);
  validateId("city", flags.city);
  validateId("route", flags.route);

  return {
    scope: { project: flags.project, city: flags.city, route: flags.route },
    dryRun: flags.dryRun,
    skipConfirm: flags.skipConfirm,
  };
}

function scopeWhereClause(scope: Scope): string {
  const clauses = [`project_id = '${scope.project}'`];
  if (scope.city) {clauses.push(`city_id = '${scope.city}'`);}
  if (scope.route) {clauses.push(`route_id = '${scope.route}'`);}
  return clauses.join(" AND ");
}

function scopeDescription(scope: Scope): string {
  return [scope.project, scope.city, scope.route].filter(Boolean).join(" / ");
}

function deleteR2Object(key: string): void {
  runWrangler(["r2", "object", "delete", `${BUCKET_NAME}/${key}`, "--remote", "--force"]);
}

async function confirm(message: string): Promise<boolean> {
  const lineReader = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => lineReader.question(`${message} `, resolve));
  lineReader.close();
  return answer.trim().toLowerCase() === "yes";
}

function deleteAllR2Objects(r2Keys: string[]): void {
  for (const key of r2Keys) {
    for (const suffix of R2_OBJECT_SUFFIXES) {
      deleteR2Object(`${key}/${suffix}`);
    }
  }
}

async function main() {
  const { scope, dryRun, skipConfirm } = parseArgs(process.argv.slice(2));
  const where = scopeWhereClause(scope);
  const description = scopeDescription(scope);

  console.log(`Scope: ${description}`);
  console.log("Querying matching rows (remote)...");

  const photoRows = d1Query(`SELECT r2_key FROM photos WHERE ${where}`);
  const r2Keys = [...new Set(photoRows.map((row) => row.r2_key as string))];

  const formCountRows = d1Query(`SELECT COUNT(*) as count FROM form_submissions WHERE ${where}`);
  const formCount = (formCountRows[0]?.count as number) ?? 0;
  const hasData = photoRows.length > 0 || formCount > 0;

  console.log(`  photos rows:           ${photoRows.length}`);
  console.log(`  R2 object groups:      ${r2Keys.length} (up to ${R2_OBJECT_SUFFIXES.length} objects each)`);
  console.log(`  form_submissions rows: ${formCount}`);
  console.log("  participant_whitelist / participant_accounts: never touched by this script.");

  if (!hasData) {
    console.log("\nNothing matches this scope — nothing to do.");
  } else if (dryRun) {
    console.log("\nDry run — no data deleted.");
  } else {
    const proceed = skipConfirm || (await confirm(
      `\nThis will PERMANENTLY delete the data above for "${description}" from the REMOTE D1 database and R2 bucket. Type "yes" to continue:`,
    ));
    if (!proceed) {
      console.log("Aborted.");
    } else {
      console.log("\nDeleting R2 objects...");
      deleteAllR2Objects(r2Keys);

      console.log("Deleting D1 rows...");
      d1Execute(`DELETE FROM photos WHERE ${where}`);
      d1Execute(`DELETE FROM form_submissions WHERE ${where}`);

      console.log(`\nDone. Cleared "${description}".`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
