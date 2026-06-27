"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import PlatformBadge from "@/components/inspiration/platform-badge";
import { useInspiration } from "@/components/inspiration/inspiration-context";
import { detectPlatform, isLikelyUrl } from "@/lib/inspiration/platform";
import type { ResolvedLink } from "@/lib/inspiration/types";

export default function AddLinkDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { pillars, activePillarId, addItem } = useInspiration();
  const [url, setUrl] = useState("");
  const [pillarId, setPillarId] = useState<string | null>(activePillarId);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ResolvedLink | null>(null);

  if (!open) return null;

  const reset = () => {
    setUrl("");
    setPreview(null);
    setStatus("idle");
    setError("");
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
      setPreview({
        platform: detectPlatform(url),
        title: url.trim(),
      });
      setStatus("idle");
    }
  };

  const save = () => {
    if (!preview) return;
    addItem(url.trim(), preview, pillarId);
    reset();
    onClose();
  };

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
        <p className="text-foreground/55 mt-1 text-sm">
          Paste a YouTube, TikTok, or Instagram link. We grab the title,
          thumbnail, and transcript when available.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setPreview(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") resolve();
            }}
            placeholder="https://..."
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
            <div className="bg-muted relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg">
              {preview.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.thumbnail}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <PlatformBadge platform={preview.platform} />
              <p className="text-foreground mt-1 line-clamp-2 text-sm font-bold">
                {preview.title}
              </p>
              <p className="text-foreground/55 mt-1 text-xs">
                {preview.transcript
                  ? "Transcript captured"
                  : "No transcript available"}
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-2">
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
