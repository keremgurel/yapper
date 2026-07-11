"use client";

import { useEffect, useState } from "react";
import { SignInButton, useUser } from "@clerk/nextjs";
import { Loader2, Mic, Sparkles, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import FeedbackResult from "@/components/studio/feedback/feedback-result";
import type { Coaching } from "@/lib/feedback/coach";
import type { DeliveryMetrics } from "@/lib/feedback/metrics";

interface Summary {
  id: string;
  kind: "audio" | "video";
  status: "pending" | "processing" | "complete" | "failed";
  durationSec: number | null;
  scores: { delivery?: number } | null;
  createdAt: string;
}

interface Detail extends Summary {
  feedback: { metrics: DeliveryMetrics; coaching: Coaching } | null;
  mediaKey: string | null;
  error: string | null;
}

function DeleteButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-foreground/40 inline-flex items-center gap-1.5 text-xs font-bold hover:text-red-500 disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {disabled ? "Deleting…" : "Delete session"}
    </button>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export default function HistoryView() {
  const { isLoaded, isSignedIn } = useUser();
  const [list, setList] = useState<Summary[] | null>(null);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/submissions")
      .then((r) => r.json())
      .then((d) => setList(d.submissions ?? []))
      .catch(() => setList([]));
  }, [isSignedIn]);

  const open = async (id: string) => {
    setLoadingDetail(true);
    setSelected(null);
    setMediaUrl(null);
    try {
      const r = await fetch(`/api/submissions/${id}`);
      const d = await r.json();
      const sub: Detail | null = d.submission ?? null;
      setSelected(sub);
      if (sub?.mediaKey) {
        const sr = await fetch(
          `/api/media/sign?key=${encodeURIComponent(sub.mediaKey)}`,
        );
        if (sr.ok) setMediaUrl((await sr.json()).url ?? null);
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  const remove = async (id: string) => {
    setDeleting(true);
    try {
      const r = await fetch(`/api/submissions/${id}`, { method: "DELETE" });
      if (!r.ok) return;
      setList((prev) => prev?.filter((s) => s.id !== id) ?? prev);
      setSelected(null);
      setMediaUrl(null);
    } finally {
      setDeleting(false);
    }
  };

  if (isLoaded && !isSignedIn) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <p className="text-foreground text-lg font-black">Your sessions</p>
        <p className="text-foreground/55 mt-1 mb-5 text-sm">
          Sign in to see your past recordings and AI feedback in one place.
        </p>
        <SignInButton mode="modal" withSignUp>
          <Button>Sign in</Button>
        </SignInButton>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-[320px_1fr]">
      {/* List */}
      <div className="min-w-0 space-y-2">
        <h1 className="text-foreground mb-3 text-xl font-black">
          Your sessions
        </h1>
        {list === null ? (
          <div className="text-foreground/50 flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : list.length === 0 ? (
          <p className="text-foreground/55 text-sm">
            No sessions yet. Record and get AI feedback to see them here.
          </p>
        ) : (
          list.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => void open(s.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                selected?.id === s.id
                  ? "border-cyan-400 bg-cyan-500/10"
                  : "border-border hover:bg-muted/40"
              }`}
            >
              <span className="border-border bg-muted text-foreground/70 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
                {s.kind === "video" ? (
                  <Video className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground block text-[13px] font-bold">
                  {when(s.createdAt)}
                </span>
                <span className="text-foreground/50 block text-[11px]">
                  {s.status === "complete"
                    ? `Score ${s.scores?.delivery ?? "—"}`
                    : s.status === "failed"
                      ? "Failed"
                      : "Processing…"}
                </span>
              </span>
            </button>
          ))
        )}
      </div>

      {/* Detail */}
      <div className="min-w-0">
        {loadingDetail ? (
          <div className="text-foreground/50 flex items-center gap-2 py-12 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading feedback…
          </div>
        ) : selected?.feedback ? (
          <div className="space-y-4">
            {mediaUrl && (
              <video
                src={mediaUrl}
                controls
                className="w-full rounded-xl bg-black"
              />
            )}
            <FeedbackResult
              coaching={selected.feedback.coaching}
              metrics={selected.feedback.metrics}
            />
            <DeleteButton
              onClick={() => void remove(selected.id)}
              disabled={deleting}
            />
          </div>
        ) : selected ? (
          // A saved take without feedback is still re-watchable.
          <div className="space-y-4 py-4">
            {mediaUrl && (
              <video
                src={mediaUrl}
                controls
                className="w-full rounded-xl bg-black"
              />
            )}
            <p className="text-foreground/55 text-sm">
              No feedback stored for this session
              {selected.error ? ` (${selected.error})` : ""}.
            </p>
            <DeleteButton
              onClick={() => void remove(selected.id)}
              disabled={deleting}
            />
          </div>
        ) : (
          <div className="text-foreground/40 flex flex-col items-center gap-2 py-16 text-center text-sm">
            <Sparkles className="h-6 w-6" />
            Pick a session to see its feedback.
          </div>
        )}
      </div>
    </div>
  );
}
