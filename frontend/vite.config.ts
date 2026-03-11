import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules[\\/]echarts-for-react[\\/]/.test(id)) {
            return "echarts-react";
          }

          if (/node_modules[\\/]zrender[\\/]/.test(id)) {
            return "zrender-vendor";
          }

          if (/node_modules[\\/]echarts[\\/]core[\\/]/.test(id) || /node_modules[\\/]echarts[\\/]renderers[\\/]/.test(id)) {
            return "echarts-core";
          }

          if (/node_modules[\\/]echarts[\\/]components[\\/]/.test(id)) {
            return "echarts-components";
          }

          if (/node_modules[\\/]echarts[\\/]charts[\\/]/.test(id)) {
            return "echarts-charts";
          }

          return undefined;
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/API": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
