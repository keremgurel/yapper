import type { IdeaCanvasEditInput } from "../../../../../protocol/app-actions.generated";
import { describeCanvasActions } from "@/lib/content/canvas-actions";
import { isVersionFormat } from "@/lib/content/formats";
import { askIdeaCanvas } from "@/lib/content/operations/canvas-ask";
import { failureFrom, type StudioActionDefinition } from "../executor";
import { ideaLabels } from "../ideas/labels";

/**
 * One canvas ask, through the same operation as the canvas ask bar: the
 * server reads the whole document, saves the edit and adds the exchange to
 * the idea's canvas conversation. What the writer said is the turn's reply,
 * since the planner wrote its sentence before the edit existed.
 */
export const canvasEditAction: StudioActionDefinition<IdeaCanvasEditInput> = {
  async run({ ideaID, instruction, format }, context) {
    const answer = await askIdeaCanvas(
      context.request,
      context.userId,
      {
        ideaID,
        instruction,
        format: isVersionFormat(format) ? format : undefined,
      },
      context.signal,
    );
    if (!answer.ok) throw failureFrom(answer, "that idea’s canvas");
    const { actions, note } = answer.value;
    const [label] = (await ideaLabels(context.userId, [ideaID])).values();
    const name = `“${label ?? "the idea"}”`;
    const changed = actions.length ? describeCanvasActions(actions) : null;
    return {
      summary: changed ? `${name}: ${changed}` : "",
      reply: note || changed || `Nothing changed on ${name}.`,
      effects: changed ? ["ideaCanvas", "ideas"] : ["ideaCanvas"],
    };
  },
};
