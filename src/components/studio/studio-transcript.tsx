"use client";

import { useState } from "react";
import {
  Captions,
  Eraser,
  Eye,
  EyeOff,
  Loader2,
  Scissors,
  Sparkles,
  Type,
} from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import TranscriptWords from "@/components/studio/transcript-words";

export default function StudioTranscript({
  currentSourceTime,
  onSeek,
}: {
  currentSourceTime: number;
  onSeek: (t: number) => void;
}) {
  const { source, words, transcribeStatus, transcribeProgress, transcribe } =
    useStudio();
  const hasTranscript = transcribeStatus === "done" && words.length > 0;
  const isImage = source?.kind === "image";
  const [showDeleted, setShowDeleted] = useState(true);

  return (
    <div className="bg-card flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <p className="text-foreground text-sm font-black">Transcript</p>
        {hasTranscript && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowDeleted((s) => !s)}
              className="text-foreground/50 hover:text-foreground inline-flex items-center gap-1.5 text-xs font-bold"
              title={showDeleted ? "Hide deleted words" : "Show deleted words"}
            >
              {showDeleted ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              {showDeleted ? "Hide deleted" : "Show deleted"}
            </button>
            <span className="text-foreground/45 text-xs">
              {words.length} words
            </span>
          </div>
        )}
      </div>

      {hasTranscript ? (
        <div className="min-h-0 flex-1">
          <TranscriptWords
            currentSourceTime={currentSourceTime}
            onSeek={onSeek}
            showDeleted={showDeleted}
          />
        </div>
      ) : isImage ? (
        <div className="flex-1 p-4">
          <p className="text-foreground/55 text-sm">
            This is an image — no audio to transcribe.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {transcribeStatus === "idle" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-2 pt-2 text-center">
                <div className="border-border bg-muted flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm">
                  <Type className="text-foreground/60 h-5 w-5" />
                </div>
                <p className="text-foreground text-sm font-black">
                  Edit your video by editing the text
                </p>
                <p className="text-foreground/55 max-w-[46ch] text-[13px] leading-5">
                  Turn the audio into an editable transcript, then reshape the
                  cut just by changing words.
                </p>
              </div>

              <ul className="space-y-2">
                {[
                  {
                    icon: Scissors,
                    text: "Delete a word and it's cut from the video",
                  },
                  {
                    icon: Eraser,
                    text: "One tap to strip fillers and dead silence",
                  },
                  {
                    icon: Captions,
                    text: "Generate captions straight from the transcript",
                  },
                ].map(({ icon: Icon, text }) => (
                  <li
                    key={text}
                    className="text-foreground/75 flex items-center gap-2.5 text-[13px]"
                  >
                    <span className="border-border bg-muted text-foreground/70 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => void transcribe()}
                className="bg-foreground text-background inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-opacity hover:opacity-90"
              >
                <Sparkles className="h-4 w-4" />
                Transcribe
              </button>

              <p className="text-foreground/45 text-[11.5px] leading-4">
                The first transcription can take a moment while your audio is
                processed.
              </p>
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
