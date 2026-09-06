"use client";

import { Eye, EyeOff } from "lucide-react";
import { ALL_COLUMN_KEYS, columnDef } from "@/lib/content/columns";

/**
 * Per-view column visibility as a Notion-style properties list: one row per
 * column, eye toggles on the right. Title is not offered because a row with no
 * title is unusable, and the resolver forces it on anyway.
 */
export default function ViewColumnPicker({
  visible,
  onToggle,
}: {
  visible: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <div role="group" aria-label="Visible columns" className="-mx-1">
      {ALL_COLUMN_KEYS.filter((key) => key !== "title").map((key) => {
        const on = visible.includes(key);
        const label = columnDef(key).label || "Actions";
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            aria-pressed={on}
            className="hover:bg-muted flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
          >
            <span className={on ? "text-foreground" : "text-muted-foreground"}>
              {label}
            </span>
            {on ? (
              <Eye aria-hidden className="text-muted-foreground h-3.5 w-3.5" />
            ) : (
              <EyeOff
                aria-hidden
                className="text-muted-foreground/50 h-3.5 w-3.5"
              />
            )}
          </button>
        );
      })}
      <p className="text-muted-foreground px-2 pt-1 text-xs">
        Title is always shown.
      </p>
    </div>
  );
}
