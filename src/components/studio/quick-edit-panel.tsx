"use client";

import { useEffect, useRef } from "react";
import {
  Captions,
  FileText,
  Loader2,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import StudioTranscript from "@/components/studio/studio-transcript";
import { useStudio } from "@/components/studio/studio-context";

export default function QuickEditPanel({
  currentTimelineTime,
  onSeek,
  onOpenText,
}: {
  currentTimelineTime: number;
  onSeek: (time: number) => void;
  onOpenText: () => void;
}) {
  const {
    source,
    words,
    captions,
    transcribe,
    transcribeStatus,
    autoEdit,
    autoEditing,
    generateCaptionsFromTranscript,
    addTextHook,
    updateTextHook,
  } = useStudio();
  const captionAfterTranscript = useRef(false);
  const hasVideo = !!source && source.kind !== "image";
  const spokenCaptionCount = captions.filter(
    (caption) => caption.kind !== "hook",
  ).length;

  useEffect(() => {
    if (
      !captionAfterTranscript.current ||
      transcribeStatus !== "done" ||
      words.length === 0
    )
      return;
    generateCaptionsFromTranscript();
    captionAfterTranscript.current = false;
  }, [generateCaptionsFromTranscript, transcribeStatus, words.length]);

  const addCaptions = () => {
    if (words.length > 0) {
      generateCaptionsFromTranscript();
      return;
    }
    captionAfterTranscript.current = true;
    void transcribe();
  };

  const addHook = () => {
    const id = addTextHook("Your hook", "white-card", currentTimelineTime);
    if (id) {
      updateTextHook(id, {
        textColor: "#090909",
        backgroundColor: "#ffffff",
        y: 0.16,
      });
    }
    onOpenText();
  };

  const busy = autoEditing || transcribeStatus === "transcribing";

  return (
    <div className="bg-card flex h-full min-h-0 flex-col">
      <div className="border-border shrink-0 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[color:var(--sg-accent)]/12 text-[color:var(--sg-accent)]">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-foreground text-sm font-black">Quick edit</p>
            <p className="text-foreground/40 text-[10px]">
              The four things you use every time
            </p>
          </div>
        </div>
      </div>

      <div className="border-border shrink-0 border-b p-3">
        <div className="grid grid-cols-2 gap-2">
          <QuickButton
            icon={transcribeStatus === "transcribing" ? Loader2 : FileText}
            spinning={transcribeStatus === "transcribing"}
            label={words.length > 0 ? "Transcribe again" : "Transcribe"}
            hint="Editable words"
            disabled={!hasVideo || busy}
            onClick={() => void transcribe()}
          />
          <QuickButton
            icon={autoEditing ? Loader2 : Wand2}
            spinning={autoEditing}
            label={autoEditing ? "Editing…" : "1 click edit"}
            hint="Retakes + pauses"
            disabled={!hasVideo || busy}
            onClick={() => void autoEdit(false)}
          />
          <QuickButton
            icon={transcribeStatus === "transcribing" ? Loader2 : Captions}
            spinning={transcribeStatus === "transcribing"}
            label={spokenCaptionCount > 0 ? "Refresh captions" : "Add captions"}
            hint={words.length > 0 ? "From transcript" : "Transcribes first"}
            disabled={!hasVideo || busy}
            onClick={addCaptions}
          />
          <QuickButton
            icon={Type}
            label="Add text hook"
            hint="At the playhead"
            disabled={!source}
            onClick={addHook}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {words.length > 0 ? (
          <StudioTranscript
            currentTimelineTime={currentTimelineTime}
            onSeek={onSeek}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <span className="border-border bg-muted mb-3 grid h-11 w-11 place-items-center rounded-xl border">
              <FileText className="text-foreground/40 h-5 w-5" />
            </span>
            <p className="text-foreground text-xs font-black">
              Transcript appears here
            </p>
            <p className="text-foreground/45 mt-1 max-w-[26ch] text-[11px] leading-4">
              Transcribe first, or run 1 click edit. Then edit the video by
              editing its words.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickButton({
  icon: Icon,
  label,
  hint,
  disabled,
  spinning,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  hint: string;
  disabled?: boolean;
  spinning?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="border-border bg-muted/25 hover:border-foreground/25 hover:bg-muted group rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-35"
    >
      <Icon
        className={`mb-3 h-4 w-4 text-[color:var(--sg-accent)] ${spinning ? "animate-spin" : ""}`}
      />
      <span className="text-foreground block text-[11px] font-black">
        {label}
      </span>
      <span className="text-foreground/40 mt-0.5 block text-[9px]">{hint}</span>
    </button>
  );
}
