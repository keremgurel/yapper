"use client";

import { useState } from "react";
import { Loader2, Plus, RefreshCw, Sparkles, Type } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import CaptionSettings from "@/components/studio/captions/caption-settings";
import CaptionList from "@/components/studio/captions/caption-list";
import type { TextHookPreset } from "@/lib/studio/types";

const HOOK_PRESETS: Array<{
  id: TextHookPreset;
  label: string;
  className: string;
}> = [
  {
    id: "white-card",
    label: "White background",
    className: "bg-white text-black",
  },
  {
    id: "white-text",
    label: "White text",
    className: "bg-zinc-700 text-white",
  },
  {
    id: "black-card",
    label: "Black background",
    className: "bg-black text-white ring-1 ring-white/15",
  },
];

export default function CaptionsTab({
  onSeek,
  currentTimelineTime,
}: {
  onSeek: (timelineTime: number) => void;
  currentTimelineTime: number;
}) {
  const [hookText, setHookText] = useState("");
  const [hookPreset, setHookPreset] = useState<TextHookPreset>("white-card");
  const {
    words,
    captions,
    generateCaptionsFromTranscript,
    retranscribeCurrentCut,
    recaptioning,
    recaptionError,
    addTextHook,
  } = useStudio();

  const addHook = () => {
    if (!hookText.trim()) return;
    addTextHook(hookText, hookPreset, currentTimelineTime);
    setHookText("");
  };

  const hookBuilder = (
    <section className="border-border border-b p-4">
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[color:color-mix(in_srgb,var(--sg-accent)_12%,transparent)] text-[color:var(--sg-accent)]">
          <Type className="h-3.5 w-3.5" />
        </span>
        <div>
          <h3 className="text-foreground text-sm font-black">Text hooks</h3>
          <p className="text-muted-foreground mt-0.5 text-xs leading-5">
            Add a top-line hook on its own timeline track. It starts at the
            playhead and lasts four seconds.
          </p>
        </div>
      </div>

      <textarea
        value={hookText}
        onChange={(event) => setHookText(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            addHook();
          }
        }}
        rows={2}
        placeholder="e.g. The mistake keeping your videos boring"
        className="border-border bg-background text-foreground placeholder:text-muted-foreground w-full resize-none rounded-xl border px-3 py-2.5 text-sm font-bold transition outline-none focus:border-[color:var(--sg-accent)]"
      />

      <div className="mt-3 grid grid-cols-3 gap-2">
        {HOOK_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setHookPreset(preset.id)}
            className={`rounded-xl border p-1.5 text-left transition ${
              hookPreset === preset.id
                ? "border-[color:var(--sg-accent)]"
                : "border-border hover:border-foreground/25"
            }`}
          >
            <span
              className={`flex min-h-14 items-center justify-center rounded-lg px-2 text-center text-[10px] leading-tight font-black shadow-sm ${preset.className}`}
            >
              Your hook
            </span>
            <span className="text-muted-foreground mt-1.5 block truncate px-0.5 text-[10px] font-bold">
              {preset.label}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!hookText.trim()}
        onClick={addHook}
        className="bg-foreground text-background mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition hover:opacity-90 disabled:opacity-35"
      >
        <Plus className="h-4 w-4" />
        Add hook at playhead
      </button>
    </section>
  );

  const retranscribeControl = (
    <>
      <button
        type="button"
        onClick={() => void retranscribeCurrentCut()}
        disabled={recaptioning}
        className="border-border text-foreground hover:bg-muted flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition-colors disabled:cursor-wait disabled:opacity-60"
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
      </button>

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
      <div className="flex h-full min-h-0 flex-col">
        {hookBuilder}
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
    <div className="flex h-full min-h-0 flex-col">
      {hookBuilder}
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
