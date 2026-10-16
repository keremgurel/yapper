import { StatBlock } from "@/components/studio-ui";
import { compactNumber } from "./format-number";
import type { RecentPerformance } from "./recent-performance";

export default function StatsBand({
  stats,
  missing,
  embedded = false,
}: {
  stats: RecentPerformance | null;
  missing: string;
  embedded?: boolean;
}) {
  const blocks = [
    {
      label: "Total views",
      value: stats ? compactNumber(stats.totalViews) : null,
      detail: "On videos posted in the last 30 days",
    },
    {
      label: "Average views per video",
      value: stats ? compactNumber(stats.average) : null,
      detail: "Combined across platforms",
    },
    {
      label: "Unique videos",
      value: stats ? compactNumber(stats.groups.length) : null,
      detail: stats ? `Across ${stats.postCount} platform posts` : undefined,
    },
    {
      label: "Posted this week",
      value: stats ? compactNumber(stats.thisWeek) : null,
      detail: "Unique videos in the past 7 days",
    },
  ];
  return (
    <section
      aria-label="Performance of videos posted in the last 30 days"
      className={
        embedded
          ? "overflow-hidden"
          : "bg-card border-border overflow-hidden rounded-xl border"
      }
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
      {missing ? (
        <p
          role="status"
          className="text-muted-foreground border-border border-t px-4 py-3 text-xs"
        >
          {missing} didn’t load, so those posts are left out.{" "}
          <a className="underline" href="/studio/connections">
            Check connections
          </a>
        </p>
      ) : null}
    </section>
  );
}
