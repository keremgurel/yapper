import { StatBlock } from "@/components/studio-ui";
import { compactNumber } from "./format-number";
import type { RecentPerformance } from "./recent-performance";

export default function StatsBand({
  stats,
  missing,
}: {
  stats: RecentPerformance | null;
  missing: string;
}) {
  const blocks = [
    {
      label: "Views on recent videos",
      value: stats ? compactNumber(stats.totalViews) : null,
      detail: "Current totals across your channels",
    },
    {
      label: "Unique videos",
      value: stats ? compactNumber(stats.groups.length) : null,
      detail: stats ? `Across ${stats.postCount} platform posts` : undefined,
    },
    {
      label: "Typical video",
      value: stats ? compactNumber(stats.typical) : null,
      detail: "Median views, cross-posts combined",
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
