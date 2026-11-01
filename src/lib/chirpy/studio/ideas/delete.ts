import type { IdeaDeleteInput } from "../../../../../protocol/app-actions.generated";
import { bulkUpdateContent } from "@/lib/content/operations/bulk";
import {
  failureFrom,
  StudioActionFailure,
  type StudioActionDefinition,
} from "../executor";
import { ideaLabels, namedList, plural } from "./labels";

/** Runs only after the creator confirms, through the same bulk delete as the
 * table's selection bar. */
export const deleteAction: StudioActionDefinition<IdeaDeleteInput> = {
  async run({ ideaIDs }, { userId }) {
    const labels = await ideaLabels(userId, ideaIDs);
    if (!labels.size)
      throw new StudioActionFailure(
        "not_found",
        "Those ideas were already gone, so nothing was deleted.",
      );
    const removed = await bulkUpdateContent(userId, {
      action: "delete",
      ids: [...labels.keys()],
    });
    if (!removed.ok) throw failureFrom(removed, "those ideas");
    return {
      summary: `Deleted ${namedList([...labels.values()])}.`,
      effects: ["ideas"],
    };
  },
  describe({ ideaIDs }, names) {
    const known = ideaIDs.map((id) => names.ideas[id]).filter(Boolean);
    return known.length === ideaIDs.length
      ? `Delete ${namedList(known)}`
      : `Delete ${plural(ideaIDs.length, "idea")}`;
  },
};
