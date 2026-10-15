"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/studio-ui";
import PlatformIcon from "@/components/publish/platform-icon";
import { PLATFORMS } from "@/lib/publish/platforms";
import { compactNumber } from "./format-number";
import { CHART_COLORS } from "./chart-colors";
import type { RecentPerformance } from "./recent-performance";
import type { VideoGroup } from "./group-videos";

function VideoBar({ group, maximum }: { group: VideoGroup; maximum: number }) {
  const [expanded, setExpanded] = useState(false);
  const title = group.primary.title || group.primary.caption || "Untitled";
  const date = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(group.publishedAt));
  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="group hover:bg-muted focus-visible:outline-ring -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <div className="bg-muted h-14 w-10 shrink-0 overflow-hidden rounded-md">
          {group.primary.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={group.primary.thumbnail}
              alt=""
              width={40}
              height={56}
              loading="lazy"
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-foreground truncate text-[13px] font-medium">
              {title}
            </span>
            <span className="text-foreground shrink-0 text-sm font-semibold tabular-nums">
              {compactNumber(group.views)}
              <span className="sr-only"> views</span>
            </span>
          </div>
          <div
            aria-hidden="true"
            className="bg-muted h-3 overflow-hidden rounded-sm"
          >
            <div
              className="flex h-full overflow-hidden rounded-sm"
              style={{
                width: `${maximum > 0 ? (group.views / maximum) * 100 : 0}%`,
              }}
            >
              {group.posts.map((post) => (
                <span
                  key={`${post.platform}:${post.id}`}
                  style={{
                    width: `${group.views > 0 ? (post.viewCount / group.views) * 100 : 0}%`,
                    backgroundColor: CHART_COLORS[post.platform],
                  }}
                />
              ))}
            </div>
          </div>
          <div className="text-muted-foreground mt-1.5 flex items-center justify-between gap-2 text-xs">
            <span>
              {date}
              {group.posts.length > 1
                ? ` · ${group.posts.length} channels`
                : ` · ${PLATFORMS[group.primary.platform].label}`}
            </span>
            <span className="group-hover:text-foreground">
              {expanded ? "Hide details" : "Details"}
            </span>
          </div>
        </div>
      </button>
      {expanded ? (
        <div className="bg-muted mt-1 mb-2 space-y-2 rounded-lg p-3">
          <p className="text-sm font-medium [overflow-wrap:anywhere]">
            {title}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {group.posts.map((post) => (
              <a
                key={`${post.platform}:${post.id}`}
                href={post.url}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground focus-visible:outline-ring flex min-h-9 items-center gap-2 rounded text-xs underline-offset-4 hover:underline focus-visible:outline-2"
                aria-label={`Open on ${PLATFORMS[post.platform].label}, ${(post.viewCount || 0).toLocaleString()} views (new tab)`}
              >
                <PlatformIcon
                  platform={post.platform}
                  branded
                  className="h-3.5 w-3.5"
                />
                {PLATFORMS[post.platform].label}{" "}
                <span className="font-medium tabular-nums">
                  {(post.viewCount || 0).toLocaleString()} views
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** A categorical bar chart, not a fake daily-growth curve. One row per video,
 * all platform copies combined; full titles and exact counts on disclosure. */
export default function PostsRail({
  performance,
}: {
  performance: RecentPerformance | null;
}) {
  const [view, setView] = useState<"latest" | "top">("latest");
  const groups = performance?.groups ?? [];
  const posts = (
    view === "top"
      ? groups
      : [...groups].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  ).slice(0, 8);
  const maximum = Math.max(0, ...posts.map((group) => group.views));
  return (
    <Section
      title="Views by video"
      meta="Published in the last 30 days"
      action={
        <div className="flex gap-1" role="group" aria-label="Video chart order">
          {(["latest", "top"] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={view === option ? "outline" : "ghost"}
              aria-pressed={view === option}
              onClick={() => setView(option)}
            >
              {option === "latest" ? "Latest" : "Most viewed"}
            </Button>
          ))}
        </div>
      }
    >
      {performance === null ? (
        <div role="status" className="space-y-4 py-4">
          <span className="sr-only">Loading video performance…</span>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-muted h-14 rounded-lg" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="space-y-2 py-10">
          <p className="text-sm font-medium">
            Your next video starts the chart
          </p>
          <p className="text-muted-foreground max-w-[55ch] text-sm">
            No videos were found in the last 30 days. Older posts are still in
            Poster.
          </p>
        </div>
      ) : (
        <>
          <div
            className="text-muted-foreground mb-1 flex flex-wrap gap-x-4 gap-y-2 text-xs"
            aria-label="Chart legend"
          >
            {performance.channels
              .filter((channel) => channel.posts > 0)
              .map((channel) => (
                <span
                  key={channel.platform}
                  className="flex items-center gap-1.5"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: CHART_COLORS[channel.platform] }}
                    aria-hidden="true"
                  />
                  {PLATFORMS[channel.platform].label}
                </span>
              ))}
          </div>
          <ol className="divide-border/50 divide-y">
            {posts.map((group) => (
              <VideoBar key={group.id} group={group} maximum={maximum} />
            ))}
          </ol>
          <p className="text-muted-foreground mt-3 text-xs">
            {view === "latest" ? "Latest" : "Most-viewed"} {posts.length} of{" "}
            {groups.length} unique videos. Current lifetime views, cross-posts
            combined.
          </p>
        </>
      )}
    </Section>
  );
}
