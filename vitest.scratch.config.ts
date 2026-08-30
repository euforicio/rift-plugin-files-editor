import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: [
      { find: /^@get-bb\/plugin-sdk\/app$/, replacement: path.resolve(__dirname, "scratch/sdk-mock.tsx") },
      { find: /^sonner$/, replacement: path.resolve(__dirname, "scratch/sonner-mock.ts") },
      { find: /^@\//, replacement: path.resolve(__dirname) + "/" },
    ],
  },
  test: {
    environment: "jsdom",
    include: ["scratch/**/*.test.tsx"],
  },
});
