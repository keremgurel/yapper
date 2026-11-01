import type { StudioActionInputs } from "../registry.generated";
import type { StudioActionDefinition } from "../executor";
import { colorsAction } from "./colors";
import { deleteLogoAction, makePrimaryLogoAction } from "./logos";

type BrandActionID = Extract<
  keyof StudioActionInputs,
  `studio.brand.${string}`
>;

/** Every studio.brand.* action in the contract, by id. */
export const BRAND_ACTIONS: {
  [ID in BrandActionID]: StudioActionDefinition<StudioActionInputs[ID]>;
} = {
  "studio.brand.colors": colorsAction,
  "studio.brand.logos.makePrimary": makePrimaryLogoAction,
  "studio.brand.logos.delete": deleteLogoAction,
};
