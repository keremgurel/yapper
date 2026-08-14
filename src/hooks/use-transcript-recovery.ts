"use client";

import { useState } from "react";
import type { ContentPatch } from "@/lib/content/client";

export type RecoveryError =
  | "resolve_failed"
  | "still_no_media"
  | "transcribe_failed"
  | "empty";

export const MAX_TRANSCRIPT_RECOVERY_BYTES = 4_000_000;
const RECOVERY_MEDIA_TYPES =
  /^(audio\/(wav|x-wav|aac|mp4|x-m4a|webm|ogg|mpeg)|video\/(mp4|webm|quicktime))$/i;
const RECOVERY_EXTENSION_TYPES: Record<string, string> = {
  wav: "audio/wav",
  m4a: "audio/x-m4a",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  aac: "audio/aac",
  ogg: "audio/ogg",
};

export function transcriptRecoveryMediaType(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mediaType = file.type || RECOVERY_EXTENSION_TYPES[extension] || "";
  if (
    file.size === 0 ||
    file.size > MAX_TRANSCRIPT_RECOVERY_BYTES ||
    !RECOVERY_MEDIA_TYPES.test(mediaType)
  ) {
    return null;
  }
  return mediaType;
}

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
      const mediaType = transcriptRecoveryMediaType(file);
      // Reject from metadata before reading a byte. Passing the Blob directly
      // also avoids the previous File -> ArrayBuffer -> request-body copy.
      if (!mediaType) {
        return "transcribe_failed";
      }
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": mediaType },
        body: file,
      });
      if (!res.ok) return "transcribe_failed";
      // `/api/transcribe` returns RawWord, whose field is `text`. Reading
      // `word` here yielded undefined for every entry, so an attached file
      // always transcribed to nothing and reported an empty take.
      const data = (await res.json()) as { words?: { text?: string }[] };
      const text = (data.words ?? [])
        .map((w) => w.text ?? "")
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
