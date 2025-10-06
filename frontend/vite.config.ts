import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  // Load root-level .env so backend/frontend share the same configuration
  const rootEnv = loadEnv(mode, resolve(__dirname, "..", ".."), "");
  Object.assign(process.env, rootEnv);

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
    build: {
      outDir: "dist",
      sourcemap: true,
    },
  };
});
