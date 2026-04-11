"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Mic } from "lucide-react";

export type SpeechMode = "random" | "freestyle";

interface GlassyModeDropdownProps {
  mode: SpeechMode;
  onChange: (mode: SpeechMode) => void;
}

const MODES: { value: SpeechMode; label: string; icon: React.ReactNode }[] = [
  {
    value: "random",
    label: "Random Topic",
    icon: (
      <svg
        className="h-3.5 w-3.5 text-amber-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
      </svg>
    ),
  },
  {
    value: "freestyle",
    label: "Freestyle",
    icon: <Mic className="h-3.5 w-3.5 text-red-500" />,
  },
];

export function GlassyModeDropdown({
  mode,
  onChange,
}: GlassyModeDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = MODES.find((m) => m.value === mode)!;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mode-dropdown-trigger inline-flex cursor-pointer items-center gap-1.5 px-1 py-1 text-[13px] font-medium transition-colors"
      >
        {current.icon}
        {current.label}
        <ChevronDown
          className={`mode-dropdown-chevron h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mode-dropdown-menu absolute left-1/2 z-50 mt-2 w-48 -translate-x-1/2 overflow-hidden rounded-xl shadow-lg">
          {MODES.map((m, i) => (
            <button
              key={m.value}
              type="button"
              onClick={() => {
                onChange(m.value);
                setOpen(false);
              }}
              className={`mode-dropdown-item flex w-full cursor-pointer items-center gap-2.5 bg-transparent px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors ${
                m.value === mode ? "mode-dropdown-item-active" : ""
              } ${i > 0 ? "mode-dropdown-item-border" : ""}`}
              style={{ border: i > 0 ? undefined : "none" }}
            >
              {m.icon}
              {m.label}
              {m.value === mode && (
                <svg
                  className="ml-auto h-3.5 w-3.5 text-amber-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
