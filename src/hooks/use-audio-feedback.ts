"use client";

import { useState } from "react";
import { decodeToMono16k } from "@/lib/studio/audio-decode";
import { encodeWav } from "@/lib/studio/wav";
import type { Coaching } from "@/lib/feedback/coach";
import type { DeliveryMetrics } from "@/lib/feedback/metrics";

export type FeedbackTier = "audio" | "video" | "full";

export interface FeedbackData {
  submissionId: string;
  balance: number;
  metrics?: DeliveryMetrics;
  coaching: Coaching;
}

export type FeedbackStatus =
  | "idle"
  | "preparing"
  | "uploading"
  | "analyzing"
  | "done"
  | "error";

export type FeedbackError =
  | "insufficient_credits"
  | "no_speech"
  | "storage_full"
  | "failed"
  | null;

async function wavFrom(sourceUrl: string): Promise<Blob> {
  return encodeWav(await decodeToMono16k(sourceUrl), 16000);
}

// Upload the recording to R2 via a presigned PUT (browser-CORS friendly). The
// server later pulls it from R2 to hand to Gemini, and keeps it for re-watch.
// Returns the R2 object key. Throws "storage_full" when over quota.
async function uploadVideo(
  sourceUrl: string,
): Promise<{ mediaKey: string; mimeType: string }> {
  const blob = await fetch(sourceUrl).then((r) => r.blob());
  const mimeType = blob.type || "video/webm";
  const ext = mimeType.split("/")[1]?.split(";")[0] || "webm";
  const res = await fetch("/api/media/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sizeBytes: blob.size, mimeType, ext }),
  });
  if (res.status === 402) throw new Error("storage_full");
  if (!res.ok) throw new Error("upload_start_failed");
  const { url, key } = await res.json();
  const put = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: blob,
  });
  if (!put.ok) throw new Error("upload_failed");
  return { mediaKey: key, mimeType };
}

/**
 * Runs a feedback request for the chosen tier. Audio decodes to WAV and POSTs;
 * video/full upload the clip to Gemini first, then request analysis. The server
 * stays the source of truth (credits, storage, coaching).
 */
export function useFeedback(sourceUrl?: string) {
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [data, setData] = useState<FeedbackData | null>(null);
  const [error, setError] = useState<FeedbackError>(null);

  const run = async (tier: FeedbackTier) => {
    if (!sourceUrl) return;
    setStatus("preparing");
    setError(null);
    try {
      let url = `/api/feedback?tier=${tier}`;
      let body: Blob | undefined;

      if (tier === "video" || tier === "full") {
        setStatus("uploading");
        const { mediaKey, mimeType } = await uploadVideo(sourceUrl);
        url += `&mediaKey=${encodeURIComponent(mediaKey)}&mimeType=${encodeURIComponent(mimeType)}`;
        if (tier === "full") body = await wavFrom(sourceUrl);
      } else {
        body = await wavFrom(sourceUrl);
      }

      setStatus("analyzing");
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "audio/wav" } : undefined,
        body,
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setData(json as FeedbackData);
        setStatus("done");
        return;
      }
      setStatus("error");
      if (res.status === 402) setError("insufficient_credits");
      else if (json?.detail === "no_speech") setError("no_speech");
      else setError("failed");
    } catch (e) {
      setStatus("error");
      setError(
        e instanceof Error && e.message === "storage_full"
          ? "storage_full"
          : "failed",
      );
    }
  };

  const reset = () => {
    setStatus("idle");
    setData(null);
    setError(null);
  };

  return { status, data, error, run, reset };
}
