import type { IdeaImportInput } from "../../../../../protocol/app-actions.generated";
import { importReferences } from "@/lib/ideas/operations/import-references";
import { failureFrom, type StudioActionDefinition } from "../executor";
import { plural } from "./labels";

/** Links the creator pasted, saved through the same import as the saves
 * archive, so a link already in their ideas is skipped. */
export const importAction: StudioActionDefinition<IdeaImportInput> = {
  async run({ links }, { userId }) {
    const result = await importReferences(userId, links);
    if (!result.ok) throw failureFrom(result, "those links");
    const { imported } = result.value;
    const skipped = links.length - imported;
    if (!imported)
      return {
        summary: "Those links are already in your ideas, so nothing was added.",
        effects: [],
      };
    return {
      summary: `Saved ${plural(imported, "link")} as ideas${skipped ? `; ${plural(skipped, "link")} ${skipped === 1 ? "was" : "were"} already there or not a web address` : ""}.`,
      effects: ["ideas"],
    };
  },
};
