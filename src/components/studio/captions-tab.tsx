"use client";

import { Sparkles } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import CaptionSettings from "@/components/studio/captions/caption-settings";
import CaptionList from "@/components/studio/captions/caption-list";

export default function CaptionsTab({
  onSeek,
  currentTimelineTime,
}: {
  onSeek: (timelineTime: number) => void;
  currentTimelineTime: number;
}) {
  const { words, captions, generateCaptionsFromTranscript } = useStudio();

  if (words.length === 0) {
    return (
      <div className="flex h-full flex-col items-start gap-3 p-4">
        <p className="text-foreground/60 text-sm leading-6">
          Transcribe the video first (Transcript tab), then generate captions
          from the words.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border shrink-0 border-b p-4">
        <div className="max-w-[440px] space-y-3">
          <button
            type="button"
            onClick={generateCaptionsFromTranscript}
            className="bg-foreground text-background flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" />
            {captions.length > 0 ? "Regenerate captions" : "Generate captions"}
          </button>

          {captions.length > 0 && <CaptionSettings />}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <CaptionList
          onSeek={onSeek}
          currentTimelineTime={currentTimelineTime}
        />
      </div>
    </div>
  );
}
