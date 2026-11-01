import type { StudioActionInputs } from "../registry.generated";
import type { StudioActionDefinition } from "../executor";
import { canvasEditAction } from "./edit";
import { setScriptAction } from "./script";
import { clearThreadAction } from "./thread";

export type CanvasActionID =
  | "studio.ideas.canvasEdit"
  | "studio.ideas.setScript"
  | "studio.ideas.clearThread";

/** The canvas's actions (protocol/actions/studio-canvas.json), by id. */
export const CANVAS_ACTIONS: {
  [ID in CanvasActionID]: StudioActionDefinition<StudioActionInputs[ID]>;
} = {
  "studio.ideas.canvasEdit": canvasEditAction,
  "studio.ideas.setScript": setScriptAction,
  "studio.ideas.clearThread": clearThreadAction,
};
