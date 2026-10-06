"use client";

import { AlertTriangle, Check, Clock, Info, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import PlatformIcon from "@/components/publish/platform-icon";
import { Chip } from "@/components/studio-ui";
import type { ChipTone } from "@/components/studio-ui";
import type { PlatformCaption } from "@/lib/publish/caption-format";
import type { DestinationReadiness } from "@/lib/publish/destination-readiness";

const STATE_TONE: Record<DestinationReadiness["state"], ChipTone> = {
  disconnected: "neutral",
  empty: "neutral",
  blocked: "yellow",
  ready: "green",
  scheduled: "cyan",
  posted: "green",
  failed: "yellow",
};

const STATE_LABEL: Record<DestinationReadiness["state"], string> = {
  disconnected: "Not connected",
  empty: "Nothing written",
  blocked: "Needs a fix",
  ready: "Ready",
  scheduled: "Scheduled",
  posted: "Posted",
  failed: "Failed",
};

function Counter({
  used,
  max,
  label,
}: {
  used: number;
  max: number;
  label: string;
}) {
  const over = used > max;
  return (
    <span
      className={`font-mono text-[11px] tabular-nums ${over ? "text-[color:var(--sg-yellow-500)]" : "text-muted-foreground"}`}
    >
      {label} {used}/{max}
    </span>
  );
}

/**
 * One destination, as its own object.
 *
 * A cross-post is several posts, not one, and each of them has its own limits,
 * its own required fields and its own way of failing. Giving every destination
 * a card is what lets someone see, without pressing anything, that YouTube is
 * missing a title while TikTok is ready and will land in drafts.
 */
export default function DestinationCard({
  readiness,
  caption,
  onCaptionChange,
  onRemove,
  busy,
  onGenerateOthers,
  onCopyOthers,
  generating,
}: {
  readiness: DestinationReadiness;
  caption: PlatformCaption;
  onCaptionChange: (caption: PlatformCaption) => void;
  onRemove: () => void;
  busy?: boolean;
  onGenerateOthers?: () => void;
  onCopyOthers?: () => void;
  generating?: boolean;
}) {
  const { state } = readiness;
  const done = state === "posted" || state === "scheduled";
  const spec = readiness;

  return (
    <div className="border-border bg-card rounded-xl border">
      <div className="border-border/60 flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <PlatformIcon
          platform={readiness.platform}
          className="h-4 w-4 shrink-0"
        />
        <span className="text-foreground min-w-0 flex-1 text-[13px] font-semibold">
          {readiness.label}
        </span>

        <Chip
          tone={STATE_TONE[state]}
          pill
          className="ml-auto"
          icon={
            busy ? (
              <Loader2 className="animate-spin motion-reduce:animate-none" />
            ) : state === "ready" || state === "posted" ? (
              <Check />
            ) : state === "blocked" || state === "failed" ? (
              <AlertTriangle />
            ) : state === "scheduled" ? (
              <Clock />
            ) : undefined
          }
        >
          {busy ? "Sending" : STATE_LABEL[state]}
        </Chip>

        {!done && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${readiness.label}`}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!done && (
        <div className="space-y-3 p-4">
          {spec.title.applies && (
            <label className="block">
              <span className="text-muted-foreground mb-1.5 flex items-center justify-between text-xs font-medium">
                Title
                <Counter used={spec.title.used} max={spec.title.max} label="" />
              </span>
              <input
                value={caption.title}
                onChange={(e) =>
                  onCaptionChange({ ...caption, title: e.target.value })
                }
                placeholder="The whole click decision, in plain words"
                className="border-border bg-background w-full scroll-mb-28 rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
              />
            </label>
          )}

          <label className="block">
            <span className="text-muted-foreground mb-1.5 flex items-center justify-between text-xs font-medium">
              Caption
              <Counter used={spec.body.used} max={spec.body.max} label="" />
            </span>
            <textarea
              value={caption.body}
              onChange={(e) =>
                onCaptionChange({ ...caption, body: e.target.value })
              }
              rows={4}
              placeholder="What this says here"
              className="border-border bg-background w-full resize-y scroll-mb-28 rounded-lg border px-3 py-2 text-sm leading-relaxed focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
            />
            {/* The fold is the part people forget, so it is drawn rather than
                described: everything past it is collapsed behind "more". */}
            <span className="text-muted-foreground mt-1.5 block text-[11px]">
              {`First ${spec.visibleChars} characters show before “more”`}
              {spec.body.used > spec.visibleChars &&
                `, ${spec.body.used - spec.visibleChars} hidden`}
            </span>
          </label>

          {caption.body.trim() && onCopyOthers && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onGenerateOthers}
                  disabled={generating}
                  aria-label={`Generate other captions from ${readiness.label}`}
                >
                  Generate others
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCopyOthers}
                  aria-label={`Copy ${readiness.label} caption to other destinations`}
                >
                  Copy to others
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Replaces captions for the other selected destinations. Copying
                keeps their titles.
              </p>
            </div>
          )}
          {readiness.blockers.length > 0 && (
            <ul className="space-y-1">
              {readiness.blockers.map((blocker) => (
                <li
                  key={blocker}
                  className="flex items-start gap-2 text-[13px] text-[color:var(--sg-yellow-500)]"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {blocker}
                </li>
              ))}
            </ul>
          )}

          {readiness.notes.length > 0 && (
            <ul className="space-y-1">
              {readiness.notes.map((note) => (
                <li
                  key={note}
                  className="text-muted-foreground flex items-start gap-2 text-[12px] leading-relaxed"
                >
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {note}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {done && readiness.notes.length > 0 && (
        <p className="text-muted-foreground px-4 py-3 text-[12px]">
          {readiness.notes[0]}
        </p>
      )}
    </div>
  );
}
