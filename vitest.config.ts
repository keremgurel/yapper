import { defineConfig } from "vitest/config";

// Unit tests cover the pure studio modules (clip math, durations, frame
// planning). Anything touching the DOM belongs in the browser click-through,
// not here.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include:
      process.env.RUN_INTEGRATION_TESTS === "1"
        ? ["src/**/*.integration.test.ts"]
        : ["src/**/*.test.ts"],
    exclude:
      process.env.RUN_INTEGRATION_TESTS === "1"
        ? []
        : ["src/**/*.integration.test.ts"],
    environment: "node",
  },
});
