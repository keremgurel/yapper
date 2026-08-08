import type { ItemSummary } from "@/lib/ideas/client";
import type { RankedVideo } from "@/components/studio-home/rank-videos";
import { itemTitle } from "@/components/studio-home/item-title";

const IDEA_STARTERS = [
  "Answer the one question your audience keeps asking incorrectly",
  "Show the fastest way to fix a common beginner mistake",
  "React to advice in your niche that sounds right but is not",
  "Turn a recent client or student win into a three-step lesson",
  "Explain what you would do differently if you started again today",
  "Compare the popular method with the method that actually works",
  "Break down one small detail experts notice immediately",
  "Give your audience a 30-second challenge they can try today",
] as const;

/** Five prompts for today: saved bank ideas first, then a follow-up to the
 * top performer, then evergreen starters rotated by the calendar day so the
 * list changes daily without any storage. */
export function dailyIdeas(
  saved: ItemSummary[],
  topVideo?: RankedVideo,
): string[] {
  const savedTitles = saved.map(itemTitle).filter(Boolean).slice(0, 5);
  const now = new Date();
  const day = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000,
  );
  const rotated = Array.from(
    { length: IDEA_STARTERS.length },
    (_, index) => IDEA_STARTERS[(day + index) % IDEA_STARTERS.length],
  );
  const performanceIdea = topVideo?.title
    ? `Make the useful follow-up your viewers need after “${topVideo.title}”`
    : null;
  return [
    ...savedTitles,
    ...(performanceIdea ? [performanceIdea] : []),
    ...rotated,
  ]
    .filter((title, index, all) => all.indexOf(title) === index)
    .slice(0, 5);
}
