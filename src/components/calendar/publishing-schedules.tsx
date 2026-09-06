"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { CalendarClock, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PLATFORMS } from "@/lib/publish/platforms";
import {
  changeSchedule,
  fetchSchedules,
  localScheduleInput,
  scheduleErrorMessage,
} from "@/lib/publish/schedule-client";
import type {
  ScheduleStatus,
  ScheduleSummary,
} from "@/lib/publish/schedule-types";

const LABEL: Record<ScheduleStatus, string> = {
  scheduled: "Scheduled",
  running: "Sending",
  published: "Published",
  draft: "In TikTok drafts",
  failed: "Needs a retry",
  needs_attention: "Check the platform",
  cancelled: "Cancelled",
};

function ScheduleRow({
  row,
  onChange,
}: {
  row: ScheduleSummary;
  onChange: (row: ScheduleSummary) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState(() =>
    localScheduleInput(new Date(row.scheduledFor)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const change = async (action: "cancel" | "reschedule" | "retry") => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await changeSchedule(
        row.id,
        action,
        action === "cancel" ? undefined : new Date(when).toISOString(),
      );
      onChange(result.schedule);
      setEditing(false);
    } catch (cause) {
      setError(scheduleErrorMessage(cause));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const active = row.status === "scheduled" || row.status === "running";
  return (
    <li className="border-border space-y-3 border-t py-4 first:border-t-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{row.title}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {PLATFORMS[row.platform].label} · {row.accountLabel}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: row.timezone,
            }).format(new Date(row.scheduledFor))}{" "}
            · {row.timezone}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-[color:var(--sg-accent)]/10 text-[color:var(--sg-accent)]" : "bg-muted text-muted-foreground"}`}
        >
          {LABEL[row.status]}
        </span>
      </div>
      {row.error && (
        <p className="text-destructive text-xs">
          {scheduleErrorMessage(new Error(row.error))}
        </p>
      )}
      {row.status === "draft" && (
        <p className="text-muted-foreground text-xs">
          Open TikTok notifications to finish and publish this draft.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {row.contentItemId && (
          <Link
            href={`/studio/library/${row.contentItemId}`}
            className="text-muted-foreground mr-2 text-xs underline underline-offset-4"
          >
            Open Library item
          </Link>
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
        {(row.status === "scheduled" || row.status === "failed") && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                setWhen(
                  localScheduleInput(
                    new Date(
                      Math.max(
                        new Date(row.scheduledFor).getTime(),
                        Date.now() + 5 * 60_000,
                      ),
                    ),
                  ),
                );
                setEditing((value) => !value);
              }}
            >
              {row.status === "failed" ? "Choose a retry time" : "Change time"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void change("cancel")}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
      {editing && (
        <div className="flex flex-wrap gap-2">
          <Input
            aria-label={`New time for ${row.title} on ${PLATFORMS[row.platform].label}`}
            type="datetime-local"
            value={when}
            className="w-auto"
            disabled={busy}
            onChange={(event) => setWhen(event.target.value)}
          />
          <Button
            size="sm"
            disabled={busy || !when}
            onClick={() =>
              void change(row.status === "failed" ? "retry" : "reschedule")
            }
          >
            {busy && <Loader2 className="size-3 animate-spin" />} Save time
          </Button>
          <p className="text-muted-foreground w-full text-xs">
            Entered in your current time zone:{" "}
            {Intl.DateTimeFormat().resolvedOptions().timeZone}.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </li>
  );
}

export default function PublishingSchedules() {
  const { user } = useUser();
  return user ? <ScheduleList key={user.id} /> : null;
}

function ScheduleList() {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof fetchSchedules>
  > | null>(null);
  const [error, setError] = useState(false);
  const revision = useRef(0);
  const refresh = useCallback(() => {
    const version = ++revision.current;
    return fetchSchedules().then(
      (result) => {
        if (version === revision.current) {
          setData(result);
          setError(false);
        }
      },
      () => {
        if (version === revision.current) setError(true);
      },
    );
  }, []);
  useEffect(() => {
    const revisionCounter = revision;
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    return () => {
      window.clearInterval(timer);
      revisionCounter.current++;
    };
  }, [refresh]);

  if (data && !data.enabled && data.schedules.length === 0) return null;
  const rows = [...(data?.schedules ?? [])].sort((a, b) => {
    const active = (value: ScheduleSummary) =>
      value.status === "scheduled" || value.status === "running";
    return (
      Number(active(b)) - Number(active(a)) ||
      (active(a)
        ? new Date(a.scheduledFor).getTime() -
          new Date(b.scheduledFor).getTime()
        : 0)
    );
  });
  return (
    <section
      className="border-border bg-card mb-6 rounded-xl border px-5 py-4"
      aria-label="Scheduled publishing"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold">
          <CalendarClock className="size-4 text-[color:var(--sg-accent)]" />{" "}
          Scheduled publishing
        </h2>
        <Button variant="ghost" size="sm" onClick={() => void refresh()}>
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive mt-3 text-sm">
          Scheduled posts couldn’t be refreshed. Try Refresh again.
        </p>
      )}
      {!data && !error && (
        <p className="text-muted-foreground mt-3 text-sm">
          Loading scheduled posts…
        </p>
      )}
      {data && rows.length === 0 && (
        <p className="text-muted-foreground mt-3 text-sm">
          No publishing schedules yet. Prepare a video in{" "}
          <Link className="underline" href="/studio/poster">
            Poster
          </Link>{" "}
          and choose “Schedule for later”.
        </p>
      )}
      {data && !data.enabled && rows.length > 0 && (
        <p role="status" className="text-muted-foreground mt-3 text-sm">
          Scheduled publishing is paused on this server. Your saved posts remain
          here, and you can cancel them before sending resumes.
        </p>
      )}
      {rows.length > 0 && (
        <ul className="mt-2">
          {rows.map((row) => (
            <ScheduleRow
              key={row.id}
              row={row}
              onChange={(saved) => {
                revision.current++;
                setData((current) =>
                  current
                    ? {
                        ...current,
                        schedules: current.schedules.map((item) =>
                          item.id === saved.id ? saved : item,
                        ),
                      }
                    : current,
                );
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
