import type { IdeaSetScriptInput } from "../../../../../protocol/app-actions.generated";
import { blockFrom, SCRIPT_LABEL } from "@/lib/content/canvas-doc";
import { isVersionFormat } from "@/lib/content/formats";
import {
  readCanvasDocument,
  saveCanvasDocument,
} from "@/lib/content/operations/canvas-document";
import { getContentItem } from "@/lib/db/content";
import {
  failureFrom,
  StudioActionFailure,
  type StudioActionDefinition,
} from "../executor";
import { ideaLabel } from "../ideas/labels";
import { saidVerbatim } from "../said";

/** The creator's own words into a version's first script block, saved the
 * way the canvas autosave saves a typed edit. The words must be in their
 * latest message as they are: model text never replaces a script here. */
export const setScriptAction: StudioActionDefinition<IdeaSetScriptInput> = {
  async run({ ideaID, format, script }, { userId, messages }) {
    if (!saidVerbatim(script, messages))
      throw new StudioActionFailure(
        "not_verbatim",
        "I only put in a script you paste word for word. To change the one you have, ask me to rewrite it.",
      );
    const item = await getContentItem(userId, ideaID);
    if (!item)
      throw new StudioActionFailure(
        "not_found",
        "I couldn’t find that idea. It may have been deleted.",
      );
    const lead = isVersionFormat(item.leadFormat) ? item.leadFormat : "short";
    const document = await readCanvasDocument(
      userId,
      item,
      isVersionFormat(format) ? format : lead,
    );
    const index = document.blocks.findIndex((block) => block.kind === "script");
    const blocks =
      index >= 0
        ? document.blocks.map((block, at) =>
            at === index ? { ...block, text: script } : block,
          )
        : [
            blockFrom({ label: SCRIPT_LABEL, kind: "script", text: script }),
            ...document.blocks,
          ];
    const saved = await saveCanvasDocument(userId, document, {
      ...document,
      blocks,
    });
    if (!saved.ok) throw failureFrom(saved, "that script");
    const version = document.lead ? "" : ` ${document.format}`;
    return {
      summary: `Replaced the${version} script of “${ideaLabel(item)}”.`,
      effects: ["ideaCanvas", "ideas"],
    };
  },
};
