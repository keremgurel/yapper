"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { CalendarDays, Loader2 } from "lucide-react";
import { useCalendarNav } from "@/hooks/use-calendar-nav";
import { useContentList } from "@/hooks/use-content-list";
import { patchContent } from "@/lib/content/client";
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
  const { items, patchRow } = useContentList(!!isSignedIn);
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
    // Optimistic; roll back the date if the write fails.
    patchRow(id, { scheduledFor });
    patchContent(id, { scheduledFor }).catch(() =>
      patchRow(id, { scheduledFor: row.scheduledFor }),
    );
  };

  const label = view === "month" ? monthLabel(focus) : weekLabel(focus);
  const now = new Date();

  if (items === null) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your calendar…
      </div>
    );
  }

  return (
    <div>
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
        date appear here.
      </p>
    </div>
  );
}
