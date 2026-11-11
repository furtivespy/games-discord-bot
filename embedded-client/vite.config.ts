import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/.proxy/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        rewrite: (requestPath) => requestPath.replace(/^\/\.proxy/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
