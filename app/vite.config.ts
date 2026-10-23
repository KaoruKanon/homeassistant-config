import { defineConfig } from "vite";

// The panel is one ES module served by Home Assistant from /local/kaoru-home/.
// The folder only holds build output (main module + lazily loaded pages).
const PAGE_ONLY = /\/src\/(views\/(media|weather|energy|system)-view|views\/page|components\/(box-remote|posters|energy-devices))\.ts$/;

export default defineConfig({
  build: {
    lib: {
      entry: "src/main.ts",
      formats: ["es"],
      fileName: () => "kaoru-home.js",
    },
    outDir: "../www/kaoru-home",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        chunkFileNames: "chunks/[name]-[hash].js",
        // One "core" chunk for everything the home view needs (2 requests at
        // start); each theme page and its own components load on first visit.
        manualChunks: (id) => (PAGE_ONLY.test(id) ? undefined : id.includes("/src/") || id.includes("node_modules") ? "core" : undefined),
      },
    },
    target: "es2022",
    minify: true,
    sourcemap: false,
  },
});
