"use client";

import { Check } from "lucide-react";
import {
  VIEW_OPTIONS,
  type TeleprompterView,
} from "@/lib/teleprompter/script-view";

/** Pre-record step: choose what the teleprompter shows (full script /
 * hook + key points / nothing). Options with no content for this idea are
 * disabled so the creator isn't offered an empty prompt. */
export default function TeleprompterViewPicker({
  title,
  value,
  available,
  onSelect,
  onStart,
}: {
  title: string;
  value: TeleprompterView;
  available: (view: TeleprompterView) => boolean;
  onSelect: (view: TeleprompterView) => void;
  onStart: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <p className="text-foreground/45 mb-1 font-mono text-[10px] font-black tracking-[0.16em] uppercase">
        Teleprompter
      </p>
      <h1 className="text-foreground mb-1 text-2xl font-black tracking-tight">
        {title || "Your take"}
      </h1>
      <p className="text-foreground/55 mb-6 text-sm">
        What should show on screen while you record?
      </p>

      <div className="space-y-2">
        {VIEW_OPTIONS.map(({ view, label, desc }) => {
          const enabled = available(view);
          const selected = value === view;
          return (
            <button
              key={view}
              type="button"
              disabled={!enabled}
              onClick={() => onSelect(view)}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-40 ${
                selected
                  ? "border-cyan-400 bg-cyan-500/10"
                  : "border-border hover:bg-muted/40"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-sm font-bold">
                  {label}
                </span>
                <span className="text-foreground/50 block text-[12px]">
                  {enabled ? desc : "Nothing written for this yet"}
                </span>
              </span>
              {selected && <Check className="h-4 w-4 shrink-0 text-cyan-500" />}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-6 w-full rounded-full bg-cyan-500 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-cyan-600"
      >
        Set up camera
      </button>
    </div>
  );
}
