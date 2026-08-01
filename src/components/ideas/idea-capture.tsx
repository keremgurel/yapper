"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Link2,
  Loader2,
  Mic,
  Music2,
  Plus,
  Square,
  X,
} from "lucide-react";
import { useVoiceCapture } from "@/hooks/use-voice-capture";
import VoiceWaveform from "@/components/common/voice-waveform";
import { detectPlatform } from "@/lib/inspiration/platform";
import type { Platform } from "@/lib/inspiration/types";

const DRAFT_KEY = "yapper.idea.draft";
const URL_PATTERN = /https?:\/\/[^\s]+/i;

type ComposerDraft = { text: string; link: string | null };

function pullLink(value: string): ComposerDraft {
  const match = value.match(URL_PATTERN);
  if (!match) return { text: value, link: null };
  return {
    link: match[0].replace(/[),.;]+$/, ""),
    text: value
      .replace(match[0], " ")
      .replace(/\s{2,}/g, " ")
      .trimStart(),
  };
}

function durationLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function PlatformMark({ platform }: { platform: Platform }) {
  if (platform === "instagram") {
    return (
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-[radial-gradient(circle_at_68%_68%,#ffd600_0_18%,#ff7a00_32%,#ff0169_56%,#d300c5_76%,#7638fa_100%)] text-white shadow-sm">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
          <rect
            x="3.5"
            y="3.5"
            width="17"
            height="17"
            rx="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <circle
            cx="12"
            cy="12"
            r="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <circle cx="17.7" cy="6.7" r="1.15" fill="currentColor" />
        </svg>
      </span>
    );
  }
  if (platform === "youtube") {
    return (
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-[#ff0033] text-white shadow-sm">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
          <path d="m9.5 7.8 7 4.2-7 4.2Z" fill="currentColor" />
        </svg>
      </span>
    );
  }
  if (platform === "tiktok") {
    return (
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-black text-white shadow-sm ring-1 ring-white/10">
        <Music2 aria-hidden="true" className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="bg-background text-muted-foreground grid h-6 w-6 shrink-0 place-items-center rounded-[6px] shadow-sm">
      <Link2 aria-hidden="true" className="h-4 w-4" />
    </span>
  );
}

/** Chat-style composer for every kind of idea: text, one reference attachment,
 * or voice. Links become a visual attachment instead of polluting the writing
 * surface, while submit still preserves the exact URL for the idea pipeline. */
export default function IdeaCapture({
  onCapture,
}: {
  onCapture: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const { phase, error, stream, start, stop, cancel } = useVoiceCapture();

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as ComposerDraft;
      if (typeof parsed.text === "string") setText(parsed.text);
      if (typeof parsed.link === "string") setLink(parsed.link);
    } catch {
      // Drafts from the previous plain-text composer remain valid.
      const parsed = pullLink(saved);
      setText(parsed.text);
      setLink(parsed.link);
    }
  }, []);

  useEffect(() => {
    if (!text && !link) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ text, link }));
  }, [text, link]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 76), 300)}px`;
  }, [text, link]);

  useEffect(() => {
    if (phase !== "recording") {
      setRecordingSeconds(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(
      () => setRecordingSeconds(Math.floor((Date.now() - started) / 1_000)),
      250,
    );
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "recording") return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      cancel();
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [phase, cancel]);

  const recording = phase === "recording";
  const transcribing = phase === "transcribing";
  const canSubmit = Boolean(text.trim() || link || recording);
  const platform = link ? detectPlatform(link) : "unknown";

  const updateText = (value: string) => {
    if (link) return setText(value);
    const next = pullLink(value);
    setText(next.text);
    if (next.link) setLink(next.link);
  };

  const finishRecording = async (): Promise<string> => {
    if (!recording) return "";
    const heard = await stop();
    if (heard) setText((current) => (current ? `${current} ${heard}` : heard));
    ref.current?.focus();
    return heard;
  };

  const submit = async () => {
    let words = text.trim();
    if (recording) {
      const heard = await finishRecording();
      words = [words, heard].filter(Boolean).join(" ");
    }
    const capture = [words, link].filter(Boolean).join("\n").trim();
    if (!capture) return;
    onCapture(capture);
    setText("");
    setLink(null);
  };

  const toggleVoice = async () => {
    if (phase === "idle") await start();
    else if (recording) await finishRecording();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        event.key.toLowerCase() === "d"
      ) {
        event.preventDefault();
        void toggleVoice();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // The shortcut deliberately follows the current recorder phase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("text/uri-list"))
          event.preventDefault();
      }}
      onDrop={(event) => {
        const dropped =
          event.dataTransfer.getData("text/uri-list") ||
          event.dataTransfer.getData("text/plain");
        const next = pullLink(dropped);
        if (!next.link) return;
        event.preventDefault();
        setLink(next.link);
      }}
      className="border-border/80 bg-muted/80 focus-within:border-foreground/25 rounded-[28px] border p-3 shadow-sm transition-[border-color,box-shadow] duration-200 focus-within:shadow-md dark:bg-[#2b2b2b]"
    >
      <textarea
        ref={ref}
        value={text}
        onChange={(event) => updateText(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder="Ask Chirpy for ideas, paste a reference, or capture a thought…"
        rows={2}
        className="text-foreground placeholder:text-muted-foreground/75 max-h-[300px] min-h-[76px] w-full resize-none bg-transparent px-3 py-2 text-[16px] leading-7 outline-none"
      />

      {link && (
        <div className="group/link animate-in fade-in slide-in-from-bottom-1 mx-3 mb-2 flex min-w-0 items-center gap-2 duration-150">
          <PlatformMark platform={platform} />
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 truncate text-[16px] leading-6 font-medium text-[#78baff] underline-offset-2 hover:underline dark:text-[#8ec7ff]"
          >
            {link}
          </a>
          <button
            type="button"
            aria-label="Remove link"
            title="Remove link"
            onClick={() => {
              setLink(null);
              ref.current?.focus();
            }}
            className="text-muted-foreground hover:bg-background/70 hover:text-foreground ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full opacity-0 transition-[opacity,color,background-color] duration-150 group-hover/link:opacity-100 focus-visible:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex min-h-11 items-end gap-2 px-1 pb-0.5">
        <button
          type="button"
          onClick={() => ref.current?.focus()}
          aria-label="Add a reference"
          title="Paste or drop a link"
          className="text-muted-foreground hover:bg-background/70 hover:text-foreground grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-150"
        >
          <Plus className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          {recording ? (
            <div className="animate-in fade-in slide-in-from-bottom-1 flex h-10 items-center justify-end gap-3 duration-200">
              <span className="border-muted-foreground/40 hidden min-w-0 flex-1 border-b border-dashed sm:block" />
              <VoiceWaveform
                stream={stream}
                className="text-foreground h-10 w-[min(34vw,220px)]"
              />
              <span className="text-muted-foreground w-9 text-right text-sm tabular-nums">
                {durationLabel(recordingSeconds)}
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground truncate pb-2 text-xs">
              {error ??
                (transcribing ? "Transcribing your thought…" : "⌘D to dictate")}
            </p>
          )}
        </div>

        {recording ? (
          <button
            type="button"
            onClick={() => void finishRecording()}
            aria-label="Stop dictating"
            title="Stop dictating"
            className="bg-background/70 text-foreground grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform duration-150 hover:scale-105"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void toggleVoice()}
            disabled={transcribing}
            aria-label="Dictate an idea"
            title="Dictate an idea"
            className="text-foreground hover:bg-background/70 grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-150 disabled:opacity-50"
          >
            {transcribing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit || transcribing}
          aria-label="Add to Idea Bank"
          title="Add to Idea Bank"
          className="bg-foreground text-background grid h-11 w-11 shrink-0 place-items-center rounded-full shadow-sm transition-[transform,opacity] duration-150 hover:scale-105 disabled:scale-100 disabled:opacity-35"
        >
          <ArrowUp className="h-5 w-5 stroke-[2.4]" />
        </button>
      </div>
    </div>
  );
}
