import path from "node:path";
import type { WebpackOverrideFn } from "@remotion/bundler";

// Both the Remotion CLI and the preview script are started from this folder.
const here = process.cwd();

/**
 * The styles live in the web app's source tree and would otherwise load the
 * web app's copy of React next to the runner's. Two Reacts break hooks, so
 * every import resolves to the runner's copy.
 */
export const useOneReact: WebpackOverrideFn = (config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      react: path.join(here, "node_modules/react"),
      "react-dom": path.join(here, "node_modules/react-dom"),
    },
  },
});
