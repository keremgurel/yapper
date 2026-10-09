"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { type VersionFormat, VERSION_FORMATS } from "@/lib/content/formats";

const LABEL: Record<VersionFormat, string> = {
  short: "Short-form",
  long: "Long-form",
  article: "Article",
};

/** Same tones as the Mac app's format tabs. */
const TONE: Record<VersionFormat, string> = {
  short: "bg-[var(--sg-cyan-500)]",
  long: "bg-[var(--sg-violet-500)]",
  article: "bg-blue-500",
};

/**
 * The idea's versions as underline tabs, matching the Mac app: a colour dot on
 * a written version, a quiet dashed plus on one that isn't, the lead marked.
 */
export default function CanvasVersionTabs({
  lead,
  written,
  active,
  disabled,
  onSelect,
}: {
  lead: VersionFormat;
  written: Set<VersionFormat>;
  active: VersionFormat;
  disabled: boolean;
  onSelect: (format: VersionFormat) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Content versions"
      className="border-border flex gap-6 overflow-x-auto border-b px-6"
    >
      {VERSION_FORMATS.map((format) => {
        const on = active === format;
        const exists = written.has(format);
        return (
          <button
            key={format}
            type="button"
            role="tab"
            aria-selected={on}
            aria-label={
              exists ? LABEL[format] : `${LABEL[format]}, not written yet`
            }
            disabled={disabled}
            onClick={() => onSelect(format)}
            className={cn(
              "relative flex shrink-0 items-center gap-2 py-3 text-sm transition-colors disabled:opacity-50",
              on
                ? "text-foreground font-semibold"
                : exists
                  ? "text-muted-foreground hover:text-foreground font-medium"
                  : "text-muted-foreground/70 hover:text-muted-foreground font-medium",
            )}
          >
            {exists ? (
              <span className={cn("size-[7px] rounded-full", TONE[format])} />
            ) : (
              <span className="border-muted-foreground/40 flex size-[15px] items-center justify-center rounded-[4px] border border-dashed">
                <Plus className="size-2.5" strokeWidth={3} />
              </span>
            )}
            {LABEL[format]}
            {format === lead && (
              <span
                className="bg-muted text-muted-foreground rounded-full px-1.5 py-px text-[10.5px] font-semibold"
                title={`This idea started as ${LABEL[format].toLowerCase()}. The other versions are written from it by default.`}
              >
                Lead
              </span>
            )}
            {on && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--sg-orange-500)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
