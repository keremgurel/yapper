import type { StudioActionInputs } from "../registry.generated";
import type { StudioActionDefinition } from "../executor";
import { updateAutomationAction } from "./update";

type AutomationsActionID = Extract<
  keyof StudioActionInputs,
  `studio.automations.${string}`
>;

/** Every studio.automations.* action in the contract, by id. Retrying a
 * failed copy posts it, so it is excluded rather than registered. */
export const AUTOMATIONS_ACTIONS: {
  [ID in AutomationsActionID]: StudioActionDefinition<StudioActionInputs[ID]>;
} = {
  "studio.automations.update": updateAutomationAction,
};
