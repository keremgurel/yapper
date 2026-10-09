import Link from "next/link";
import PlatformIcon from "@/components/publish/platform-icon";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/studio-ui";
import { compactNumber } from "@/components/studio-home/format-number";
import type { RankedVideo } from "@/components/studio-home/rank-videos";

/**
 * How the channels are doing, shown as the posts themselves: the most-viewed
 * ones as a row of thumbnails that scrolls sideways on a phone, with the
 * totals in the header. Only rendered once a channel is connected.
 */
export default function TopPostsRail({
  ranked,
  missing,
}: {
  /** Null while channel history loads. */
  ranked: RankedVideo[] | null;
  /** Channels whose history failed, named in the header. */
  missing: string;
}) {
  const top = ranked?.slice(0, 4) ?? null;
  const views = ranked?.reduce((sum, video) => sum + (video.viewCount || 0), 0);
  const meta = ranked?.length
    ? `${compactNumber(views ?? 0)} views across ${compactNumber(ranked.length)} posts${missing ? `, ${missing} not loaded` : ""}`
    : missing
      ? `${missing} didn’t load`
      : undefined;

  return (
    <Section
      title="Your best posts"
      meta={meta}
      action={
        <Button asChild variant="ghost" size="sm">
          <Link href="/studio/poster">Open Poster</Link>
        </Button>
      }
    >
      {top === null ? (
        <div aria-hidden className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((card) => (
            <div
              key={card}
              className="bg-muted aspect-[3/4] animate-pulse rounded-xl"
            />
          ))}
        </div>
      ) : top.length === 0 ? (
        <p className="text-muted-foreground py-4 text-[13px]">
          Your most-viewed posts show up here after your first publish.
        </p>
      ) : (
        <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
          {top.map((video) => (
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
                <p className="text-foreground mt-2 line-clamp-2 text-[13px] leading-snug font-medium group-hover:underline">
                  {video.title || video.caption || "Untitled"}
                </p>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
