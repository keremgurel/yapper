"use client";

import { Captions, Loader2, Sparkles, Type } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";

const ACTION =
  "flex flex-1 flex-col items-center gap-1.5 rounded-xl border border-border px-2 py-3 text-center transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Placing a cutaway needs the words, and there is no reason to send anyone
 * looking for them. The three passes that produce a transcript are right here,
 * and the bar becomes a command box the moment one of them finishes.
 */
export default function AiTranscribePrompt() {
  const { transcribe, transcribeStatus, autoEdit, autoEditing } = useStudio();
  const busy = transcribeStatus === "transcribing" || autoEditing;

  if (busy) {
    return (
      <div className="text-foreground/60 flex items-center justify-center gap-2 py-4 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        {autoEditing ? "Editing your video" : "Reading your video"}
      </div>
    );
  }

  return (
    <div>
      <p className="text-foreground/55 mb-2.5 text-sm">
        First I need the words. Pick one, and I will know where everything is
        said.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void transcribe()}
          className={ACTION}
        >
          <Type className="text-foreground/60 h-5 w-5" />
          <span className="text-sm font-bold">Transcribe</span>
          <span className="text-foreground/50 text-xs leading-tight">
            Just the words
          </span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void autoEdit(false)}
          className={ACTION}
        >
          <Sparkles className="h-5 w-5 text-[color:var(--sg-accent)]" />
          <span className="text-sm font-bold">1-Click Edit</span>
          <span className="text-foreground/50 text-xs leading-tight">
            Cut the retakes
          </span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void autoEdit(true)}
          className={ACTION}
        >
          <Captions className="h-5 w-5 text-[color:var(--sg-accent)]" />
          <span className="text-sm font-bold">Edit + Captions</span>
          <span className="text-foreground/50 text-xs leading-tight">
            And burn them in
          </span>
        </button>
      </div>
    </div>
  );
}
