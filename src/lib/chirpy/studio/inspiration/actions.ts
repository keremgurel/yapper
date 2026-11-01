import type { StudioActionInputs } from "../registry.generated";
import type { StudioActionDefinition } from "../executor";
import { brainstormAction } from "./brainstorm";

type InspirationActionID = Extract<
  keyof StudioActionInputs,
  `studio.inspiration.${string}`
>;

/** Every studio.inspiration.* action in the contract, by id. */
export const INSPIRATION_ACTIONS: {
  [ID in InspirationActionID]: StudioActionDefinition<StudioActionInputs[ID]>;
} = {
  "studio.inspiration.brainstorm": brainstormAction,
};
