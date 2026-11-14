"use client";

import { CircleAlert, Clock, Loader2 } from "lucide-react";
import type { PublishPlatform } from "@/lib/db/schema";
import { outcomeHeadline, type OutcomeTone } from "./outcome-headline";
import OutcomeRow from "./outcome-row";
import { outcomeRows, type SourceOutcome } from "./outcome-rows";
import PostedCheck from "./posted-check";

function ToneIcon({ tone }: { tone: OutcomeTone }) {
  if (tone === "done") return <PostedCheck className="size-5" />;
  if (tone === "sending")
    return (
      <Loader2
        aria-hidden
        className="text-muted-foreground size-5 animate-spin"
      />
    );
  if (tone === "failed")
    return <CircleAlert aria-hidden className="text-destructive size-5" />;
  return <Clock aria-hidden className="text-muted-foreground size-5" />;
}

/**
 * Where a publish stands: one line for the whole press, then every
 * destination with its own result. Destinations go out together, so each has
 * a row from the start and failures stay beside successes. Summarising a mixed
 * result as one state would be a lie.
 */
export default function OutcomeList({
  sources,
  platforms,
  outcomes,
  posting,
  handles,
}: {
  sources: { id: string; title: string }[];
  platforms: PublishPlatform[];
  outcomes: SourceOutcome[];
  posting: boolean;
  /** The connected account on each platform, to say where a post went. */
  handles: Partial<Record<PublishPlatform, string>>;
}) {
  const rows = outcomeRows(sources, platforms, outcomes, posting);
  const headline = outcomeHeadline(rows, sources.length);
  if (!headline) return null;
  const batch = sources.length > 1;
  const render = (list: typeof rows) =>
    list.map((row) => (
      <OutcomeRow
        key={`${row.sourceId}-${row.platform}`}
        row={row}
        handle={handles[row.platform]}
      />
    ));

  return (
    <section className="border-border bg-card rounded-xl border">
      <h3
        role="status"
        className="flex items-center gap-2.5 px-4 py-3.5 text-base font-medium"
      >
        <ToneIcon key={headline.tone} tone={headline.tone} />
        <span
          key={headline.text}
          className="outcome-headline-text inline-block"
        >
          {headline.text}
        </span>
      </h3>
      {batch ? (
        [...new Set(rows.map((row) => row.sourceId))].map((sourceId) => (
          <div key={sourceId} className="border-border/60 border-t">
            <p className="text-muted-foreground truncate px-4 pt-3 text-xs">
              {rows.find((row) => row.sourceId === sourceId)?.sourceTitle}
            </p>
            <ul className="divide-border/60 divide-y">
              {render(rows.filter((row) => row.sourceId === sourceId))}
            </ul>
          </div>
        ))
      ) : (
        <ul className="divide-border/60 border-border/60 divide-y border-t">
          {render(rows)}
        </ul>
      )}
    </section>
  );
}
