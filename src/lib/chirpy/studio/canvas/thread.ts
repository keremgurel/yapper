import type { IdeaClearThreadInput } from "../../../../../protocol/app-actions.generated";
import { clearContentMessages } from "@/lib/db/content-messages";
import { StudioActionFailure, type StudioActionDefinition } from "../executor";
import { ideaLabels } from "../ideas/labels";

/** Runs only after the creator confirms, through the same clear as the
 * thread's Start over. The document is untouched. */
export const clearThreadAction: StudioActionDefinition<IdeaClearThreadInput> = {
  async run({ ideaID }, { userId }) {
    const [label] = (await ideaLabels(userId, [ideaID])).values();
    if (!label)
      throw new StudioActionFailure(
        "not_found",
        "I couldn’t find that idea. It may have been deleted.",
      );
    await clearContentMessages(userId, ideaID);
    return {
      summary: `Cleared the canvas conversation on “${label}”.`,
      effects: ["ideaCanvas"],
    };
  },
  describe({ ideaID }, names) {
    const label = names.ideas[ideaID];
    return `Clear Chirpy’s conversation${label ? ` on “${label}”` : ""}`;
  },
};
