"use client";

import { useRef } from "react";

export interface SegmentOption {
  id: string;
  label: string;
}

/**
 * A two-or-more-way toggle with real tab semantics: roving tabindex, arrow
 * keys, Home and End. Panels the consumer renders should carry
 * `id={`${idBase}-panel-${option.id}`}` and stay mounted, hidden when
 * inactive, so switching is instant.
 */
export default function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  idBase,
}: {
  options: SegmentOption[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  idBase: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (to: number) => {
    const target = (to + options.length) % options.length;
    onChange(options[target].id);
    refs.current[target]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(i + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(options.length - 1);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="bg-muted inline-flex rounded-lg p-0.5"
    >
      {options.map((o, i) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${o.id}`}
            aria-selected={active}
            aria-controls={`${idBase}-panel-${o.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none motion-reduce:transition-none ${
              active
                ? "bg-card text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={{ transitionDuration: "var(--sg-dur-fast)" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
