"use client";

/**
 * Framing guides over the camera: a rule-of-thirds grid to line up your eyes,
 * plus the "keep clear" zones where TikTok/Reels/Shorts paint their own UI (the
 * action buttons on the right, the caption + handle along the bottom). Purely a
 * visual overlay — nothing here is burned into the recording. Percentages are
 * eyeballed against the platforms' 9:16 layouts, close enough to frame by.
 */
export default function RecorderGuides() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* Rule-of-thirds grid. */}
      <div className="absolute inset-y-0 left-1/3 w-px bg-white/20" />
      <div className="absolute inset-y-0 left-2/3 w-px bg-white/20" />
      <div className="absolute inset-x-0 top-1/3 h-px bg-white/20" />
      <div className="absolute inset-x-0 top-2/3 h-px bg-white/20" />

      {/* Right-side action buttons (like / comment / share). */}
      <div className="absolute top-[42%] right-[3%] bottom-[12%] w-[14%] rounded-lg border border-dashed border-white/40" />

      {/* Bottom caption + handle band. */}
      <div className="absolute right-[20%] bottom-[5%] left-[4%] h-[16%] rounded-lg border border-dashed border-white/40">
        <span className="absolute -top-4 left-0 text-[9px] font-bold tracking-wide text-white/60 uppercase">
          Keep clear
        </span>
      </div>
    </div>
  );
}
