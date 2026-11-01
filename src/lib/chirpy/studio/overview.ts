import { readAutomationsOverview, wantsAutomations } from "./automations/reads";
import { readBrandOverview, wantsBrand } from "./brand/reads";
import { brainNames } from "./brain/labels";
import { needsBrain, readBrainOverview } from "./brain/reads";
import type { StudioNames } from "./executor";
import { readIdeasOverview } from "./ideas/reads";
import { readStorageOverview, wantsStorage } from "./storage/reads";
import type { StudioOverview } from "./planner";
import { scheduleLabel } from "./calendar/schedules";
import { readPosterOverview, wantsPoster } from "./poster/reads";
import type { StudioTurnInput } from "./wire";
import { localDay, localTime, upcomingDays, weekdayOf } from "./zoned-time";

/**
 * Everything the planner sees about the account for one turn, read from the
 * database and scoped to the creator. The words matched against older ideas
 * are the last two messages, so a follow-up still finds what the previous
 * reply named.
 */
export async function readStudioOverview(
  userId: string,
  input: StudioTurnInput,
  now = new Date(),
): Promise<StudioOverview> {
  const { timeZone } = input;
  const request = input.messages
    .slice(-2)
    .map((message) => message.content)
    .join("\n");
  const storageScope = wantsStorage(input.surface, request);
  const [ideas, brand, storage, automations, brain, poster] = await Promise.all(
    [
      readIdeasOverview(userId, request, timeZone, input.focus?.ideaID),
      wantsBrand(input.surface, request)
        ? readBrandOverview(userId)
        : undefined,
      storageScope ? readStorageOverview(userId, storageScope) : undefined,
      wantsAutomations(input.surface, request)
        ? readAutomationsOverview(userId)
        : undefined,
      needsBrain(input.surface, request)
        ? readBrainOverview(userId, request)
        : undefined,
      wantsPoster(input.surface, request)
        ? readPosterOverview(userId, request, timeZone, now)
        : undefined,
    ],
  );
  return {
    ...ideas,
    ...(brand ? { brand } : {}),
    ...(storage
      ? { storage: storage.storage, storageNames: storage.names }
      : {}),
    ...(automations ? { automations } : {}),
    ...(brain ? { brain } : {}),
    ...(poster ? { poster } : {}),
    today: {
      date: localDay(now, timeZone),
      weekday: weekdayOf(now, timeZone),
      time: localTime(now, timeZone),
      timeZone,
    },
    upcoming: upcomingDays(now, timeZone),
  };
}

/** The names a confirmation question may use, taken from what the planner
 * saw. */
export function namesFrom(overview: StudioOverview): StudioNames {
  return {
    ideas: Object.fromEntries(
      overview.ideas.map((idea) => [
        idea.id,
        idea.title.replace(/^\(untitled\) /, ""),
      ]),
    ),
    views: Object.fromEntries(
      overview.views.map((view) => [view.id, view.name]),
    ),
    pillars: Object.fromEntries(
      overview.pillars.map((pillar) => [pillar.id, pillar.name]),
    ),
    logos: Object.fromEntries(
      (overview.brand?.logos ?? []).map((logo) => [logo.id, logo.name]),
    ),
    ...overview.storageNames,
    brain: brainNames(overview.brain),
    // Stored videos are named by media key, Poster's by library item id.
    videos: {
      ...overview.storageNames?.videos,
      ...Object.fromEntries(
        overview.poster?.videos.map((video) => [video.id, video.title]) ?? [],
      ),
    },
    schedules: Object.fromEntries(
      overview.poster?.schedules.map((row) => [row.id, scheduleLabel(row)]) ??
        [],
    ),
  };
}
