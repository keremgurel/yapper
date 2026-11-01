import type { InspirationBrainstormInput } from "../../../../../protocol/app-actions.generated";
import { brainstormClip } from "@/lib/content/operations/brainstorm";
import {
  failureFrom,
  StudioActionFailure,
  type StudioActionDefinition,
} from "../executor";
import { plainReply } from "./plain-reply";

/** The open inspiration item, talked through by the same brainstorm as its
 * Make your own chat. Nothing is saved; the writing is the reply. */
export const brainstormAction: StudioActionDefinition<InspirationBrainstormInput> =
  {
    async run({ ask }, context) {
      const item = context.focus?.inspiration;
      if (!item)
        throw new StudioActionFailure(
          "no_inspiration",
          "Click the inspiration card you mean, then ask me again.",
        );
      // The card's note is the creator talking, so it travels as their turn.
      const said = [ask, item.note && `My note on this clip: ${item.note}`]
        .filter(Boolean)
        .join("\n\n");
      const result = await brainstormClip(
        context.request,
        context.userId,
        {
          messages: said ? [{ role: "user", content: said }] : [],
          clip: {
            title: item.title,
            url: item.url,
            platform: item.platform,
            creator: item.author,
            transcript: item.transcript,
          },
          pillars: [],
        },
        context.signal,
      );
      if (!result.ok) throw failureFrom(result, "that brainstorm");
      return {
        summary: `Brainstormed on “${item.title}”.`,
        reply: plainReply(result.value.reply),
        effects: [],
      };
    },
  };
