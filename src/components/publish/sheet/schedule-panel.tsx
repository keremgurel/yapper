"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PublishPlatform } from "@/lib/db/schema";
import {
  outgoingCopy,
  type CopyOverride,
} from "@/components/publish/outgoing-copy";
import type { CrossPostTarget } from "@/components/publish/compose/types";
import {
  fetchSchedules,
  localScheduleInput,
  scheduleErrorMessage,
  schedulePosts,
} from "@/lib/publish/schedule-client";

export default function SchedulePanel({
  sources,
  platforms,
  override,
  disabled,
  onScheduled,
  onBusy,
  accounts,
}: {
  sources: CrossPostTarget[];
  platforms: PublishPlatform[];
  override: CopyOverride | null;
  disabled: boolean;
  onScheduled: () => void;
  onBusy: (busy: boolean) => void;
  accounts: Partial<Record<PublishPlatform, string>>;
}) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loadingError, setLoadingError] = useState(false);
  const [version, setVersion] = useState(0);
  const [when, setWhen] = useState(() =>
    localScheduleInput(new Date(Date.now() + 24 * 60 * 60_000)),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKey = useRef<string | null>(null);
  const running = useRef(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const count = sources.length * platforms.length;

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetchSchedules().then(
      (result) => {
        if (active) {
          setEnabled(result.enabled);
          setLoadingError(false);
        }
      },
      () => {
        if (active) setLoadingError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [open, version]);

  const schedule = async () => {
    if (running.current || disabled || !enabled || !count || saved) return;
    running.current = true;
    onBusy(true);
    setSaving(true);
    setError(null);
    try {
      const date = new Date(when);
      if (
        !Number.isFinite(date.getTime()) ||
        date.getTime() < Date.now() + 60_000
      )
        throw new Error("invalid_body");
      requestKey.current ??= crypto.randomUUID();
      await schedulePosts({
        requestKey: requestKey.current,
        scheduledFor: date.toISOString(),
        timezone,
        targets: sources.flatMap((source) =>
          platforms.map((platform) => {
            const copy = outgoingCopy(source, platform, override);
            return {
              platform,
              expectedAccountId: accounts[platform] ?? "",
              input: {
                submissionId: source.submissionId,
                mediaKey: source.mediaKey,
                contentItemId: source.contentItemId,
                thumbnailKey: source.thumbnailKey,
                ...(platform === "youtube"
                  ? {
                      title: copy.title,
                      description: copy.body,
                      privacyStatus: "public",
                    }
                  : platform === "instagram"
                    ? { caption: copy.body || copy.title }
                    : {}),
              },
            };
          }),
        ),
      });
      setSaved(true);
      onScheduled();
    } catch (cause) {
      setError(scheduleErrorMessage(cause));
    } finally {
      setSaving(false);
      running.current = false;
      onBusy(false);
    }
  };

  return (
    <section className="border-border rounded-xl border">
      <button
        type="button"
        className="flex w-full items-center gap-2 p-4 text-left text-sm font-bold"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <CalendarClock className="size-4 text-[color:var(--sg-accent)]" />{" "}
        Schedule for later
      </button>
      {open && (
        <div className="space-y-3 border-t px-4 py-4">
          {saved ? (
            <div role="status" className="space-y-2 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <Check className="size-4" /> Your posts are scheduled.
              </p>
              <Link
                href="/studio/calendar"
                className="underline underline-offset-4"
              >
                View or change them in Calendar
              </Link>
            </div>
          ) : loadingError ? (
            <div role="alert" className="text-sm">
              <p>Scheduling couldn’t be loaded.</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setVersion((value) => value + 1)}
              >
                Try again
              </Button>
            </div>
          ) : enabled === null ? (
            <p className="text-muted-foreground text-sm">
              Checking scheduling…
            </p>
          ) : !enabled ? (
            <p className="text-muted-foreground text-sm">
              Scheduled publishing isn’t available on this server yet. Calendar
              dates can still help you plan.
            </p>
          ) : (
            <>
              <Label htmlFor="publish-schedule-time">Send at</Label>
              <Input
                id="publish-schedule-time"
                type="datetime-local"
                value={when}
                disabled={saving}
                onChange={(event) => setWhen(event.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Your time zone: {timezone}. Sending starts on the first check
                after this time; platform processing can take longer.
              </p>
              {platforms.includes("tiktok") && (
                <p className="text-muted-foreground text-xs">
                  TikTok will receive a draft. Finish and publish it in TikTok.
                </p>
              )}
              <p className="text-muted-foreground text-xs">
                The current video, copy, cover, and selected accounts will be
                saved with this schedule. You can cancel before sending begins.
              </p>
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
              <Button
                type="button"
                className="w-full"
                disabled={
                  disabled || saving || count === 0 || count > 20 || !when
                }
                onClick={() => void schedule()}
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {saving
                  ? "Saving schedule…"
                  : `Schedule ${count} ${count === 1 ? "post" : "posts"}`}
              </Button>
              {count > 20 && (
                <p className="text-destructive text-xs">
                  Schedule up to 20 destinations at a time.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
