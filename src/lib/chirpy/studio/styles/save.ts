import type { StyleLookSaveInput } from "../../../../../protocol/app-actions.generated";
import {
  describeLook,
  MAX_LOOKS,
} from "@/lib/style-library/operations/look-template";
import { saveLook } from "@/lib/style-library/operations/save-look";
import { StudioActionFailure, type StudioActionDefinition } from "../executor";

/** Start a look from a library template, or copy one of the creator's own. */
export const saveLookAction: StudioActionDefinition<StyleLookSaveInput> = {
  async run({ from, name }, { userId }) {
    const saved = await saveLook(userId, { from, name });
    if (!saved.ok) {
      throw new StudioActionFailure(
        saved.error,
        saved.error === "too_many_looks"
          ? `You already have ${MAX_LOOKS} looks. Delete one first.`
          : `I couldn’t find a template or look called “${from}”. It could be: ${saved.detail}.`,
      );
    }
    return {
      summary: `Saved “${saved.value.name}” to your looks.`,
      effects: [],
      data: describeLook(saved.value),
    };
  },
};
