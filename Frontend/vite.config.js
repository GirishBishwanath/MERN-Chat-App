import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Use a function so we can access 'mode' and 'loadEnv'
export default defineConfig(({ mode }) => {
  // This line defines 'env' by reading your .env file
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 3001,
      proxy: {
        "/api": {
          // Now 'env' actually exists!
          target: env.VITE_BACKEND_URL || "http://localhost:4002",
          changeOrigin: true,
        },
      },
    },
  };
});
