import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
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

// Vite plugin: serve src/data/img/ at /assets/img/ during dev.
// This lets AssetManager's runtime fetch() work identically in dev and prod.
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

// Vite plugin: copy src/data/img/ → dist/client/assets/img/ at build time.
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

const plugins = [react(), yaml()];
if (!process.env["VITEST"]) {
  plugins.push(cloudflare());
  plugins.push(devImageServer());
  plugins.push(copyImagesPlugin());
}

export default defineConfig({
  plugins,
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    passWithNoTests: true,
  },
});
