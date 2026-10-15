"use client";
import { useState } from "react";
import Link from "next/link";
import PlatformIcon from "@/components/publish/platform-icon";
import { Button } from "@/components/ui/button";
import { compactNumber } from "./format-number";
import { multiplierLabel } from "./multiplier-label";
import { PLATFORMS } from "@/lib/publish/platforms";
import type { Opportunity, VideoGroup } from "./content-opportunities";
const HEADINGS = {
  "follow-up": "Try a follow-up",
  share: "Reach another channel",
  revisit: "Revisit a strong idea",
};

function reason(item: Opportunity): string {
  if (item.kind === "share")
    return `No matching post found on ${item.missing!.map((platform) => PLATFORMS[platform].label).join(" or ")} in your loaded history. Check before sharing.`;
  const comparison = item.comparison!;
  return `${multiplierLabel(comparison.times)} your typical ${PLATFORMS[comparison.platform].label} post by lifetime views. ${item.kind === "revisit" ? "What has changed since you made it?" : "What question could a second video answer?"}`;
}

export default function VideoRow({
  group,
  opportunity,
  onCapture,
  onDismiss,
}: {
  group: VideoGroup;
  opportunity?: Opportunity;
  onDismiss?: () => void;
  onCapture: (text: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const video = group.primary;
  const title = video.title || video.caption || "Untitled";
  const capture = async () => {
    setSaving(true);
    setFailed(false);
    try {
      await onCapture(
        `${opportunity?.kind === "revisit" ? "Revisit" : "A follow-up to"} “${title}”: ${opportunity?.kind === "revisit" ? "What has changed, and what would I do differently now?" : "Answer the next question this video leaves open."} (Based on my ${PLATFORMS[video.platform].label} video.)`,
      );
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4">
      <div className="bg-muted h-24 w-16 shrink-0 overflow-hidden rounded-lg sm:h-28 sm:w-20">
        {video.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail}
            alt=""
            loading="lazy"
            width={80}
            height={112}
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {opportunity ? (
          <h3 className="text-sm font-semibold">
            {HEADINGS[opportunity.kind]}
          </h3>
        ) : null}
        <p className="text-foreground text-sm font-medium [overflow-wrap:anywhere]">
          {title}
        </p>
        {opportunity ? (
          <p className="text-muted-foreground max-w-[68ch] text-[13px]">
            {reason(opportunity)}
          </p>
        ) : null}
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {group.posts.map((post) => (
            <a
              key={`${post.platform}:${post.id}`}
              href={post.url}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground focus-visible:outline-ring flex min-h-8 items-center gap-1.5 rounded focus-visible:outline-2 focus-visible:outline-offset-2"
              aria-label={`Open ${title} on ${PLATFORMS[post.platform].label}, ${compactNumber(post.viewCount)} views (new tab)`}
            >
              <PlatformIcon
                platform={post.platform}
                branded
                className="h-3.5 w-3.5"
              />
              {PLATFORMS[post.platform].label}{" "}
              <span className="tabular-nums">
                {compactNumber(post.viewCount || 0)}
              </span>
            </a>
          ))}
          {group.posts.length > 1 ? (
            <span>{compactNumber(group.views)} combined views</span>
          ) : null}
        </div>
        {opportunity ? (
          <div className="flex flex-wrap items-center gap-2">
            {opportunity.kind === "share" ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/studio/poster">Review in Poster</Link>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={saving || saved}
                onClick={() => void capture()}
              >
                {saved
                  ? "Saved to ideas"
                  : saving
                    ? "Saving…"
                    : "Capture this angle"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={onDismiss}
            >
              Hide for a week
            </Button>
            {failed ? (
              <p role="alert" className="text-destructive text-xs">
                Couldn’t save the idea. Try again.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
