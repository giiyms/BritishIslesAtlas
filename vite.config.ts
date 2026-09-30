import { defineConfig } from "vite";

export default defineConfig({
  optimizeDeps: {
    // MapLibre v6 resolves its worker from import.meta.url. Prebundling
    // points that URL at a file Vite never emits.
    exclude: ["maplibre-gl"],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
