"use client";

import { Users, Video } from "lucide-react";
import type { InspirationKind } from "@/lib/inspiration/types";

const TABS: {
  id: InspirationKind;
  label: string;
  Icon: typeof Video;
}[] = [
  { id: "video", label: "Videos", Icon: Video },
  { id: "creator", label: "Creators", Icon: Users },
];

/** Segmented switch between the two Inspiration databases. Reused in the board
 * header (with counts) and the add dialog (choosing what you're saving). */
export default function KindToggle({
  value,
  onChange,
  counts,
}: {
  value: InspirationKind;
  onChange: (kind: InspirationKind) => void;
  counts?: Record<InspirationKind, number>;
}) {
  return (
    <div className="border-border bg-muted/40 inline-flex items-center gap-1 rounded-md border p-1">
      {TABS.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-sm font-bold transition-colors ${
              active
                ? "bg-[color:var(--sg-accent)] text-white shadow-sm"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            <t.Icon className="h-4 w-4" />
            {t.label}
            {counts && (
              <span
                className={`text-xs font-black ${active ? "text-white/80" : "text-foreground/40"}`}
              >
                {counts[t.id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
