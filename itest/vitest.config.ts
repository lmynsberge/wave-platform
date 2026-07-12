import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./src/global-setup.ts",
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    include: ["tests/**/*.itest.ts"],
  },
});
