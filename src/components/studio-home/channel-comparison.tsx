import Link from "next/link";
import PlatformIcon from "@/components/publish/platform-icon";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/studio-ui";
import { PLATFORMS } from "@/lib/publish/platforms";
import { compactNumber } from "./format-number";
import { CHART_COLORS } from "./chart-colors";
import type { RecentPerformance } from "./recent-performance";
export default function ChannelComparison({
  performance,
}: {
  performance: RecentPerformance | null;
}) {
  return (
    <Section
      title="Your channels"
      meta="Same 30-day window"
      action={
        <Button asChild size="sm" variant="ghost">
          <Link href="/studio/connections">Manage</Link>
        </Button>
      }
    >
      {performance === null ? (
        <p role="status" className="text-muted-foreground py-6 text-sm">
          Loading channels…
        </p>
      ) : (
        <ul className="divide-border/60 divide-y">
          {performance.channels.map((channel) => (
            <li key={channel.platform} className="space-y-3 py-5 first:pt-2">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <PlatformIcon platform={channel.platform} branded />
                  {PLATFORMS[channel.platform].label}
                </span>
                <span className="text-lg font-semibold tabular-nums">
                  {compactNumber(channel.views)}
                  <span className="sr-only"> views</span>
                </span>
              </div>
              <div
                aria-hidden="true"
                className="bg-muted h-1.5 overflow-hidden rounded-full"
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: CHART_COLORS[channel.platform],
                    width: `${performance.totalViews > 0 ? (channel.views / performance.totalViews) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="text-muted-foreground flex flex-wrap justify-between gap-2 text-xs">
                <span>
                  {channel.posts} {channel.posts === 1 ? "post" : "posts"}
                </span>
                <span>
                  {compactNumber(channel.typical)} median views per post
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground mt-3 max-w-[42ch] text-xs leading-relaxed">
        Current views on posts from the last 30 days. Each channel counts its
        own copy of a video.
      </p>
    </Section>
  );
}
