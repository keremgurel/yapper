import type { StyleLookEditInput } from "../../../../../protocol/app-actions.generated";
import { editLook } from "@/lib/style-library/operations/edit-look";
import { describeLook } from "@/lib/style-library/operations/look-template";
import type { TemplateEdit } from "@/lib/style-library/templates/edit-template";
import { StudioActionFailure, type StudioActionDefinition } from "../executor";

/** Rename a look or change it, through the edit path the inspector will use. */
export const editLookAction: StudioActionDefinition<StyleLookEditInput> = {
  async run({ lookID, name, edits }, { userId }) {
    if (!name && !edits?.length) {
      throw new StudioActionFailure(
        "bad_request",
        "Tell me what to change on that look.",
      );
    }
    // The contract checks the shape; the library checks places, styles and values.
    const edited = await editLook(userId, lookID, {
      name,
      edits: edits as TemplateEdit[],
    });
    if (!edited.ok) {
      throw new StudioActionFailure(
        edited.error,
        edited.error === "not_found"
          ? "I couldn’t find that look. It may have been deleted."
          : (edited.detail ?? "That change isn’t one this look can take."),
      );
    }
    const { look, notes } = edited.value;
    const changed = edits?.length
      ? `Updated “${look.name}”.`
      : `Renamed the look to “${look.name}”.`;
    return {
      summary: [changed, ...notes].join(" "),
      effects: [],
      partial: notes.length > 0,
      data: describeLook(look),
    };
  },
};
