"use client";

import PlatformIcon from "@/components/publish/platform-icon";
import { publishErrorCopy } from "@/lib/publish/error-copy";
import { PLATFORMS } from "@/lib/publish/platforms";
import OutcomeResult from "./outcome-result";
import type { OutcomeRow as Row } from "./outcome-rows";

/** What the creator may still need to do or know about one destination. */
function notes(row: Row): string[] {
  const lines: string[] = [];
  if (row.error) lines.push(publishErrorCopy(row.error));
  if (row.coverPending)
    lines.push("Adding your cover once YouTube finishes processing the video.");
  if (row.coverApplied === false)
    lines.push(
      "YouTube didn’t apply the cover. You can add it in YouTube Studio.",
    );
  if (row.status === "draft")
    lines.push(
      "Open TikTok → Inbox and tap “Your content from Yapper is ready” to finish posting.",
    );
  if (row.status === "posted" && !row.url && row.platform === "tiktok")
    lines.push("It can take a few minutes to appear on your profile.");
  return lines;
}

/** One destination: the platform and account on the left, its result on the
 * right, and anything left to do underneath. The video is not named here; it
 * is already on the page. */
export default function OutcomeRow({
  row,
  handle,
}: {
  row: Row;
  handle?: string;
}) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlatformIcon
            platform={row.platform}
            className="text-muted-foreground size-4 shrink-0"
          />
          <p className="min-w-0 truncate text-sm font-medium">
            {PLATFORMS[row.platform].label}
            {handle && (
              <span className="text-muted-foreground ml-2 font-normal">
                {handle}
              </span>
            )}
          </p>
        </div>
        <OutcomeResult row={row} />
      </div>
      {notes(row).map((line) => (
        <p
          key={line}
          className="text-muted-foreground mt-1 max-w-[60ch] pl-7 text-[13px]"
        >
          {line}
        </p>
      ))}
    </li>
  );
}
