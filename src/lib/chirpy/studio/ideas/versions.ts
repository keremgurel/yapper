import type {
  IdeaDeleteVersionInput,
  IdeaDraftInput,
  IdeaWriteVersionInput,
} from "../../../../../protocol/app-actions.generated";
import { deleteContentVersion } from "@/lib/db/content-versions";
import { draftSavedIdea } from "@/lib/ideas/operations/draft";
import { writeIdeaVersion } from "@/lib/ideas/operations/write-version";
import {
  failureFrom,
  StudioActionFailure,
  type StudioActionDefinition,
} from "../executor";
import { ideaLabel, ideaLabels } from "./labels";

const FORMAT_NAMES = {
  short: "short-form",
  long: "long-form",
  article: "article",
} as const;

export const draftAction: StudioActionDefinition<IdeaDraftInput> = {
  async run({ ideaID }, context) {
    const drafted = await draftSavedIdea(
      context.request,
      context.userId,
      ideaID,
      context.signal,
    );
    if (!drafted.ok) throw failureFrom(drafted, "that idea’s draft");
    return {
      summary: `Wrote the first draft of “${ideaLabel(drafted.value)}”.`,
      effects: ["ideas"],
    };
  },
};

export const writeVersionAction: StudioActionDefinition<IdeaWriteVersionInput> =
  {
    async run({ ideaID, format, from }, context) {
      const written = await writeIdeaVersion(
        context.request,
        context.userId,
        ideaID,
        format,
        from,
        context.signal,
      );
      if (!written.ok)
        throw failureFrom(written, `the ${FORMAT_NAMES[format]} version`);
      const [label] = (await ideaLabels(context.userId, [ideaID])).values();
      return {
        summary: `Wrote the ${FORMAT_NAMES[format]} version of “${label ?? "the idea"}”.`,
        effects: ["ideas"],
      };
    },
  };

export const deleteVersionAction: StudioActionDefinition<IdeaDeleteVersionInput> =
  {
    async run({ ideaID, format }, { userId }) {
      const [label] = (await ideaLabels(userId, [ideaID])).values();
      const removed = await deleteContentVersion(userId, ideaID, format);
      if (!removed)
        throw new StudioActionFailure(
          "not_found",
          `There was no ${FORMAT_NAMES[format]} version to delete.`,
        );
      return {
        summary: `Deleted the ${FORMAT_NAMES[format]} version of “${label ?? "the idea"}”.`,
        effects: ["ideas"],
      };
    },
    describe({ ideaID, format }, names) {
      const label = names.ideas[ideaID];
      return `Delete the ${FORMAT_NAMES[format]} version${label ? ` of “${label}”` : ""}`;
    },
  };
