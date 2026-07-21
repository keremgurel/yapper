"use client";

import { Mic } from "lucide-react";

/** A compact live mic-level bar: green normally, amber as it gets loud, red near
 * clipping, so a creator can see at a glance that their audio is being picked
 * up. Presentational — `level` is 0-1 from useAudioLevel. */
export default function AudioMeter({ level }: { level: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, level)) * 100);
  const color =
    pct > 85 ? "bg-red-500" : pct > 55 ? "bg-amber-400" : "bg-green-500";
  return (
    <div
      className="flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-md"
      title="Microphone level"
    >
      <Mic className="h-3 w-3 text-white/80" />
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/20">
        <div
          className={`h-full rounded-full transition-[width] duration-75 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
