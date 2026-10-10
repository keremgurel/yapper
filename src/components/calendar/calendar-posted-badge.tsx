"use client";

import PlatformIcon from "@/components/publish/platform-icon";
import { PLATFORM_NAMES } from "@/components/studio-home/channel-health";
import { compactNumber } from "@/components/studio-home/format-number";
import type { PostedGroup } from "@/lib/content/posted-days";

/** The platforms a post went out on, overlapping like an avatar stack. */
function PlatformStack({ group }: { group: PostedGroup }) {
  return (
    <span className="flex shrink-0 -space-x-1">
      {group.posts.map((post) => (
        <span
          key={post.platform}
          className="bg-background ring-foreground/15 grid size-4 place-items-center rounded-full ring-1 sm:size-[18px]"
        >
          <PlatformIcon
            platform={post.platform}
            branded
            className="size-2.5 sm:size-3"
          />
        </span>
      ))}
    </span>
  );
}

function describe(group: PostedGroup): string {
  const where = group.posts
    .map(
      (p) => `${PLATFORM_NAMES[p.platform]} ${compactNumber(p.viewCount || 0)}`,
    )
    .join(", ");
  return `${group.title || "Untitled"} · ${where} views`;
}

/**
 * Something that already went out, in the month grid: a pill with the
 * platforms it went to and its views. Opens the most viewed copy. Visually
 * quieter than a planned chip (no surface, hairline border) because it is
 * history, not something to act on, and it cannot be dragged.
 */
export function PostedPill({ group }: { group: PostedGroup }) {
  return (
    <a
      href={group.posts[0].url}
      target="_blank"
      rel="noreferrer"
      title={describe(group)}
      className="border-foreground/15 text-muted-foreground hover:text-foreground hover:bg-muted/60 flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-full border px-1 py-0.5 transition-colors"
    >
      <PlatformStack group={group} />
      <span className="hidden min-w-0 flex-1 truncate text-[11px] font-semibold sm:inline">
        {group.title || "Untitled"}
      </span>
      <span className="ml-auto hidden shrink-0 pr-0.5 text-[11px] font-bold tabular-nums sm:inline">
        {compactNumber(group.views)}
      </span>
    </a>
  );
}

/**
 * The same post in the week view, where a column has room: its thumbnail,
 * title, and one badge per platform with that platform's own views, each
 * linking to that copy.
 */
export function PostedCard({ group }: { group: PostedGroup }) {
  return (
    <div
      title={describe(group)}
      className="border-foreground/15 flex gap-2 rounded-lg border p-1.5"
    >
      {group.thumbnail ? (
        // Provider CDN thumbnails, not worth routing through the optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={group.thumbnail}
          alt=""
          loading="lazy"
          className="bg-muted h-12 w-8 shrink-0 rounded object-cover"
        />
      ) : (
        <span className="bg-muted h-12 w-8 shrink-0 rounded" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-foreground line-clamp-2 text-[11px] leading-tight font-semibold">
          {group.title || "Untitled"}
        </span>
        <div className="flex flex-wrap gap-1">
          {group.posts.map((post) => (
            <a
              key={post.platform}
              href={post.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open on ${PLATFORM_NAMES[post.platform]}`}
              className="bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors"
            >
              <PlatformIcon
                platform={post.platform}
                branded
                className="size-2.5"
              />
              <span className="text-[10px] font-bold tabular-nums">
                {compactNumber(post.viewCount || 0)}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
