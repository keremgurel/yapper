import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Unit tests cover the pure studio modules (clip math, durations, frame
// planning). Anything touching the DOM belongs in the browser click-through,
// not here.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
