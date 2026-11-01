import type { StudioActionDefinition } from "./executor";
import type { StudioActionID, StudioActionInputs } from "./registry.generated";
import { IDEAS_ACTIONS } from "./ideas/actions";

/**
 * Every server action in the contract with its executor. The mapped type makes
 * a contract action without an executor a type error; each Studio surface adds
 * its own table here.
 */
export const STUDIO_EXECUTORS: {
  [ID in StudioActionID]: StudioActionDefinition<StudioActionInputs[ID]>;
} = {
  ...IDEAS_ACTIONS,
};

export function studioExecutor(
  id: StudioActionID,
): StudioActionDefinition<unknown> {
  return STUDIO_EXECUTORS[id] as StudioActionDefinition<unknown>;
}
