import PlatformIcon from "@/components/publish/platform-icon";
import { StatBlock } from "@/components/studio-ui";
import { PLATFORMS } from "@/lib/publish/platforms";
import { compactNumber } from "@/components/studio-home/format-number";
import type { ChannelStats } from "@/components/studio-home/channel-stats";

function changeLine(change: number | null): string {
  if (change === null) return "Posts from the last 30 days";
  const percent = Math.round(Math.abs(change) * 100);
  if (percent === 0) return "Level with the 30 days before";
  return `${change > 0 ? "Up" : "Down"} ${percent}% on the 30 days before`;
}

/** The channel numbers in one Level-1 card: four StatBlocks split by
 * hairlines, then where the views come from. Null stats keep the shape as
 * skeletons while channel history loads. */
export default function StatsBand({
  stats,
  missing,
}: {
  stats: ChannelStats | null;
  /** Channels whose history failed, named so the totals are not misread. */
  missing: string;
}) {
  const value = (number: number) =>
    stats === null ? null : compactNumber(number);
  const blocks = [
    {
      label: "Total views",
      value: value(stats?.totalViews ?? 0),
      detail: stats
        ? `Across ${compactNumber(stats.postCount)} posts`
        : undefined,
    },
    {
      label: "Last 30 days",
      value: value(stats?.recentViews ?? 0),
      detail: stats ? changeLine(stats.recentChange) : undefined,
    },
    {
      label: "Typical post",
      value: value(stats?.typical ?? 0),
      detail: "Views on your middle post",
    },
    {
      label: "Posted this week",
      value: value(stats?.postsThisWeek ?? 0),
      detail: stats ? `Usually ${stats.usualPerWeek} a week` : undefined,
    },
  ];
  const total = stats?.totalViews ?? 0;

  return (
    <section
      aria-label="Channel performance"
      className="bg-card border-border overflow-hidden rounded-xl border"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {blocks.map((block) => (
          <div
            key={block.label}
            className="border-border/60 odd:border-r lg:border-r lg:last:border-r-0 [&:nth-child(-n+2)]:border-b lg:[&:nth-child(-n+2)]:border-b-0"
          >
            <StatBlock {...block} />
          </div>
        ))}
      </div>
      {stats && (stats.platforms.length > 1 || missing) ? (
        <div className="border-border/60 text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t px-4 py-3 text-xs sm:px-5">
          {stats.platforms.map(({ platform, views }) => (
            <span key={platform} className="flex items-center gap-1.5">
              <PlatformIcon
                platform={platform}
                branded
                className="h-3.5 w-3.5"
              />
              {PLATFORMS[platform].label}
              <span className="text-foreground font-mono font-semibold tabular-nums">
                {Math.round((views / total) * 100)}%
              </span>
            </span>
          ))}
          {missing ? (
            <span>{missing} didn’t load, so it’s left out</span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
