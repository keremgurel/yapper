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
  Wand2,
} from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import TranscriptWords from "@/components/studio/transcript-words";
import { Button } from "@/components/ui/button";

export default function StudioTranscript({
  currentTimelineTime,
  onSeek,
}: {
  currentTimelineTime: number;
  onSeek: (t: number) => void;
}) {
  const {
    source,
    words,
    transcribeStatus,
    transcribe,
    autoEdit,
    autoEditing,
    autoEditCaptions,
  } = useStudio();
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
            currentTimelineTime={currentTimelineTime}
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

              <div className="space-y-2">
                <Button
                  type="button"
                  onClick={() => void autoEdit(true)}
                  disabled={autoEditing}
                  className="w-full"
                  title="Clean the cut and add captions"
                >
                  {autoEditing && autoEditCaptions ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {autoEditing && autoEditCaptions
                    ? "Editing…"
                    : "1-Click Edit + Captions"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void autoEdit(false)}
                  disabled={autoEditing}
                  className="w-full"
                  title="Clean the cut without adding captions"
                >
                  {autoEditing && !autoEditCaptions ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {autoEditing && !autoEditCaptions
                    ? "Editing…"
                    : "1-Click Edit (no captions)"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void transcribe()}
                  className="w-full"
                >
                  <Sparkles className="h-4 w-4" />
                  Just transcribe
                </Button>
              </div>

              <p className="text-foreground/45 text-[11.5px] leading-4">
                The first transcription can take a moment while your audio is
                processed.
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
