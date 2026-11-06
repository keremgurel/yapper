import type { IdeaImportInput } from "../../../../../protocol/app-actions.generated";
import { importReferences } from "@/lib/ideas/operations/import-references";
import {
  failureFrom,
  StudioActionFailure,
  type StudioActionDefinition,
} from "../executor";
import { lastSaid } from "../said";
import { plural } from "./labels";

/** Links the creator pasted, saved through the same import as the saves
 * archive, so a link already in their ideas is skipped. Only links that are
 * in their latest message as typed are kept, never one the model made up. */
export const importAction: StudioActionDefinition<IdeaImportInput> = {
  async run(input, { userId, messages }) {
    const said = lastSaid(messages);
    const links = input.links.filter((link) => said.includes(link.url));
    if (!links.length)
      throw new StudioActionFailure(
        "no_links",
        "Paste the links into your message and I’ll save them.",
      );
    const result = await importReferences(userId, links);
    if (!result.ok) throw failureFrom(result, "those links");
    const { imported } = result.value;
    const skipped = input.links.length - imported;
    if (!imported)
      return {
        summary: "Those links are already in your ideas, so nothing was added.",
        effects: [],
      };
    return {
      summary: `Saved ${plural(imported, "link")} as ideas${skipped ? `; ${plural(skipped, "link")} ${skipped === 1 ? "was" : "were"} already saved or not in your message` : ""}.`,
      effects: ["ideas"],
    };
  },
};
