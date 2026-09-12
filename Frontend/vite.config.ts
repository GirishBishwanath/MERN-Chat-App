import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      port: 3001,
      proxy: {
        "/api": {
          target: env.VITE_BACKEND_URL || "http://localhost:4002",
          changeOrigin: true,
        },
      },
    },
  };
});
