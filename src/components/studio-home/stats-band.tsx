import PlatformIcon from "@/components/publish/platform-icon";
import { StatBlock } from "@/components/studio-ui";
import { PLATFORMS } from "@/lib/publish/platforms";
import { compactNumber } from "@/components/studio-home/format-number";
import type { ChannelStats } from "@/components/studio-home/channel-stats";

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
      label: "Loaded views",
      value: value(stats?.totalViews ?? 0),
      detail: stats
        ? `Across ${compactNumber(stats.postCount)} loaded posts`
        : undefined,
    },
    {
      label: "Recent posts’ views",
      value: value(stats?.recentViews ?? 0),
      detail: "Lifetime views on posts from the last 30 days",
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
