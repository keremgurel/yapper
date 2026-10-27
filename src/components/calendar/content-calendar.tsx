"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { CalendarDays, Loader2 } from "lucide-react";
import { useCalendarNav } from "@/hooks/use-calendar-nav";
import { useContentList } from "@/hooks/use-content-list";
import { patchContent } from "@/lib/content/client";
import { createRescheduler } from "@/lib/content/reschedule";
import { Button } from "@/components/ui/button";
import { CHIP_TONES } from "@/components/studio-ui/chip-tones";
import {
  bucketByDay,
  defaultPostTime,
  monthLabel,
  rescheduleIso,
  weekLabel,
} from "@/lib/content/calendar";
import CalendarHeader from "./calendar-header";
import MonthView from "./month-view";
import NeedsAttention from "./needs-attention";
import WeekView from "./week-view";
import { usePostedDays } from "./use-posted-days";
import { useScheduleLayer } from "./use-schedule-layer";

/** The content calendar: posts scheduled to send, planned library items and
 * what already went out, laid out by month or week, with drag-to-reschedule.
 * Owns the wiring (data + nav + reschedule); the grids render, and the date
 * math lives in lib/content/calendar. */
export default function ContentCalendar() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { items, patchRow, loadFailed, refresh } = useContentList(!!isSignedIn);
  const [failedMoves, setFailedMoves] = useState<
    Record<string, () => Promise<void>>
  >({});
  const saveDate = useMemo(
    () =>
      createRescheduler({
        save: async (id, scheduledFor) =>
          (await patchContent(id, { scheduledFor })).scheduledFor,
        show: (id, scheduledFor) => patchRow(id, { scheduledFor }),
        failed: (id, retry) =>
          setFailedMoves((previous) => ({ ...previous, [id]: retry })),
        saved: (id) =>
          setFailedMoves((previous) => {
            const next = { ...previous };
            delete next[id];
            return next;
          }),
      }),
    [patchRow],
  );
  const { view, setView, focus, next, prev, today } = useCalendarNav();
  const postedByDay = usePostedDays(!!isSignedIn);
  const scheduled = useScheduleLayer(!!isSignedIn);

  // A planned item whose posts are armed shows as those posts, not twice.
  const byDay = useMemo(() => {
    const armed = new Set(
      [...scheduled.layer.byDay.values()]
        .flat()
        .map((row) => row.contentItemId),
    );
    return bucketByDay(
      (items ?? []).filter((item) => !armed.has(item.id)),
      (i) => i.scheduledFor,
    );
  }, [items, scheduled.layer.byDay]);

  const openItem = (id: string) => router.push(`/studio/library/${id}`);

  const reschedule = (id: string, day: Date) => {
    const row = items?.find((i) => i.id === id);
    if (!row) return;
    const scheduledFor = rescheduleIso(row.scheduledFor, day);
    if (scheduledFor === row.scheduledFor) return;
    void saveDate(id, scheduledFor, row.scheduledFor).catch(() => {});
  };

  const label = view === "month" ? monthLabel(focus) : weekLabel(focus);
  const now = new Date();
  // Only offered when this server can actually send posts later.
  const addHref = (day: Date) => {
    if (!scheduled.enabled) return null;
    const at = defaultPostTime(day, now);
    return at
      ? `/studio/poster?scheduleAt=${encodeURIComponent(at.toISOString())}`
      : null;
  };

  if (loadFailed) {
    return (
      <div role="alert" className="border-border bg-card rounded-xl border p-6">
        <p className="text-foreground text-sm font-bold">
          Your calendar couldn’t be loaded.
        </p>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => void refresh()}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (items === null) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your calendar…
      </div>
    );
  }

  return (
    <div>
      <NeedsAttention
        schedules={scheduled.schedules}
        enabled={scheduled.enabled}
        onSaved={scheduled.layer.onSaved}
      />
      {scheduled.moveError && (
        <p role="alert" className="text-destructive mb-4 text-sm">
          {scheduled.moveError}
        </p>
      )}
      {scheduled.loadFailed && (
        <p role="alert" className="text-destructive mb-4 text-sm">
          Scheduled posts couldn’t be loaded. The calendar tries again every 30
          seconds.
        </p>
      )}
      {Object.entries(failedMoves).map(([id, retry]) => (
        <div
          key={id}
          role="alert"
          className="border-destructive/25 bg-destructive/5 mb-4 flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"
        >
          <span>
            That date couldn’t be saved. The last saved date is shown.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void retry().catch(() => {})}
          >
            Try again
          </Button>
        </div>
      ))}
      <CalendarHeader
        view={view}
        setView={setView}
        label={label}
        onPrev={prev}
        onNext={next}
        onToday={today}
      />
      {view === "month" ? (
        <MonthView
          focus={focus}
          byDay={byDay}
          postedByDay={postedByDay}
          today={now}
          layer={scheduled.layer}
          addHref={addHref}
          onOpenItem={openItem}
          onDropDay={reschedule}
        />
      ) : (
        <WeekView
          focus={focus}
          byDay={byDay}
          postedByDay={postedByDay}
          today={now}
          layer={scheduled.layer}
          addHref={addHref}
          onOpenItem={openItem}
          onDropDay={reschedule}
        />
      )}
      {byDay.size === 0 &&
      postedByDay.size === 0 &&
      scheduled.layer.byDay.size === 0 ? (
        <div className="text-muted-foreground mt-6 flex flex-col items-center gap-2 py-10 text-center text-sm">
          <CalendarDays className="h-6 w-6" />
          <p className="text-foreground font-semibold">Nothing scheduled yet</p>
          <p className="max-w-sm">
            In Poster, choose Schedule instead of Post now and the post shows up
            here, then goes out at that time on its own.
          </p>
        </div>
      ) : (
        <CalendarLegend />
      )}
    </div>
  );
}

/** What each kind of entry on the grid means, drawn with the same surfaces. */
function CalendarLegend() {
  return (
    <ul className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={`size-2.5 rounded-sm ${CHIP_TONES.yellow.bg}`}
        />
        Scheduled to post on its own. Drag to move it, keeping its time.
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="bg-card size-2.5 rounded-sm border" />
        Planned date only
      </li>
      <li className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="border-foreground/15 size-2.5 rounded-full border"
        />
        Already live
      </li>
    </ul>
  );
}
