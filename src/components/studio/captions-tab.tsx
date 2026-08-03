"use client";

import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import CaptionSettings from "@/components/studio/captions/caption-settings";
import CaptionList from "@/components/studio/captions/caption-list";
import { Button } from "@/components/ui/button";

export default function CaptionsTab({
  onSeek,
  currentTimelineTime,
}: {
  onSeek: (timelineTime: number) => void;
  currentTimelineTime: number;
}) {
  const {
    words,
    captions,
    generateCaptionsFromTranscript,
    retranscribeCurrentCut,
    recaptioning,
    recaptionError,
  } = useStudio();

  const retranscribeControl = (
    <>
      <Button
        type="button"
        onClick={() => void retranscribeCurrentCut()}
        disabled={recaptioning}
        variant="outline"
        size="sm"
        className="w-full disabled:cursor-wait"
        title="Listen only to the clips currently on the main timeline and replace the captions"
      >
        {recaptioning ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {recaptioning
          ? "Retranscribing current cut…"
          : "Retranscribe current cut"}
      </Button>

      <p className="text-foreground/50 text-xs leading-5">
        Use this after manual cuts. It listens to the edited main track, not the
        original full recording.
      </p>

      {recaptionError && (
        <p className="text-xs leading-5 font-semibold text-red-500">
          {recaptionError}
        </p>
      )}
    </>
  );

  if (words.length === 0) {
    return (
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="flex flex-col items-start gap-3 p-4">
          <p className="text-foreground/60 text-sm leading-6">
            Spoken captions can be generated from a transcript, or by listening
            directly to the current edited main track.
          </p>
          {retranscribeControl}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="border-border flex shrink-0 items-center justify-end gap-2 border-b px-3 py-2">
        <Button
          type="button"
          onClick={generateCaptionsFromTranscript}
          size="sm"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {captions.length > 0 ? "Regenerate" : "Generate captions"}
        </Button>
      </div>
      <div className="border-border shrink-0 border-b p-4">
        <div className="max-w-[440px] space-y-3">
          {retranscribeControl}

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
