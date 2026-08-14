"use client";

import { useEffect, useRef } from "react";
import {
  Captions,
  ChevronRight,
  FileText,
  Loader2,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";

export default function QuickEditPanel({
  currentTimelineTime,
  onOpenText,
  onOpenTranscript,
  embedded = false,
}: {
  currentTimelineTime: number;
  onOpenText: () => void;
  onOpenTranscript?: () => void;
  embedded?: boolean;
}) {
  const {
    source,
    words,
    captions,
    transcribe,
    transcribeStatus,
    cancelTranscription,
    autoEdit,
    autoEditing,
    recaptioning,
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

  const runTranscription = () => {
    void transcribe().then(() => onOpenTranscript?.());
  };
  const busy =
    autoEditing || recaptioning || transcribeStatus === "transcribing";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      {!embedded && (
        <div className="border-border shrink-0 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles
              aria-hidden="true"
              className="h-4 w-4 text-[color:var(--sg-accent)]"
            />
            <p className="text-foreground text-sm font-bold">Quick Edit</p>
          </div>
        </div>
      )}

      <div className="space-y-5 p-4">
        <div>
          <p className="text-foreground text-sm font-bold">
            Start with the cut
          </p>
          <p className="text-foreground/45 mt-1 text-xs leading-5">
            Run the common editing actions without leaving your workspace.
          </p>
        </div>

        <div className="border-border overflow-hidden rounded-lg border">
          {busy && (
            <button
              type="button"
              className="border-border text-foreground/70 w-full border-b px-3 py-2 text-xs font-bold"
              onClick={cancelTranscription}
            >
              Cancel current operation
            </button>
          )}
          <QuickRow
            icon={transcribeStatus === "transcribing" ? Loader2 : FileText}
            spinning={transcribeStatus === "transcribing"}
            label={words.length > 0 ? "Transcribe Again" : "Transcribe"}
            hint="Create editable words from the recording"
            disabled={!hasVideo || busy}
            onClick={runTranscription}
          />
          <QuickRow
            icon={autoEditing ? Loader2 : Wand2}
            spinning={autoEditing}
            label={autoEditing ? "Editing…" : "1-Click Edit"}
            hint="Remove retakes, false starts, and dead pauses"
            disabled={!hasVideo || busy}
            onClick={() => void autoEdit(false)}
          />
          <QuickRow
            icon={transcribeStatus === "transcribing" ? Loader2 : Captions}
            spinning={transcribeStatus === "transcribing"}
            label={spokenCaptionCount > 0 ? "Refresh Captions" : "Add Captions"}
            hint={
              words.length > 0
                ? "Build captions from the transcript"
                : "Transcribe, then create timed captions"
            }
            disabled={!hasVideo || busy}
            onClick={addCaptions}
          />
          <QuickRow
            icon={Type}
            label="Add Text Hook"
            hint="Place a styled hook at the playhead"
            disabled={!source}
            onClick={addHook}
            last
          />
        </div>

        {words.length > 0 && onOpenTranscript && (
          <button
            type="button"
            onClick={onOpenTranscript}
            className="text-foreground/60 hover:bg-muted hover:text-foreground flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-bold focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)]"
          >
            Open Transcript
            <span className="text-foreground/35 tabular-nums">
              {words.length} words
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

function QuickRow({
  icon: Icon,
  label,
  hint,
  disabled,
  spinning,
  last = false,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  hint: string;
  disabled?: boolean;
  spinning?: boolean;
  last?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group hover:bg-muted flex w-full items-center gap-3 bg-transparent px-3 py-3 text-left transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-35 ${last ? "" : "border-border border-b"}`}
    >
      <span className="bg-muted text-foreground/60 grid h-8 w-8 shrink-0 place-items-center rounded-md group-hover:text-[color:var(--sg-accent)]">
        <Icon
          aria-hidden="true"
          className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block text-xs font-bold">{label}</span>
        <span className="text-foreground/40 mt-0.5 block truncate text-[10px]">
          {hint}
        </span>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="text-foreground/20 group-hover:text-foreground/50 h-3.5 w-3.5"
      />
    </button>
  );
}
