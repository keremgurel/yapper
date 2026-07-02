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
  | "failed"
  | null;

async function wavFrom(sourceUrl: string): Promise<Blob> {
  return encodeWav(await decodeToMono16k(sourceUrl), 16000);
}

// Upload the recording straight to Gemini via a server-minted resumable URL,
// so the big file never passes through our function. Returns the file uri.
async function uploadVideo(
  sourceUrl: string,
): Promise<{ fileUri: string; mimeType: string }> {
  const blob = await fetch(sourceUrl).then((r) => r.blob());
  const mimeType = blob.type || "video/webm";
  const res = await fetch("/api/gemini/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sizeBytes: blob.size, mimeType }),
  });
  if (!res.ok) throw new Error("upload_start_failed");
  const { uploadUrl } = await res.json();
  const put = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: blob,
  });
  if (!put.ok) throw new Error("upload_failed");
  const fileUri = (await put.json())?.file?.uri;
  if (!fileUri) throw new Error("upload_failed");
  return { fileUri, mimeType };
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
        const { fileUri, mimeType } = await uploadVideo(sourceUrl);
        url += `&fileUri=${encodeURIComponent(fileUri)}&mimeType=${encodeURIComponent(mimeType)}`;
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
    } catch {
      setStatus("error");
      setError("failed");
    }
  };

  const reset = () => {
    setStatus("idle");
    setData(null);
    setError(null);
  };

  return { status, data, error, run, reset };
}
