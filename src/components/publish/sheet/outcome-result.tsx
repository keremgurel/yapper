"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OutcomeRow } from "./outcome-rows";
import PostedCheck from "./posted-check";

const STATE = "flex shrink-0 items-center gap-2 text-[13px] font-medium";

/** The right-hand side of a destination row: where it stands, and the way to
 * the post once there is one. */
export default function OutcomeResult({ row }: { row: OutcomeRow }) {
  if (row.status === "sending")
    return (
      <span className={`${STATE} text-muted-foreground`}>
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
        Publishing…
      </span>
    );
  if (row.status === "failed")
    return <span className={`${STATE} text-destructive`}>Failed</span>;
  if (row.status === "pending")
    return <span className={`${STATE} text-muted-foreground`}>Confirming</span>;
  if (row.status === "draft")
    return (
      <span className={STATE}>
        <PostedCheck />
        In your inbox
      </span>
    );
  const link = row.url ?? row.profileUrl;
  return (
    <span className={STATE}>
      <PostedCheck />
      {link ? (
        <Button asChild variant="outline" size="sm">
          <a href={link} target="_blank" rel="noreferrer">
            {row.url ? "View post" : "Open profile"}
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </Button>
      ) : (
        "Posted"
      )}
    </span>
  );
}
