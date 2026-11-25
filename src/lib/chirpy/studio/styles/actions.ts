import type { StudioActionDefinition } from "../executor";
import type { StudioActionInputs } from "../registry.generated";
import { deleteLookAction } from "./delete";
import { editLookAction } from "./edit";
import { saveLookAction } from "./save";

type StylesActionID = Extract<
  keyof StudioActionInputs,
  `studio.styles.${string}`
>;

/** Every studio.styles.* action in the contract, by id. */
export const STYLES_ACTIONS: {
  [ID in StylesActionID]: StudioActionDefinition<StudioActionInputs[ID]>;
} = {
  "studio.styles.save": saveLookAction,
  "studio.styles.edit": editLookAction,
  "studio.styles.delete": deleteLookAction,
};
