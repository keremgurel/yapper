import type { StudioActionInputs } from "../registry.generated";
import type { StudioActionDefinition } from "../executor";
import { deleteRecordingAction } from "./recordings";
import { removeVideosAction } from "./videos";

type StorageActionID = Extract<
  keyof StudioActionInputs,
  `studio.storage.${string}`
>;

/** Every studio.storage.* action in the contract, by id. */
export const STORAGE_ACTIONS: {
  [ID in StorageActionID]: StudioActionDefinition<StudioActionInputs[ID]>;
} = {
  "studio.storage.removeVideos": removeVideosAction,
  "studio.storage.deleteRecording": deleteRecordingAction,
};
