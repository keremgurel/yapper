import { defineConfig } from "vitest/config";

// Unit tests cover the pure studio modules (clip math, durations, frame
// planning). Anything touching the DOM belongs in the browser click-through,
// not here.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
