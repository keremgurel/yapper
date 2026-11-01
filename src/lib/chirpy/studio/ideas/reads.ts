import { listContentItems } from "@/lib/db/content";
import { listViews } from "@/lib/db/library-views";
import { listPillars } from "@/lib/db/project-pillars";
import { getActiveProject } from "@/lib/db/projects";
import { localDay, localTime } from "../zoned-time";

/** One idea as the planner sees it: enough to pick it out and describe it,
 * none of its body. */
export interface IdeaGlance {
  id: string;
  title: string;
  status: string;
  pillar?: string;
  /** Local day and time when it is on the calendar. */
  date?: string;
  time?: string;
  /** The lead format first, then the other versions it has. */
  formats: string[];
  drafted: boolean;
}

export interface IdeasOverview {
  /** How many ideas the creator has; the list below is a selection. */
  totalIdeas: number;
  ideas: IdeaGlance[];
  pillars: { id: string; name: string }[];
  views: {
    id: string;
    name: string;
    kind: string;
    groupBy: string | null;
    filters: Record<string, string[]>;
  }[];
}

type IdeaRow = Awaited<ReturnType<typeof listContentItems>>[number];

/** The newest ideas always, and older ones only when the request names them. */
export const RECENT_IDEAS = 30;
export const MATCHED_IDEAS = 10;

const STOP_WORDS = new Set(
  "the and for are but not you all any can had her was one our out get has him his how its may new now put see set two way who did let say she too use add yes about after again also back been before being both call could does done each from have here into just like make many more most move much must only other over please same should some such than that their them then there these they this those very want what when where which while will with would your idea ideas".split(
    " ",
  ),
);

function words(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}']{3,}/gu) ?? []).filter(
    (word) => !STOP_WORDS.has(word),
  );
}

function label(row: IdeaRow): string {
  const title = row.title.trim();
  if (title) return title.slice(0, 120);
  const note = row.originalNote.replace(/\s+/g, " ").trim();
  return note ? `(untitled) ${note.slice(0, 100)}` : "(untitled)";
}

/**
 * Which ideas go in front of the planner. Lists are newest-updated first, so
 * the idea a creator just made or touched is always there; an older idea gets
 * in when the request shares words with its title or note, or when it is the
 * one open on screen.
 */
export function selectIdeas(
  rows: readonly IdeaRow[],
  request: string,
  focusID?: string,
): IdeaRow[] {
  const chosen = new Map<string, IdeaRow>();
  const focus = focusID ? rows.find((row) => row.id === focusID) : undefined;
  if (focus) chosen.set(focus.id, focus);
  for (const row of rows.slice(0, RECENT_IDEAS)) chosen.set(row.id, row);
  const wanted = new Set(words(request));
  if (wanted.size) {
    const scored = rows
      .filter((row) => !chosen.has(row.id))
      .map((row) => {
        const haystack = new Set(
          words(`${row.title} ${row.originalNote.slice(0, 300)}`),
        );
        let score = 0;
        for (const word of wanted) if (haystack.has(word)) score += 1;
        return { row, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MATCHED_IDEAS);
    for (const { row } of scored) chosen.set(row.id, row);
  }
  return [...chosen.values()];
}

export function glance(row: IdeaRow, timeZone: string): IdeaGlance {
  const scheduled = row.scheduledFor ? new Date(row.scheduledFor) : null;
  const versions = Array.isArray(row.versionFormats) ? row.versionFormats : [];
  return {
    id: row.id,
    title: label(row),
    status: row.status,
    ...(row.pillar ? { pillar: row.pillar } : {}),
    ...(scheduled
      ? {
          date: localDay(scheduled, timeZone),
          time: localTime(scheduled, timeZone),
        }
      : {}),
    formats: [row.leadFormat, ...versions.filter((f) => f !== row.leadFormat)],
    drafted: row.hasScript || Boolean(row.title.trim()),
  };
}

/** The creator's ideas, pillars and saved views, read for one turn. */
export async function readIdeasOverview(
  userId: string,
  request: string,
  timeZone: string,
  focusID?: string,
): Promise<IdeasOverview> {
  const project = await getActiveProject(userId);
  const [rows, pillars, views] = await Promise.all([
    listContentItems(userId),
    listPillars(project.id),
    listViews(userId, "library"),
  ]);
  return {
    totalIdeas: rows.length,
    ideas: selectIdeas(rows, request, focusID).map((row) =>
      glance(row, timeZone),
    ),
    pillars: pillars.map((pillar) => ({ id: pillar.id, name: pillar.name })),
    views: views.map((view) => ({
      id: view.id,
      name: view.name,
      kind: view.kind,
      groupBy: view.groupBy,
      filters: view.filters as Record<string, string[]>,
    })),
  };
}
