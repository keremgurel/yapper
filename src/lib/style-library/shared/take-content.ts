import { mediaOption } from "../format/option-builders";

/** The content every layout needs: the take itself. A template fills it from the project. */
export const takeContent = {
  take: mediaOption({ label: "The take", accepts: ["video"] }),
} as const;

export type TakeContentSpecs = typeof takeContent;
