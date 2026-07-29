import { execFileSync } from "child_process";
import { createRequire } from "module";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
// Resolve wrangler's actual JS entrypoint and invoke it via `node <entry>` directly
// rather than shelling out to the `wrangler`/`wrangler.cmd` shim — avoids the
// shell-quoting pitfalls of exec-with-shell:true (arguments here contain
// spaces/quotes, e.g. full SQL statements) and works identically cross-platform.
const WRANGLER_BIN = join(dirname(require.resolve("wrangler/package.json")), "bin", "wrangler.js");

export const DATABASE_BINDING = "AUTH_DB";

export function runWrangler(args: string[]): string {
  return execFileSync(process.execPath, [WRANGLER_BIN, ...args], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 32,
  });
}

export function d1Query(sql: string): Record<string, unknown>[] {
  const output = runWrangler(["d1", "execute", DATABASE_BINDING, "--remote", "--json", "--command", sql]);
  const parsed = JSON.parse(output) as Array<{ results?: Record<string, unknown>[] }>;
  return parsed[0]?.results ?? [];
}

export function d1Execute(sql: string): void {
  runWrangler(["d1", "execute", DATABASE_BINDING, "--remote", "--json", "--yes", "--command", sql]);
}
