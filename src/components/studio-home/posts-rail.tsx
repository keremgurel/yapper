"use client";

import { useState } from "react";
import Link from "next/link";
import PlatformIcon from "@/components/publish/platform-icon";
import { Button } from "@/components/ui/button";
import { Chip, Section } from "@/components/studio-ui";
import { compactNumber } from "@/components/studio-home/format-number";
import { versusUsual } from "@/components/studio-home/channel-stats";
import type { RankedVideo } from "@/components/studio-home/rank-videos";

type View = "recent" | "top";

function multiplierLabel(times: number): string {
  return times >= 10 ? `${Math.round(times)}×` : `${times.toFixed(1)}×`;
}

/**
 * The posts themselves. Recent shows the latest few against the creator's
 * typical post ("3.2× usual"), which is what changes week to week; Top is the
 * all-time list. A sideways row on a phone, four across on a wide screen.
 */
export default function PostsRail({
  ranked,
  typical,
}: {
  /** Null while channel history loads; already sorted by views. */
  ranked: RankedVideo[] | null;
  typical: number;
}) {
  const [view, setView] = useState<View>("recent");
  const posts =
    ranked === null
      ? null
      : view === "top"
        ? ranked.slice(0, 4)
        : [...ranked]
            .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
            .slice(0, 4);

  return (
    <Section
      title="Posts"
      meta={
        view === "recent" ? "Latest, against your typical post" : "Most viewed"
      }
      action={
        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Which posts"
            className="bg-muted flex rounded-md p-0.5"
          >
            {(["recent", "top"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={view === option}
                onClick={() => setView(option)}
                className={`rounded-[5px] px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
                  view === option
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option === "recent" ? "Recent" : "Top"}
              </button>
            ))}
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/studio/poster">Open Poster</Link>
          </Button>
        </div>
      }
    >
      {posts === null ? (
        <div aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((card) => (
            <div
              key={card}
              className="bg-muted aspect-[3/4] animate-pulse rounded-xl"
            />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <p className="text-muted-foreground py-4 text-[13px]">
          Your posts and their views show up here after your first publish.
        </p>
      ) : (
        <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
          {posts.map((video) => {
            const times = versusUsual(video.viewCount || 0, typical);
            return (
              <li
                key={`${video.platform}-${video.id}`}
                className="w-[42%] shrink-0 snap-start sm:w-auto"
              >
                <a
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block no-underline"
                >
                  <div className="bg-muted relative aspect-[3/4] overflow-hidden rounded-xl">
                    {video.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={video.thumbnail}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                    <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-xs font-semibold text-white">
                      <PlatformIcon
                        platform={video.platform}
                        className="h-3 w-3"
                      />
                      <span className="font-mono tabular-nums">
                        {compactNumber(video.viewCount || 0)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 flex items-start justify-between gap-2">
                    <p className="text-foreground line-clamp-2 min-w-0 text-[13px] leading-snug font-medium group-hover:underline">
                      {video.title || video.caption || "Untitled"}
                    </p>
                    {view === "recent" && times !== null ? (
                      <Chip tone={times >= 1.5 ? "green" : "neutral"} pill>
                        {multiplierLabel(times)} usual
                      </Chip>
                    ) : null}
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
