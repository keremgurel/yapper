"use client";

import { useRef, useCallback } from "react";
import type { Topic } from "@/data/topics";

interface TopicReelProps {
  topic: Topic;
  spinning: boolean;
  reelBlurbs: string[];
  promptOverride: string | null;
  onPromptDoubleTap?: () => void;
  promptEditable?: boolean;
}

export default function TopicReel({
  topic,
  spinning,
  reelBlurbs,
  promptOverride,
  onPromptDoubleTap,
  promptEditable = false,
}: TopicReelProps) {
  const lastTapRef = useRef(0);

  const tryDoubleTap = useCallback(() => {
    if (!promptEditable || spinning) return;
    onPromptDoubleTap?.();
  }, [promptEditable, spinning, onPromptDoubleTap]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      tryDoubleTap();
    },
    [tryDoubleTap],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!promptEditable || spinning) return;
      const now = Date.now();
      if (now - lastTapRef.current < 320) {
        e.preventDefault();
        tryDoubleTap();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    },
    [promptEditable, spinning, tryDoubleTap],
  );

  const displayText = promptOverride ?? topic.text;
  const isCustom = promptOverride !== null;

  return (
    <div className="relative flex h-[150px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30 px-7 py-7 text-center backdrop-blur-md">
      {spinning ? (
        <div className="animate-reel-spin flex flex-col gap-4">
          {reelBlurbs.map((t, i) => (
            <p
              key={i}
              className="m-0 font-serif text-lg text-white opacity-30 blur-[2px]"
            >
              {t}
            </p>
          ))}
        </div>
      ) : (
        <div
          role={promptEditable ? "button" : undefined}
          tabIndex={promptEditable ? 0 : undefined}
          title={
            promptEditable ? "Double-tap to write your own prompt" : undefined
          }
          onDoubleClick={handleDoubleClick}
          onTouchEnd={handleTouchEnd}
          onKeyDown={(e) => {
            if (
              promptEditable &&
              (e.key === "Enter" || e.key === " ") &&
              !spinning
            ) {
              e.preventDefault();
              tryDoubleTap();
            }
          }}
          className={`flex w-full touch-manipulation flex-col items-center justify-center outline-none ${
            promptEditable
              ? "cursor-pointer rounded-xl select-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
              : ""
          }`}
        >
          <div className="animate-fade-slide-in mb-4 flex justify-center gap-2 [animation-delay:50ms]">
            {isCustom ? (
              <>
                <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-200 uppercase">
                  Custom
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-300 uppercase">
                  Your prompt
                </span>
              </>
            ) : (
              <>
                <span className="rounded-full bg-blue-400/15 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-blue-300 uppercase">
                  {topic.category}
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-300 uppercase">
                  {topic.difficulty}
                </span>
              </>
            )}
          </div>
          <p className="animate-fade-slide-in m-0 max-h-[88px] overflow-y-auto font-serif text-xl leading-relaxed font-medium text-white [animation-delay:100ms]">
            {displayText}
          </p>
        </div>
      )}
    </div>
  );
}
