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

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    const { cloudflare } = await import("@cloudflare/vite-plugin");
    plugins.push(cloudflare());
    plugins.push(startupDiagnosticsPlugin("post"));
    plugins.push(devImageServer());
    plugins.push(copyImagesPlugin());
  }

  return {
    plugins,
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
