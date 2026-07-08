"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import VoiceNoteButton from "@/components/common/voice-note-button";
import { captureContent, type ContentDetail } from "@/lib/content/client";
import { loadPillars } from "@/lib/inspiration/store";

/** The frictionless front door to the library: talk or type a rough idea and we
 * title it, classify it into a pillar, and draft starter hooks — no form. */
export default function IdeaCapture({
  onCaptured,
}: {
  onCaptured: (item: ContentDetail) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pillarsRef = useRef<string[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    pillarsRef.current = loadPillars().map((p) => p.name);
  }, []);

  const capture = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { item } = await captureContent(value, pillarsRef.current);
      setText("");
      onCaptured(item);
    } catch {
      setError("Couldn't capture that — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-border bg-card rounded-2xl border p-4 shadow-sm transition-colors focus-within:border-[color:var(--sg-accent)]/50">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--sg-accent)]/15 text-[color:var(--sg-accent)]">
          <Sparkles className="h-4 w-4" />
        </span>
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void capture();
            }
          }}
          placeholder="Drop an idea… talk it out or type. We'll title it, sort it into a pillar, and draft the hooks."
          rows={2}
          disabled={busy}
          className="text-foreground placeholder:text-foreground/45 min-w-0 flex-1 resize-none bg-transparent pt-1.5 text-[15px] leading-relaxed outline-none select-text disabled:opacity-60"
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 pl-12">
        <span className="text-foreground/45 text-xs">
          {busy ? (
            <span className="t-shimmer" data-text="Enriching your idea…">
              Enriching your idea…
            </span>
          ) : error ? (
            <span className="font-bold text-red-500">{error}</span>
          ) : (
            "⌘↵ to capture"
          )}
        </span>
        <div className="flex items-center gap-2">
          <VoiceNoteButton
            onText={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))}
          />
          <Button
            type="button"
            onClick={() => void capture()}
            disabled={busy || !text.trim()}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Capture
          </Button>
        </div>
      </div>
    </div>
  );
}
