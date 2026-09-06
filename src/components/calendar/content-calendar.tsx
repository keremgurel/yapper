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
import {
  bucketByDay,
  monthLabel,
  rescheduleIso,
  weekLabel,
} from "@/lib/content/calendar";
import CalendarHeader from "./calendar-header";
import MonthView from "./month-view";
import WeekView from "./week-view";

/** The content calendar: scheduled library items laid out by day, month or
 * week, with drag-to-reschedule. Owns the wiring (data + nav + reschedule); the
 * grids render, and the date math lives in lib/content/calendar. */
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

  const byDay = useMemo(
    () => bucketByDay(items ?? [], (i) => i.scheduledFor),
    [items],
  );

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
          today={now}
          onOpenItem={openItem}
          onDropDay={reschedule}
        />
      ) : (
        <WeekView
          focus={focus}
          byDay={byDay}
          today={now}
          onOpenItem={openItem}
          onDropDay={reschedule}
        />
      )}
      {byDay.size === 0 && (
        <div className="text-muted-foreground mt-6 flex flex-col items-center gap-2 py-10 text-center text-sm">
          <CalendarDays className="h-6 w-6" />
          <p className="text-foreground font-bold">Nothing scheduled yet</p>
          <p className="max-w-sm">
            Set a schedule date on a Content Library item and it shows up here.
            Drag posts between days to reschedule.
          </p>
        </div>
      )}
      <p className="text-muted-foreground mt-3 text-xs">
        Drag a post to another day to reschedule it. Only items with a schedule
        date appear here. These are planning dates; they do not automatically
        publish your video.
      </p>
    </div>
  );
}
