import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import yaml from "@modyfi/vite-plugin-yaml";
import {
  readdirSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  existsSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function getBuildVersion(): string {
  try {
    const sha = execSync("git rev-parse --short HEAD").toString().trim();
    const isoDate = execSync("git log -1 --format=%cI").toString().trim();
    const isDirty = execSync("git status --porcelain").toString().trim().length > 0;
    const date = new Date(isoDate);
    const formattedDate = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
    return `${sha}${isDirty ? "+" : ""} · ${formattedDate}`;
  } catch {
    return "unknown";
  }
}

function devImageServer() {
  return {
    name: "dev-image-server",
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use("/assets/img/", (req, res) => {
        const file = (req.url ?? "").replace(/^\//, "");
        const src = join(
          __dirname,
          "src",
          "data",
          "img",
          decodeURIComponent(file),
        );
        if (existsSync(src)) {
          const ext = file.split(".").pop()?.toLowerCase();
          const mime =
            ext === "png"
              ? "image/png"
              : ext === "webp"
                ? "image/webp"
                : "image/jpeg";
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Content-Type", mime);
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.end(readFileSync(src));
        }
      });
    },
  };
}

const START = Date.now();
const elapsed = () => `+${Date.now() - START}ms`;

function startupDiagnosticsPlugin(label: string) {
  return {
    name: `startup-diagnostics-${label}`,
    enforce: label === "pre" ? ("pre" as const) : undefined,
    configureServer(server: import("vite").ViteDevServer) {
      console.log(`[diag] ${elapsed()} ${label} plugin configureServer running`);
      if (label === "pre") {
        server.middlewares.use((req, _res, next) => {
          console.log(`[diag] ${elapsed()} incoming ${req.method} ${req.url}`);
          next();
        });
      }
      if (label === "post" && server.httpServer) {
        server.httpServer.once("listening", () => {
          const addr = server.httpServer!.address();
          console.log(`[diag] ${elapsed()} httpServer listening on ${JSON.stringify(addr)}`);
        });
      }
    },
  };
}

function copyImagesPlugin() {
  return {
    name: "copy-images",
    closeBundle() {
      const src = join(__dirname, "src", "data", "img");
      const dst = join(__dirname, "dist", "client", "assets", "img");
      mkdirSync(dst, { recursive: true });
      for (const file of readdirSync(src)) {
        copyFileSync(join(src, file), join(dst, file));
      }
    },
  };
}

export default defineConfig(async () => {
  const plugins = [svelte(), yaml(), svelteTesting()];
  if (!process.env["VITEST"]) {
    plugins.unshift(startupDiagnosticsPlugin("pre"));
    // Auto-generates a self-signed cert so the dev server serves HTTPS,
    // including over --host on a LAN IP. Needed for phone testing: browsers
    // only treat HTTPS (or localhost) as a secure context, and crypto.randomUUID()
    // plus Secure cookies (the auth cookie) both silently stop working without one.
    const { default: basicSsl } = await import("@vitejs/plugin-basic-ssl");
    plugins.push(basicSsl());
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    plugins.push(cloudflare());
    plugins.push(startupDiagnosticsPlugin("post"));
    plugins.push(devImageServer());
    plugins.push(copyImagesPlugin());
  }

  return {
    plugins,
    define: {
      __BUILD_VERSION__: JSON.stringify(getBuildVersion()),
    },
    server: {
      // Vite serves HTTP/2 (via node:http2's createSecureServer) whenever
      // HTTPS is on, UNLESS server.proxy is set — in that case it falls back
      // to plain HTTP/1.1 (node:https). We rely on that fallback: over real
      // HTTP/2, @cloudflare/vite-plugin's dev proxy to the workerd runtime
      // loses the request's actual host (no Host header in HTTP/2, and its
      // :authority isn't picked up), so request.url collapses to
      // "https://localhost/..." regardless of what host/IP the browser
      // actually connected to. That breaks checkOrigin's same-origin check
      // for any LAN IP request, rejecting it with 403 even though it's
      // legitimate. This proxy entry is never matched by any real request —
      // it exists purely to keep Vite on HTTP/1.1, where request.url is
      // built from the Host header correctly.
      proxy: {},
    },
    test: {
      environment: "happy-dom",
      globals: true,
      setupFiles: "./src/test/setup.ts",
      passWithNoTests: true,
      pool: "threads",
      singleThread: true,
      isolate: true,
      deps: {
        optimizer: {
          web: { enabled: true },
        },
      },
    },
  };
});
