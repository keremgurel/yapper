import type {
  IdeaPillarInput,
  IdeaRenameInput,
  IdeaScheduleInput,
  IdeaStatusInput,
  IdeaUnscheduleInput,
} from "../../../../../protocol/app-actions.generated";
import { bulkUpdateContent } from "@/lib/content/operations/bulk";
import { updateOwnContentItem } from "@/lib/content/operations/update-item";
import { getContentItem } from "@/lib/db/content";
import { STATUS_LABEL } from "@/lib/content/status-label";
import { pillarsByIds } from "@/lib/db/project-pillars";
import { getActiveProject } from "@/lib/db/projects";
import {
  failureFrom,
  StudioActionFailure,
  type StudioActionDefinition,
} from "../executor";
import { ideaLabel, ideaLabels, namedList } from "./labels";
import { dayLabel, scheduledInstant } from "./when";

/** The creator's own ideas among the ids, refusing when none are. */
async function ownIdeas(userId: string, ids: readonly string[]) {
  const labels = await ideaLabels(userId, ids);
  if (!labels.size)
    throw new StudioActionFailure(
      "not_found",
      ids.length === 1
        ? "I couldn’t find that idea. It may have been deleted."
        : "I couldn’t find those ideas. They may have been deleted.",
    );
  return labels;
}

export const renameAction: StudioActionDefinition<IdeaRenameInput> = {
  async run({ ideaID, title }, { userId }) {
    const updated = await updateOwnContentItem(userId, ideaID, { title });
    if (!updated.ok) throw failureFrom(updated, "that idea");
    return {
      summary: `Renamed it “${ideaLabel(updated.value.item)}”.`,
      effects: ["ideas"],
    };
  },
};

export const setStatusAction: StudioActionDefinition<IdeaStatusInput> = {
  async run({ ideaIDs, status }, { userId }) {
    const labels = await ownIdeas(userId, ideaIDs);
    const result = await bulkUpdateContent(userId, {
      action: "status",
      ids: [...labels.keys()],
      status,
    });
    if (!result.ok) throw failureFrom(result, "those ideas");
    return {
      summary: `Moved ${namedList([...labels.values()])} to ${STATUS_LABEL[status]}.`,
      effects: ["ideas"],
    };
  },
};

export const setPillarAction: StudioActionDefinition<IdeaPillarInput> = {
  async run({ ideaIDs, pillarID }, { userId }) {
    const labels = await ownIdeas(userId, ideaIDs);
    const result = await bulkUpdateContent(userId, {
      action: "pillar",
      ids: [...labels.keys()],
      pillarId: pillarID ?? null,
    });
    if (!result.ok) throw failureFrom(result, "those ideas");
    const list = namedList([...labels.values()]);
    if (!pillarID)
      return {
        summary: `Removed the pillar from ${list}.`,
        effects: ["ideas"],
      };
    const project = await getActiveProject(userId);
    const [pillar] = await pillarsByIds(project.id, [pillarID]);
    return {
      summary: `Filed ${list} under ${pillar ? `“${pillar.name}”` : "that pillar"}.`,
      effects: ["ideas"],
    };
  },
};

export const scheduleAction: StudioActionDefinition<IdeaScheduleInput> = {
  async run({ ideaIDs, date, time }, { userId, timeZone }) {
    const done: string[] = [];
    let last: Date | null = null;
    for (const id of ideaIDs) {
      const item = await getContentItem(userId, id);
      if (!item) continue;
      const at = scheduledInstant(date, time, item.scheduledFor, timeZone);
      const updated = await updateOwnContentItem(userId, id, {
        scheduledFor: at.toISOString(),
      });
      if (!updated.ok) throw failureFrom(updated, "that idea");
      done.push(ideaLabel(updated.value.item));
      last = at;
    }
    if (!done.length || !last)
      throw new StudioActionFailure(
        "not_found",
        "I couldn’t find that idea. It may have been deleted.",
      );
    return {
      summary: `Put ${namedList(done)} on ${dayLabel(last, timeZone, Boolean(time))}.`,
      effects: ["ideas"],
    };
  },
};

export const unscheduleAction: StudioActionDefinition<IdeaUnscheduleInput> = {
  async run({ ideaIDs }, { userId }) {
    const labels = await ownIdeas(userId, ideaIDs);
    for (const id of labels.keys()) {
      const updated = await updateOwnContentItem(userId, id, {
        scheduledFor: null,
      });
      if (!updated.ok) throw failureFrom(updated, "that idea");
    }
    return {
      summary: `Took ${namedList([...labels.values()])} off the calendar.`,
      effects: ["ideas"],
    };
  },
};
