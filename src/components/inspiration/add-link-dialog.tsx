"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import PlatformBadge from "@/components/inspiration/platform-badge";
import KindToggle from "@/components/inspiration/kind-toggle";
import VoiceNoteButton from "@/components/common/voice-note-button";
import { useInspiration } from "@/components/inspiration/inspiration-context";
import {
  detectKind,
  detectPlatform,
  extractHandle,
  isLikelyUrl,
} from "@/lib/inspiration/platform";
import { guessCreatorForVideo } from "@/lib/inspiration/relations";
import type { InspirationKind, ResolvedLink } from "@/lib/inspiration/types";

const COPY: Record<InspirationKind, { help: string; placeholder: string }> = {
  video: {
    help: "Paste a YouTube, TikTok, or Instagram video. We grab the title, thumbnail, and transcript when available.",
    placeholder: "https://youtube.com/watch?v=…",
  },
  creator: {
    help: "Paste a creator's profile link. We save their handle and avatar, and connect any of their videos you save.",
    placeholder: "https://instagram.com/creator",
  },
};

export default function AddLinkDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { pillars, items, activePillarId, addItem, refreshCreator } =
    useInspiration();
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<InspirationKind>("video");
  const [pillarId, setPillarId] = useState<string | null>(activePillarId);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ResolvedLink | null>(null);
  const [note, setNote] = useState("");
  const [creatorItemId, setCreatorItemId] = useState<string | null>(null);

  const creators = useMemo(
    () => items.filter((it) => it.kind === "creator"),
    [items],
  );

  // Once a video preview resolves, best-guess which saved creator it belongs to.
  useEffect(() => {
    if (kind === "video" && preview && creatorItemId === null) {
      const guess = guessCreatorForVideo(
        { author: preview.author, handle: preview.handle, url },
        creators,
      );
      if (guess) setCreatorItemId(guess);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, kind]);

  if (!open) return null;

  const reset = () => {
    setUrl("");
    setPreview(null);
    setStatus("idle");
    setError("");
    setNote("");
    setCreatorItemId(null);
  };

  const onUrlChange = (next: string) => {
    setUrl(next);
    setPreview(null);
    // Auto-follow the URL's shape until the user overrides the toggle.
    if (isLikelyUrl(next)) setKind(detectKind(next));
  };

  const resolve = async () => {
    if (!isLikelyUrl(url)) {
      setStatus("error");
      setError("Paste a full link (https://...)");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/inspiration/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.ok) throw new Error("resolve failed");
      const data = (await res.json()) as ResolvedLink;
      setPreview(data);
      setStatus("idle");
    } catch {
      // Even if resolution fails, let the user save the raw link.
      const handle = extractHandle(url) ?? undefined;
      setPreview({
        kind,
        platform: detectPlatform(url),
        title: handle ? `@${handle}` : url.trim(),
        handle,
      });
      setStatus("idle");
    }
  };

  const save = () => {
    if (!preview) return;
    // The toggle wins over auto-detection: coerce the preview to the chosen
    // bucket, dropping video-only fields when saving as a creator.
    const resolved: ResolvedLink =
      kind === "creator"
        ? { ...preview, kind, transcript: undefined }
        : { ...preview, kind };
    const trimmedUrl = url.trim();
    const id = addItem(trimmedUrl, resolved, pillarId, {
      note,
      creatorItemId: creatorItemId ?? undefined,
    });
    // Kick off the Apify scrape immediately so the creator's feed + outliers are
    // ready by the time they open the profile.
    if (kind === "creator") {
      void refreshCreator({
        id,
        kind: "creator",
        url: trimmedUrl,
        thumbnail: resolved.thumbnail,
        title: resolved.title,
      });
    }
    reset();
    onClose();
  };

  const isCreator = kind === "creator";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="border-border bg-card w-full max-w-lg rounded-3xl border p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-lg font-black">
            Add inspiration
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-foreground/50 hover:text-foreground rounded-lg p-1"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4">
          <KindToggle value={kind} onChange={setKind} />
        </div>

        <p className="text-foreground/55 mt-3 text-sm">{COPY[kind].help}</p>

        <div className="mt-4 flex gap-2">
          <input
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") resolve();
            }}
            placeholder={COPY[kind].placeholder}
            autoFocus
            className="border-border bg-background text-foreground focus:border-foreground/40 min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none"
          />
          <button
            type="button"
            onClick={resolve}
            disabled={status === "loading"}
            className="bg-foreground text-background inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {status === "loading" && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Fetch
          </button>
        </div>
        {status === "error" && (
          <p className="mt-2 text-xs font-bold text-red-500">{error}</p>
        )}

        {preview && (
          <div className="border-border mt-4 flex gap-3 rounded-2xl border p-3">
            <div
              className={`bg-muted relative shrink-0 overflow-hidden ${
                isCreator
                  ? "h-16 w-16 rounded-full"
                  : "aspect-video w-32 rounded-lg"
              }`}
            >
              {preview.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.thumbnail}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : isCreator ? (
                <span className="flex h-full w-full items-center justify-center bg-[color:var(--sg-accent)]/15 text-lg font-black text-[color:var(--sg-accent)]">
                  {(preview.handle || preview.title || "?")
                    .replace(/[^a-z0-9]/gi, "")
                    .charAt(0)
                    .toUpperCase() || "?"}
                </span>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <PlatformBadge platform={preview.platform} />
              <p className="text-foreground mt-1 line-clamp-2 text-sm font-bold">
                {preview.title}
              </p>
              <p className="text-foreground/55 mt-1 text-xs">
                {isCreator
                  ? "Saved as a creator"
                  : preview.transcript
                    ? "Transcript captured"
                    : "No transcript available"}
              </p>
            </div>
          </div>
        )}

        {/* Optional context — type it or dictate it */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-foreground/55 text-xs font-bold">
              {isCreator
                ? "Why this creator? (optional)"
                : "Add context (optional)"}
            </span>
            <VoiceNoteButton
              onText={(t) => setNote((prev) => (prev ? `${prev} ${t}` : t))}
            />
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              isCreator
                ? "What do they do well? What should I learn from them?"
                : "What's the hook? Why does it work? What would you steal?"
            }
            rows={2}
            className="border-border bg-background text-foreground focus:border-foreground/40 w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none select-text"
          />
        </div>

        {/* Attribute a clip to one of your saved creators */}
        {!isCreator && creators.length > 0 && (
          <div className="mt-4">
            <span className="text-foreground/55 mb-1.5 block text-xs font-bold">
              From creator (optional)
            </span>
            <select
              value={creatorItemId ?? ""}
              onChange={(e) => setCreatorItemId(e.target.value || null)}
              className="border-border bg-background text-foreground/80 w-full cursor-pointer rounded-xl border px-3 py-2.5 text-sm"
            >
              <option value="">Not attributed</option>
              {creators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <select
            value={pillarId ?? ""}
            onChange={(e) => setPillarId(e.target.value || null)}
            className="border-border bg-background text-foreground/80 flex-1 cursor-pointer rounded-xl border px-3 py-2.5 text-sm"
          >
            <option value="">Unsorted</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={save}
            disabled={!preview}
            className="bg-foreground text-background rounded-xl px-5 py-2.5 text-sm font-black transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
