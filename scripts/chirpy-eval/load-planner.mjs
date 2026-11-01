import path from "node:path";
import { pathToFileURL } from "node:url";
import { register as registerCjs } from "tsx/cjs/api";
import { register as registerEsm } from "tsx/esm/api";
import { ROOT } from "./env.mjs";

/**
 * Import the production planner and protocol straight from src/ through tsx.
 * The eval tsconfig keeps the app's `@/` alias and swaps only the provider
 * budget for a stub, so whatever request layout planner.ts builds today is
 * what gets measured.
 */
export async function loadPlanner() {
  const tsconfig = path.join(ROOT, "scripts/chirpy-eval/tsconfig.eval.json");
  // tsx's CommonJS hooks read the tsconfig from the environment, not from
  // the register options.
  process.env.TSX_TSCONFIG_PATH = tsconfig;
  registerCjs({ tsconfig });
  registerEsm({ tsconfig });
  // The repo is not "type": "module", so tsx compiles src/ as CommonJS and
  // the named exports arrive on the namespace's default.
  const load = async (file) => {
    const mod = await import(pathToFileURL(path.join(ROOT, file)).href);
    return mod.default ?? mod;
  };
  const planner = await load("src/lib/chirpy/planner.ts");
  const protocol = await load("src/lib/chirpy/protocol.ts");
  const studio = await load("src/lib/chirpy/studio/planner.ts");
  return {
    planChirpy: planner.planChirpy,
    planStudio: studio.planStudio,
    system: planner.CHIRPY_SYSTEM,
    parsePlanInput: protocol.parsePlanInput,
    validate: protocol.validate,
  };
}
