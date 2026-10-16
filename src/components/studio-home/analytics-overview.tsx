import StatsBand from "./stats-band";
import ViewsChart from "./views-chart";
import type { RecentPerformance } from "./recent-performance";

export default function AnalyticsOverview({
  performance,
  missing,
}: {
  performance: RecentPerformance | null;
  missing: string;
}) {
  return (
    <section
      aria-label="Your content performance"
      className="border-border bg-card overflow-hidden rounded-xl border"
    >
      <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <h2 className="text-sm font-semibold">Your content</h2>
        <span className="text-muted-foreground text-xs">Last 30 days</span>
      </header>
      <StatsBand stats={performance} missing={missing} embedded />
      <div className="px-4 pt-2 pb-3 sm:px-5">
        <ViewsChart performance={performance} />
      </div>
    </section>
  );
}
