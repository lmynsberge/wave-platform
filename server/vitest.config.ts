import { defaultExclude, defineConfig } from "vitest/config";

// The *.e2e.test.ts suites spawn the Rust core binary; they only run where it
// exists (itest CI job, or locally via `npm run test:e2e`).
export default defineConfig({
  test: {
    exclude: process.env.E2E ? [...defaultExclude] : [...defaultExclude, "**/*.e2e.test.ts"],
  },
});
