import Link from "next/link";
import { Video } from "lucide-react";
import PlatformIcon from "@/components/publish/platform-icon";
import { Button } from "@/components/ui/button";
import { EmptyState, Section } from "@/components/studio-ui";
import { PLATFORMS } from "@/lib/publish/platforms";
import { compactNumber } from "@/components/studio-home/format-number";
import type { RankedVideo } from "@/components/studio-home/rank-videos";

/** The three most-viewed posts across every channel. Cards link out to the
 * platform; rank is carried by order alone. */
export default function TopContentSection({
  ranked,
}: {
  ranked: RankedVideo[] | null;
}) {
  const top = ranked === null ? null : ranked.slice(0, 3);

  return (
    <Section
      title="Top content"
      meta="by views"
      action={
        <Button asChild variant="ghost" size="sm">
          <Link href="/studio/poster">Open Poster</Link>
        </Button>
      }
    >
      {top === null ? (
        <div aria-hidden className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((card) => (
            <div
              key={card}
              className="bg-muted h-44 animate-pulse rounded-xl"
            />
          ))}
        </div>
      ) : top.length === 0 ? (
        <EmptyState
          icon={Video}
          title="No posts to rank yet"
          description="Connect a channel and its most-viewed videos land here."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/studio/connections">Connect a channel</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {top.map((video) => (
            <a
              key={`${video.platform}-${video.id}`}
              href={video.url}
              target="_blank"
              rel="noreferrer"
              className="bg-card border-border hover:border-foreground/25 overflow-hidden rounded-xl border no-underline transition-colors"
            >
              <div className="bg-muted aspect-[4/3] overflow-hidden">
                {video.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={video.thumbnail}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="p-3">
                <p className="text-foreground line-clamp-2 min-h-9 text-[13px] leading-snug font-semibold">
                  {video.title || "Untitled"}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
                    <PlatformIcon
                      platform={video.platform}
                      branded
                      className="h-3.5 w-3.5"
                    />
                    <span className="truncate">
                      {PLATFORMS[video.platform].label}
                    </span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    <span className="font-mono tabular-nums">
                      {compactNumber(video.viewCount)}
                    </span>{" "}
                    views
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </Section>
  );
}
