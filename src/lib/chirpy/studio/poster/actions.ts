import type { StudioActionInputs } from "../registry.generated";
import type { StudioActionDefinition } from "../executor";
import { writeCaptionsAction } from "./captions";
import { prepareAction } from "./prepare";
import { removeUploadAction } from "./remove";

type PosterActionID = Extract<
  keyof StudioActionInputs,
  `studio.poster.${string}`
>;

/** Every studio.poster.* action in the contract, by id. */
export const POSTER_ACTIONS: {
  [ID in PosterActionID]: StudioActionDefinition<StudioActionInputs[ID]>;
} = {
  "studio.poster.prepare": prepareAction,
  "studio.poster.writeCaptions": writeCaptionsAction,
  "studio.poster.removeUpload": removeUploadAction,
};
