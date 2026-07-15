"use client";

import { Video } from "lucide-react";
import type { ContentSummary } from "@/lib/content/client";
import { STATUS_COLOR } from "./status-color";

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** One scheduled item on the calendar: its time, title, and a marker if it has
 * a recording. Draggable to another day to reschedule; clicking opens it. */
export default function CalendarPostChip({
  item,
  onOpen,
}: {
  item: ContentSummary;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", item.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      title={item.title.trim() || "Untitled"}
      style={{ borderLeftColor: STATUS_COLOR[item.status] }}
      className="bg-card hover:bg-muted flex w-full cursor-pointer items-center gap-1.5 rounded-md border-l-2 px-1.5 py-1 text-left transition-colors"
    >
      {item.scheduledFor && (
        <span className="text-muted-foreground shrink-0 text-[10px] font-bold tabular-nums">
          {timeLabel(item.scheduledFor)}
        </span>
      )}
      {item.submissionId && (
        <Video className="text-muted-foreground h-2.5 w-2.5 shrink-0" />
      )}
      <span className="text-foreground truncate text-[11px] font-bold">
        {item.title.trim() || "Untitled"}
      </span>
    </button>
  );
}
