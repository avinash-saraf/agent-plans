/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The frontend always talks to a same-origin /api, so nothing in the app
    // code knows a backend host. Dev proxies it; prod puts them behind one host.
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
