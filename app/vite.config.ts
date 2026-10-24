import { defineConfig, type Plugin } from "vite";

// The panel is served by Home Assistant from /local/kaoru-home/, and HA caches
// /local for 31 days. So the app is published under content-hashed names, and
// kaoru-home.js (the panel_custom module_url) is a tiny loader that reads
// manifest.json, fetched fresh on every load, then imports the current build.

const PAGE_ONLY = /\/src\/(v2\/[^/]+|weather-utils|views\/((media|weather|energy|system)-view|page)|components\/(box-remote|posters|energy-devices|light-pill|gauge))\.ts$/;
// Maison V1 and what only it uses: its own chunk, never downloaded by V2.
const V1_ONLY = /\/src\/(v1\/[^/]+|views\/(home|room|rooms)-view|components\/(hero|light-card|room-card))\.ts$/;
// Loaded on first use (a tap, a page): the details popups, the map, the Sankey, the page tiles.
const ON_DEMAND = /\/src\/(popups\/(index|details)|components\/(mini-map|sankey|tile))\.ts$/;

const LOADER = `// Kaoru Home loader: never changes; picks the current build from manifest.json.
const base = new URL(".", import.meta.url);
const res = await fetch(new URL("manifest.json?t=" + Date.now(), base), { cache: "no-store" });
const { entry } = await res.json();
await import(new URL(entry, base).href);
`;

function loader(): Plugin {
  return {
    name: "kaoru-home-loader",
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find((f) => f.type === "chunk" && f.isEntry);
      if (!entry) throw new Error("no entry chunk");
      this.emitFile({ type: "asset", fileName: "manifest.json", source: JSON.stringify({ entry: entry.fileName }) });
      this.emitFile({ type: "asset", fileName: "kaoru-home.js", source: LOADER });
    },
  };
}

export default defineConfig({
  plugins: [loader()],
  build: {
    lib: {
      entry: "src/main.ts",
      formats: ["es"],
      fileName: () => "app.js",
    },
    outDir: "../www/kaoru-home",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "app-[hash].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        // One "core" chunk for what the home views need; V1 is its own chunk;
        // each theme page, the popups and their components load on first use.
        // three.js (the plan's 3D view) is its own chunk, loaded only when 3D is chosen.
        manualChunks: (id) =>
          id.includes("node_modules/three/")
            ? "three"
            : PAGE_ONLY.test(id) || ON_DEMAND.test(id)
              ? undefined
              : V1_ONLY.test(id)
                ? "v1"
                : id.includes("/src/") || id.includes("node_modules")
                  ? "core"
                  : undefined,
      },
    },
    target: "es2022",
    minify: true,
    sourcemap: false,
  },
});
