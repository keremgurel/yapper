import type { StudioActionInputs } from "../registry.generated";
import type { StudioActionDefinition } from "../executor";
import type { CanvasActionID } from "../canvas/actions";
import { captureAction } from "./capture";
import { deleteAction } from "./delete";
import {
  renameAction,
  scheduleAction,
  setPillarAction,
  setStatusAction,
  unscheduleAction,
} from "./edits";
import { importAction } from "./import";
import {
  draftAction,
  deleteVersionAction,
  writeVersionAction,
} from "./versions";
import { createViewAction, deleteViewAction, updateViewAction } from "./views";

type IdeasActionID = Exclude<
  Extract<keyof StudioActionInputs, `studio.ideas.${string}`>,
  CanvasActionID
>;

/** Every studio.ideas.* action in the contract except the canvas's, by id. */
export const IDEAS_ACTIONS: {
  [ID in IdeasActionID]: StudioActionDefinition<StudioActionInputs[ID]>;
} = {
  "studio.ideas.capture": captureAction,
  "studio.ideas.rename": renameAction,
  "studio.ideas.setStatus": setStatusAction,
  "studio.ideas.setPillar": setPillarAction,
  "studio.ideas.schedule": scheduleAction,
  "studio.ideas.unschedule": unscheduleAction,
  "studio.ideas.delete": deleteAction,
  "studio.ideas.draft": draftAction,
  "studio.ideas.writeVersion": writeVersionAction,
  "studio.ideas.deleteVersion": deleteVersionAction,
  "studio.ideas.import": importAction,
  "studio.ideas.views.create": createViewAction,
  "studio.ideas.views.update": updateViewAction,
  "studio.ideas.views.delete": deleteViewAction,
};
