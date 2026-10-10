"use client";

import type { PostedGroup } from "@/lib/content/posted-days";
import { PostedCard, PostedPill } from "./calendar-posted-badge";

/** How many past posts a day shows before folding the rest into a count.
 * A daily poster's month would otherwise bury the planned chips. */
const CAP = { dense: 2, roomy: 6 };

/** A day's already-published posts, under its planned ones. */
export default function CalendarPostedList({
  groups,
  dense,
}: {
  groups: PostedGroup[];
  dense: boolean;
}) {
  if (groups.length === 0) return null;
  const cap = dense ? CAP.dense : CAP.roomy;
  const shown = groups.slice(0, cap);
  const extra = groups.length - shown.length;
  return (
    <div className="flex flex-col gap-1">
      {shown.map((group) =>
        dense ? (
          <PostedPill key={group.key} group={group} />
        ) : (
          <PostedCard key={group.key} group={group} />
        ),
      )}
      {extra > 0 && (
        <span className="text-muted-foreground px-1 text-[11px] font-bold">
          +{extra} posted
        </span>
      )}
    </div>
  );
}
