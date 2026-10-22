import { defineConfig } from "vite";

// The panel is one ES module served by Home Assistant from /local/kaoru-home/.
// Fonts in www/kaoru-home/fonts are committed; only the bundle is built.
export default defineConfig({
  build: {
    lib: {
      entry: "src/main.ts",
      formats: ["es"],
      fileName: () => "kaoru-home.js",
    },
    outDir: "../www/kaoru-home",
    emptyOutDir: false,
    target: "es2022",
    minify: true,
    sourcemap: false,
  },
});
