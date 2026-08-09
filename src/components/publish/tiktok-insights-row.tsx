"use client";

import { useEffect, useState } from "react";
import type { TikTokCreatorInsights } from "@/lib/publish/tiktok-insights";

/** Follower counts are read at a glance, so 12.4K beats 12,431. */
function compact(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000)
    return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}K`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

/**
 * What TikTok will tell us about the connected creator, under their row.
 *
 * Counts the connection is not scoped for are named rather than shown as zero:
 * "0 followers" is a lie a creator would take at face value, and the fix (one
 * reconnect, once the app is approved for the scope) is only obvious if the
 * missing scope is on screen.
 */
export default function TikTokInsightsRow() {
  const [insights, setInsights] = useState<TikTokCreatorInsights | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/publish/tiktok/insights")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { insights?: TikTokCreatorInsights } | null) => {
        if (active && data?.insights) setInsights(data.insights);
      })
      .catch(() => {
        // The row is extra detail on a panel that works without it.
      });
    return () => {
      active = false;
    };
  }, []);

  if (!insights) return null;

  const stats: [string, number | null][] = [
    ["followers", insights.followers],
    ["following", insights.following],
    ["likes", insights.likes],
    ["posts", insights.videos],
  ];
  const known = stats.filter(([, value]) => value !== null);

  return (
    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {known.map(([label, value]) => (
        <span key={label}>
          <span className="text-foreground font-bold">{compact(value!)}</span>{" "}
          {label}
        </span>
      ))}
      {insights.missing.length > 0 && (
        <span>Reconnect for {insights.missing.join(" and ")}.</span>
      )}
      {insights.profileUrl && (
        <a
          href={insights.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground underline-offset-2"
        >
          View profile
        </a>
      )}
    </div>
  );
}
