"use client";

import type { CSSProperties, ReactNode } from "react";

export interface SegOption<T> {
  value: T;
  label: ReactNode;
  style?: CSSProperties;
}

/**
 * A compact segmented control: one row, a track of pill buttons, exactly one
 * active. The active pill is a solid brand-accent fill with white text so it stays
 * readable regardless of theme (no inherited foreground colour to fight).
 */
export default function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: SegOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-foreground/50 w-12 shrink-0 text-xs font-bold">
        {label}
      </span>
      <div className="border-border bg-muted/40 flex flex-1 gap-0.5 rounded-lg border p-0.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => onChange(o.value)}
              style={o.style}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-bold transition-colors ${
                active
                  ? "bg-[color:var(--sg-accent)] text-white shadow-sm"
                  : "text-foreground/60 hover:text-foreground hover:bg-muted"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
