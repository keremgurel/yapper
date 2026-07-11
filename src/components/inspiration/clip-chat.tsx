"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import VoiceNoteButton from "@/components/common/voice-note-button";
import { usePillarNames } from "@/hooks/use-pillar-names";
import { brainstormReply, captureContent } from "@/lib/content/client";
import type { ClipContext } from "@/lib/content/brainstorm";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const CLOSE_MS = 160;

/** The create-off-inspiration chat: opens on a clip, kicks off with an AI
 * breakdown of its hook + angles for your own version, then collaborates. "Save
 * as idea" pipes the conversation through capture into a Content Library entry. */
export default function ClipChat({
  clip,
  onClose,
}: {
  clip: ClipContext;
  onClose: () => void;
}) {
  const router = useRouter();
  const pillars = usePillarNames();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async (next: Msg[]) => {
    setFailed(false);
    setThinking(true);
    try {
      const reply = await brainstormReply({
        messages: next,
        clip: clip as unknown as Record<string, unknown>,
        pillars,
      });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch {
      // Keep the turn we tried to send so "Try again" can re-run it.
      setMessages(next);
      setFailed(true);
    } finally {
      setThinking(false);
    }
  };

  // Animate in, lock scroll, wire Escape, and kick off the analysis once.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    if (!started.current) {
      started.current = true;
      void send([]);
    }
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the transcript pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, thinking]);

  const close = () => {
    setOpen(false);
    window.setTimeout(onClose, CLOSE_MS);
  };

  const submit = () => {
    const text = input.trim();
    if (!text || thinking) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    void send(next);
  };

  const saveAsIdea = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Feed the whole discussion (grounded in the clip) to the capture funnel.
      const convo = messages
        .map((m) => `${m.role === "user" ? "Me" : "Assistant"}: ${m.content}`)
        .join("\n\n");
      const text = `Reference clip: ${clip.title}\n\n${convo}`;
      const { item } = await captureContent(text, pillars);
      router.push(`/studio/library/${item.id}`);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div
      className={`t-scrim fixed inset-0 z-[300] flex items-end justify-center bg-black/60 backdrop-blur-md sm:items-center sm:p-4 ${open ? "is-open" : ""}`}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Create from this clip"
    >
      <div
        className={`t-modal sg-panel flex max-h-[88svh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl ${open ? "is-open" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-border flex items-center gap-3 border-b p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--sg-accent)]/15 text-[color:var(--sg-accent)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-foreground truncate text-sm font-black">
              Make your own from this
            </h2>
            <p className="text-foreground/55 truncate text-xs">{clip.title}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="text-foreground/50 hover:bg-muted hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && thinking && (
            <p
              className="t-shimmer text-sm"
              data-text="Breaking down the hook…"
            >
              Breaking down the hook…
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex"}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-[color:var(--sg-accent)] text-white"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {messages.length > 0 && thinking && (
            <div className="flex">
              <div className="bg-muted text-foreground/60 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            </div>
          )}
          {failed && !thinking && (
            <div className="flex flex-col items-start gap-2">
              <div className="bg-muted text-foreground/70 rounded-2xl px-3.5 py-2.5 text-sm">
                Couldn&apos;t reach the assistant.
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void send(messages)}
              >
                <RotateCcw className="h-4 w-4" />
                Try again
              </Button>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-border border-t p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Riff back, pick an angle, or ask for a hook…"
              rows={1}
              className="border-border bg-background text-foreground focus:border-foreground/40 max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border px-3 py-2.5 text-sm outline-none select-text"
            />
            <VoiceNoteButton
              onText={(t) => setInput((p) => (p ? `${p} ${t}` : t))}
            />
            <Button
              type="button"
              size="icon"
              onClick={submit}
              disabled={thinking || !input.trim()}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="contrast"
              size="sm"
              onClick={() => void saveAsIdea()}
              disabled={saving || messages.length === 0}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Save as content idea
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
