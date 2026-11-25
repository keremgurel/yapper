import type { StyleLookDeleteInput } from "../../../../../protocol/app-actions.generated";
import { deleteLook } from "@/lib/style-library/operations/delete-look";
import { StudioActionFailure, type StudioActionDefinition } from "../executor";

/** Runs only after the creator confirms. */
export const deleteLookAction: StudioActionDefinition<StyleLookDeleteInput> = {
  async run({ lookID }, { userId }) {
    const removed = await deleteLook(userId, lookID);
    if (!removed.ok) {
      throw new StudioActionFailure(
        "not_found",
        "That look was already gone, so nothing was deleted.",
      );
    }
    return {
      summary: `Deleted the look “${removed.value.name}”.`,
      effects: [],
    };
  },
  describe({ lookID }, names) {
    const name = names.looks?.[lookID];
    return name ? `Delete the look “${name}”` : "Delete that look";
  },
};
