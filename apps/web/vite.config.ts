import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// `pnpm build` → dist/ (static site, serve over http).
// `pnpm build:single` → dist-single/index.html: one self-contained file that opens directly from disk (offline laptops).
export default defineConfig(({ mode }) => ({
  base: "./",
  server: { fs: { allow: ["../.."] } },
  plugins: mode === "single" ? [viteSingleFile()] : [],
  build: { target: "es2022", chunkSizeWarningLimit: 2000, outDir: mode === "single" ? "dist-single" : "dist" },
}));
