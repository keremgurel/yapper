import type { StudioNames } from "./executor";
import { readIdeasOverview } from "./ideas/reads";
import type { StudioOverview } from "./planner";
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
  const ideas = await readIdeasOverview(
    userId,
    request,
    timeZone,
    input.focus?.ideaID,
  );
  return {
    ...ideas,
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
  };
}
