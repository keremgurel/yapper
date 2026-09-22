"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarView } from "@/lib/content/calendar";
import { Button } from "@/components/ui/button";

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
];

/** Calendar chrome: period label, prev/next/today, and the month/week toggle. */
export default function CalendarHeader({
  view,
  setView,
  label,
  onPrev,
  onNext,
  onToday,
}: {
  view: CalendarView;
  setView: (v: CalendarView) => void;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous"
          className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-md p-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next"
          className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-md p-1.5"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <h2 className="font-display text-foreground min-w-40 text-lg font-semibold tracking-tight">
          {label}
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={onToday}>
          Today
        </Button>
      </div>
      <div className="bg-muted/60 flex rounded-lg p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              view === v.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
