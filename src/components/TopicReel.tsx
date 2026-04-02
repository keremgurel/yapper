"use client";

import { useRef, useCallback } from "react";
import type { Topic } from "@/data/topics";

interface TopicReelProps {
  topic: Topic;
  spinning: boolean;
  reelBlurbs: string[];
  promptOverride: string | null;
  promptDraft: string;
  promptEditing?: boolean;
  onPromptDoubleTap?: () => void;
  onPromptDraftChange?: (value: string) => void;
  onPromptSave?: () => void;
  onPromptCancel?: () => void;
  promptEditable?: boolean;
}

export default function TopicReel({
  topic,
  spinning,
  reelBlurbs,
  promptOverride,
  promptDraft,
  promptEditing = false,
  onPromptDoubleTap,
  onPromptDraftChange,
  onPromptSave,
  onPromptCancel,
  promptEditable = false,
}: TopicReelProps) {
  const lastTapRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const glassPanelClass =
    "relative flex h-[150px] w-full flex-col items-center justify-center overflow-hidden rounded-[28px] border border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0.1))] px-7 py-7 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_24px_48px_rgba(15,23,42,0.18)] backdrop-blur-2xl";

  const tryDoubleTap = useCallback(() => {
    if (!promptEditable || spinning || promptEditing) return;
    onPromptDoubleTap?.();
  }, [promptEditable, spinning, promptEditing, onPromptDoubleTap]);

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
    <div className={glassPanelClass}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_38%,rgba(255,255,255,0.04))]" />
      {spinning ? (
        <div className="animate-reel-spin relative flex flex-col gap-4">
          {reelBlurbs.map((t, i) => (
            <p
              key={i}
              className="m-0 font-sans text-lg text-white/56 opacity-80 blur-[2px]"
            >
              {t}
            </p>
          ))}
        </div>
      ) : promptEditing ? (
        <div className="relative flex w-full flex-col items-center justify-center">
          <textarea
            ref={textareaRef}
            value={promptDraft}
            onChange={(e) => onPromptDraftChange?.(e.target.value)}
            onBlur={() => onPromptSave?.()}
            onFocus={(e) => {
              if (e.target.value.length === 0) return;
              e.target.setSelectionRange(
                e.target.value.length,
                e.target.value.length,
              );
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onPromptCancel?.();
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onPromptSave?.();
              }
            }}
            rows={3}
            className="w-full resize-none bg-transparent p-0 text-center font-sans text-xl leading-relaxed font-medium text-white outline-none placeholder:text-white/38"
            placeholder="Type your speaking prompt"
            autoFocus
          />
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
              ? "cursor-pointer rounded-xl select-none focus-visible:ring-2 focus-visible:ring-white/50"
              : ""
          }`}
        >
          <div className="animate-fade-slide-in mb-4 flex justify-center gap-2 [animation-delay:50ms]">
            {isCustom ? (
              <>
                <span className="rounded-full border border-white/14 bg-white/16 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/92 uppercase backdrop-blur-xl">
                  Custom
                </span>
                <span className="rounded-full border border-white/12 bg-black/12 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/72 uppercase backdrop-blur-xl">
                  Your prompt
                </span>
              </>
            ) : (
              <>
                <span className="rounded-full border border-white/14 bg-white/16 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/92 uppercase backdrop-blur-xl">
                  {topic.category}
                </span>
                <span className="rounded-full border border-white/12 bg-black/12 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/72 uppercase backdrop-blur-xl">
                  {topic.difficulty}
                </span>
              </>
            )}
          </div>
          <p className="animate-fade-slide-in m-0 max-h-[88px] overflow-y-auto font-sans text-xl leading-relaxed font-medium text-white [animation-delay:100ms]">
            {displayText}
          </p>
        </div>
      )}
    </div>
  );
}
