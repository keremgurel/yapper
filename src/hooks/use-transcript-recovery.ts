"use client";

import { useState } from "react";
import type { ContentPatch } from "@/lib/content/client";

export type RecoveryError =
  | "resolve_failed"
  | "still_no_media"
  | "transcribe_failed"
  | "empty";

/**
 * The three ways to get a transcript onto a reference the app could not hear.
 *
 * They are one concern, not three: each ends in the same patch, and only one
 * can be in flight at a time, so they share `busy` and the error slot rather
 * than each carrying its own.
 *
 * - `retry` asks the resolver again. Worth offering because the usual cause is
 *   a depleted scraper or a rate limit, both of which pass.
 * - `attach` runs the creator's own file through the ASR we already own.
 * - `paste` takes their word for it, which always works and needs no provider.
 */
export function useTranscriptRecovery(
  sourceUrl: string | null,
  update: (patch: ContentPatch) => void,
) {
  const [busy, setBusy] = useState<"retry" | "attach" | "paste" | null>(null);
  const [error, setError] = useState<RecoveryError | null>(null);

  /** Resolves true only when the transcript actually landed, so a caller can
   * clear its input on success without discarding text a failed save still
   * needs to hold on to. */
  const run = async (
    kind: "retry" | "attach" | "paste",
    work: () => Promise<RecoveryError | null>,
  ): Promise<boolean> => {
    if (busy) return false;
    setBusy(kind);
    setError(null);
    try {
      const failure = await work();
      setError(failure);
      return failure === null;
    } catch {
      setError(kind === "retry" ? "resolve_failed" : "transcribe_failed");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const retry = () =>
    run("retry", async () => {
      if (!sourceUrl) return "resolve_failed";
      const res = await fetch("/api/inspiration/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });
      if (!res.ok) return "resolve_failed";
      const data = (await res.json()) as { transcript?: string };
      const transcript = data.transcript?.trim();
      // A retry that still cannot hear the video is not an error state to shout
      // about; it is the same answer as before, so say so and leave the other
      // two routes open.
      if (!transcript) return "still_no_media";
      update({ sourceTranscript: transcript, transcriptStatus: "ready" });
      return null;
    });

  const attach = (file: File) =>
    run("attach", async () => {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": file.type || "audio/wav" },
        body: await file.arrayBuffer(),
      });
      if (!res.ok) return "transcribe_failed";
      const data = (await res.json()) as { words?: { word?: string }[] };
      const text = (data.words ?? [])
        .map((w) => w.word ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) return "empty";
      update({ sourceTranscript: text, transcriptStatus: "ready" });
      return null;
    });

  const paste = (text: string) =>
    run("paste", async () => {
      const transcript = text.trim();
      if (!transcript) return "empty";
      update({ sourceTranscript: transcript, transcriptStatus: "ready" });
      return null;
    });

  return { busy, error, retry, attach, paste };
}
