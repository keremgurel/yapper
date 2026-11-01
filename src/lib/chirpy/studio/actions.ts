import type { StudioActionDefinition } from "./executor";
import type { StudioActionID, StudioActionInputs } from "./registry.generated";
import { BRAND_ACTIONS } from "./brand/actions";
import { CALENDAR_ACTIONS } from "./calendar/actions";
import { IDEAS_ACTIONS } from "./ideas/actions";
import { STORAGE_ACTIONS } from "./storage/actions";
import { POSTER_ACTIONS } from "./poster/actions";

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
  ...STORAGE_ACTIONS,
  ...POSTER_ACTIONS,
  ...CALENDAR_ACTIONS,
};

export function studioExecutor(
  id: StudioActionID,
): StudioActionDefinition<unknown> {
  return STUDIO_EXECUTORS[id] as StudioActionDefinition<unknown>;
}
