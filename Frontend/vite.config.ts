import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      port: 3001,
      strictPort: true,
      proxy: {
        "/api": {
          target:
            env.VITE_DEV_PROXY_TARGET ||
            env.VITE_BACKEND_URL ||
            "http://localhost:4002",
          changeOrigin: true,
        },
      },
      watch:
        env.VITE_USE_POLLING === "true"
          ? { usePolling: true, interval: 200 }
          : undefined,
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test/setup.ts",
      css: true,
    },
  };
});
