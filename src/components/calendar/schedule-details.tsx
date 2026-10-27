"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlatformIcon from "@/components/publish/platform-icon";
import { PLATFORMS } from "@/lib/publish/platforms";
import {
  localScheduleInput,
  scheduleRowErrorMessage,
} from "@/lib/publish/schedule-client";
import type { ScheduleSummary } from "@/lib/publish/schedule-types";
import { SCHEDULE_STATUS } from "./schedule-status";
import { useScheduleChange } from "./use-schedule-change";

/** The earliest sensible new time: five minutes out, or the saved time if
 * that is still ahead. */
function nextTime(row: ScheduleSummary): string {
  return localScheduleInput(
    new Date(
      Math.max(new Date(row.scheduledFor).getTime(), Date.now() + 5 * 60_000),
    ),
  );
}

/** One scheduled post: where and when it goes, its state, and what can still
 * be done about it. Shared by the calendar chip's popover and the
 * needs-attention list. */
export default function ScheduleDetails({
  row,
  onSaved,
}: {
  row: ScheduleSummary;
  onSaved: (row: ScheduleSummary) => void;
}) {
  const { run, busy, error } = useScheduleChange(row.id, onSaved);
  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState(() => nextTime(row));
  const status = SCHEDULE_STATUS[row.status];
  const changeable = row.status === "scheduled" || row.status === "failed";
  const platform = PLATFORMS[row.platform].label;

  const save = async () => {
    const saved = await run(
      row.status === "failed" ? "retry" : "reschedule",
      new Date(when),
    );
    if (saved) setEditing(false);
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-1">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <PlatformIcon platform={row.platform} branded className="size-3.5" />
          {platform} as {row.accountLabel}
        </p>
        <p className="line-clamp-2 font-semibold">{row.title}</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          {new Intl.DateTimeFormat(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZone: row.timezone,
          }).format(new Date(row.scheduledFor))}{" "}
          in {row.timezone}
        </p>
      </div>
      <span
        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.chip}`}
      >
        {status.label}
      </span>
      {row.error && (
        <p className="text-destructive text-xs">
          {scheduleRowErrorMessage(row)}
        </p>
      )}
      {row.status === "needs_attention" && (
        <p className="text-muted-foreground text-xs">
          Look for this post on {platform} first. Removing it here only takes it
          off your calendar.
        </p>
      )}
      {row.status === "draft" && (
        <p className="text-muted-foreground text-xs">
          Open TikTok notifications to finish and publish this draft.
        </p>
      )}
      {editing && (
        <div className="space-y-2">
          <input
            aria-label={`New time for ${row.title} on ${platform}`}
            type="datetime-local"
            value={when}
            min={localScheduleInput(new Date())}
            disabled={busy}
            onChange={(event) => setWhen(event.target.value)}
            className="border-border bg-card min-h-10 w-full rounded-lg border px-3 py-2 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <Button
            size="sm"
            className="w-full"
            disabled={busy || !when}
            onClick={() => void save()}
          >
            {busy && <Loader2 className="size-3 animate-spin" />}
            {row.status === "failed" ? "Retry at this time" : "Save time"}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      {(changeable ||
        row.status === "needs_attention" ||
        row.externalUrl ||
        row.contentItemId) && (
        <div className="flex flex-wrap items-center gap-2">
          {changeable && !editing && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                setWhen(nextTime(row));
                setEditing(true);
              }}
            >
              {row.status === "failed" ? "Choose a new time" : "Change time"}
            </Button>
          )}
          {changeable && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void run("cancel")}
            >
              Cancel post
            </Button>
          )}
          {row.status === "needs_attention" && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void run("cancel")}
            >
              Remove from Calendar
            </Button>
          )}
          {row.externalUrl && /^https:\/\//.test(row.externalUrl) && (
            <a
              href={row.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline underline-offset-4"
            >
              View post
            </a>
          )}
          {row.contentItemId && (
            <Link
              href={`/studio/library/${row.contentItemId}`}
              className="text-muted-foreground text-xs underline underline-offset-4"
            >
              Open in Library
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
