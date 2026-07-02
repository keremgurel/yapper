"use client";

import type { RefObject } from "react";

/** The scrolling teleprompter text, laid over the top of the camera. Render-only
 * — the scroll position is driven by useTeleprompterScroll via `scrollRef`. */
export default function TeleprompterOverlay({
  scrollRef,
  text,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  text: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[44%]">
      {/* Readability scrim so white text survives a bright shot. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/45 to-transparent" />
      <div
        ref={scrollRef}
        className="relative h-full overflow-hidden px-6 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <p className="mx-auto max-w-2xl text-center text-2xl leading-snug font-black whitespace-pre-line text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] md:text-3xl">
          {text}
        </p>
      </div>
    </div>
  );
}
