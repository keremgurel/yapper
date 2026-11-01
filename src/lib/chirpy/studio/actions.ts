import type { StudioActionDefinition } from "./executor";
import type { StudioActionID, StudioActionInputs } from "./registry.generated";
import { BRAND_ACTIONS } from "./brand/actions";
import { CANVAS_ACTIONS } from "./canvas/actions";
import { IDEAS_ACTIONS } from "./ideas/actions";
import { INSPIRATION_ACTIONS } from "./inspiration/actions";

/**
 * Every server action in the contract with its executor. The mapped type makes
 * a contract action without an executor a type error; each Studio surface adds
 * its own table here.
 */
export const STUDIO_EXECUTORS: {
  [ID in StudioActionID]: StudioActionDefinition<StudioActionInputs[ID]>;
} = {
  ...IDEAS_ACTIONS,
  ...BRAND_ACTIONS,
  ...CANVAS_ACTIONS,
  ...INSPIRATION_ACTIONS,
};

export function studioExecutor(
  id: StudioActionID,
): StudioActionDefinition<unknown> {
  return STUDIO_EXECUTORS[id] as StudioActionDefinition<unknown>;
}
