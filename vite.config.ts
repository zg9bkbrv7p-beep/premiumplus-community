import { defineConfig } from "vite";
export default defineConfig({
  server: { host: "0.0.0.0" },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three", "three/addons/controls/OrbitControls.js"],
        },
      },
    },
  },
});
