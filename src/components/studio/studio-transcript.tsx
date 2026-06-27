"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import TranscriptWords from "@/components/studio/transcript-words";

export default function StudioTranscript({
  currentSourceTime,
  onSeek,
}: {
  currentSourceTime: number;
  onSeek: (t: number) => void;
}) {
  const { words, transcribeStatus, transcribeProgress, transcribe } =
    useStudio();
  const hasTranscript = transcribeStatus === "done" && words.length > 0;

  return (
    <div className="border-border bg-card flex max-h-[70vh] min-h-48 flex-col overflow-hidden rounded-2xl border lg:max-h-none">
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <p className="text-foreground text-sm font-black">Transcript</p>
        {transcribeStatus === "done" && (
          <span className="text-foreground/45 text-xs">
            {words.length} words
          </span>
        )}
      </div>

      {hasTranscript ? (
        <div className="min-h-0 flex-1">
          <TranscriptWords
            currentSourceTime={currentSourceTime}
            onSeek={onSeek}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {transcribeStatus === "idle" && (
            <div className="flex flex-col items-start gap-3">
              <p className="text-foreground/60 text-sm leading-6">
                Transcribe on-device to edit by text. The first run downloads a
                small speech model to your browser; nothing is uploaded.
              </p>
              <button
                type="button"
                onClick={() => void transcribe()}
                className="bg-foreground text-background inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition-opacity hover:opacity-90"
              >
                <Sparkles className="h-4 w-4" />
                Transcribe
              </button>
            </div>
          )}

          {transcribeStatus === "loading" && (
            <div className="space-y-3">
              <p className="text-foreground/70 inline-flex items-center gap-2 text-sm font-bold">
                <Loader2 className="h-4 w-4 animate-spin" />
                Downloading speech model…
              </p>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-foreground h-full rounded-full transition-all"
                  style={{ width: `${transcribeProgress}%` }}
                />
              </div>
              <p className="text-foreground/45 text-xs">
                {transcribeProgress}%
              </p>
            </div>
          )}

          {transcribeStatus === "transcribing" && (
            <p className="text-foreground/70 inline-flex items-center gap-2 text-sm font-bold">
              <Loader2 className="h-4 w-4 animate-spin" />
              Transcribing…
            </p>
          )}

          {transcribeStatus === "error" && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-red-500">
                Couldn&apos;t transcribe this video.
              </p>
              <button
                type="button"
                onClick={() => void transcribe()}
                className="border-border text-foreground/80 hover:bg-muted rounded-full border px-4 py-2 text-xs font-bold"
              >
                Try again
              </button>
            </div>
          )}

          {transcribeStatus === "done" && words.length === 0 && (
            <p className="text-foreground/55 text-sm">No speech detected.</p>
          )}
        </div>
      )}
    </div>
  );
}
