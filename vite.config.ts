import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@core": resolve(__dirname, "src/core"),
      "@utils": resolve(__dirname, "src/utils"),
      "@services": resolve(__dirname, "src/services"),
      "@features": resolve(__dirname, "src/features"),
      "@ui": resolve(__dirname, "src/ui"),
      "@app": resolve(__dirname, "src/app"),
    },
  },
  worker: { format: "es" },
  optimizeDeps: { include: ["pdfjs-dist", "pdf-lib"] },
});
