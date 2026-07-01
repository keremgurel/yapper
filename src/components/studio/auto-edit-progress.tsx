"use client";

import { Check, Loader2, Wand2 } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";

const STEPS = [
  "Transcribing your audio",
  "Removing mistakes & retakes",
  "Cutting pauses",
  "Trimming silence",
  "Adding captions",
];

/**
 * Full-stage overlay shown while 1-Click Edit runs. Each stage lights up in turn
 * — done steps get a check, the running step shimmers — so the wait reads as
 * deliberate progress rather than a dead spinner.
 */
export default function AutoEditProgress() {
  const { autoEditing, autoEditStep } = useStudio();
  if (!autoEditing) return null;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div className="border-border bg-card w-[min(88%,380px)] rounded-2xl border p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-500">
            <Wand2 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-foreground text-sm font-black">
              Editing your video
            </p>
            <p className="text-foreground/50 text-[11px]">
              Hang tight — this runs entirely in your browser.
            </p>
          </div>
        </div>

        <ul className="space-y-3.5">
          {STEPS.map((label, i) => {
            const done = i < autoEditStep;
            const active = i === autoEditStep;
            return (
              <li key={label} className="flex items-center gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {done ? (
                    <Check className="h-4 w-4 text-cyan-500" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
                  ) : (
                    <span className="bg-foreground/25 h-1.5 w-1.5 rounded-full" />
                  )}
                </span>
                <span
                  className={`text-[13px] font-bold ${
                    active
                      ? "animate-text-shimmer"
                      : done
                        ? "text-foreground/70"
                        : "text-foreground/35"
                  }`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
