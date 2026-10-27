"use client";

import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { CHIP_TONES } from "@/components/studio-ui/chip-tones";
import { scheduleLabel } from "./quick-times";

/** Confirms what was armed and where to change it. */
export default function ScheduledNotice({
  at,
  count,
}: {
  at: Date;
  count: number;
}) {
  return (
    <div role="status" className="bg-muted flex gap-3 rounded-lg p-3">
      <CalendarCheck
        aria-hidden
        className={`mt-0.5 size-4 shrink-0 ${CHIP_TONES.yellow.fg}`}
      />
      <div className="min-w-0 text-sm">
        <p className="font-semibold">
          {count === 1 ? "Scheduled" : `${count} posts scheduled`} for{" "}
          {scheduleLabel(at)}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Change the time or cancel it in{" "}
          <Link
            href="/studio/calendar"
            className="text-foreground underline underline-offset-4"
          >
            Calendar
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
