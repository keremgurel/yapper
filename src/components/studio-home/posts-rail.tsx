"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/studio-ui";
import { contentOpportunities, groupVideos } from "./content-opportunities";
import { useHomeDismissals } from "./use-home-dismissals";
import VideoRow from "./opportunity-row";
import type { PublishPlatform } from "@/lib/db/schema";
import type { RankedVideo } from "./rank-videos";

type View = "today" | "recent" | "top";
/** A fresh shortlist with evidence, then distinct recent/top videos on demand.
 * Metadata-only: opening Home never transcribes or generates anything. */
export default function PostsRail({
  ranked,
  connected,
  now,
  onCapture,
  userId = "preview",
}: {
  ranked: RankedVideo[] | null;
  connected: PublishPlatform[];
  now: number;
  userId?: string;
  onCapture: (text: string) => Promise<void>;
}) {
  const [view, setView] = useState<View>("today");
  const [rotation, setRotation] = useState(0);
  const groups = useMemo(() => groupVideos(ranked ?? []), [ranked]);
  const { hidden, dismiss, reset } = useHomeDismissals(userId, now);
  const eligible = groups.filter(
    (group) =>
      !group.posts.some((post) => hidden[`${post.platform}:${post.id}`]),
  );
  const opportunities = contentOpportunities(
    eligible,
    ranked ?? [],
    connected,
    now,
    rotation,
  );
  const anotherMix =
    contentOpportunities(eligible, ranked ?? [], connected, now, rotation + 1)
      .map((item) => item.group.id)
      .join() !== opportunities.map((item) => item.group.id).join();
  const posts =
    view === "top"
      ? groups.slice(0, 4)
      : [...groups]
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
          .slice(0, 4);
  return (
    <Section
      title="Worth your attention"
      meta={
        view === "today"
          ? "A daily shortlist from your posts"
          : "Cross-posts grouped by source or matching titles"
      }
      action={
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Content view"
        >
          {(["today", "recent", "top"] as const).map((option) => (
            <Button
              key={option}
              variant={view === option ? "outline" : "ghost"}
              size="sm"
              aria-pressed={view === option}
              onClick={() => setView(option)}
            >
              {option === "today"
                ? "For today"
                : option === "recent"
                  ? "Recent"
                  : "Top"}
            </Button>
          ))}
        </div>
      }
    >
      {ranked === null ? (
        <div role="status" className="text-muted-foreground py-8 text-sm">
          Loading your posts…
        </div>
      ) : view === "today" ? (
        opportunities.length ? (
          <>
            <ul className="divide-border/60 divide-y">
              {opportunities.map((item) => (
                <VideoRow
                  key={`${item.kind}:${item.group.id}`}
                  group={item.group}
                  opportunity={item}
                  onDismiss={() => dismiss(item.group)}
                  onCapture={onCapture}
                />
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">
                Based on loaded history. Suggestions rotate daily.
              </p>
              {anotherMix ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRotation((value) => value + 1)}
                >
                  Show another mix
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="space-y-3 py-4">
            <p className="text-sm font-medium">
              Nothing to flag from your posts today
            </p>
            <p className="text-muted-foreground max-w-[68ch] text-[13px]">
              Keep moving on your next idea. We’ll surface recent standouts and
              possible sharing gaps when there’s enough channel history.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/studio/ideas">Open ideas</Link>
            </Button>
          </div>
        )
      ) : (
        <ul className="divide-border/60 divide-y">
          {posts.map((group) => (
            <VideoRow key={group.id} group={group} onCapture={onCapture} />
          ))}
        </ul>
      )}
      {Object.keys(hidden).length > 0 ? (
        <Button className="mt-3" variant="ghost" size="sm" onClick={reset}>
          Reset hidden suggestions
        </Button>
      ) : null}
    </Section>
  );
}
