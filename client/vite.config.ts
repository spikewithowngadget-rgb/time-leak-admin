import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "serve" ? "/" : "/app-assets/",
  build: { outDir: "../web/app", emptyOutDir: true },
  server: { port: 5173 },
}));
