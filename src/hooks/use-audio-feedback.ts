"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { decodeToMono16k } from "@/lib/studio/audio-decode";
import { sourceBlobForUrl } from "@/lib/studio/source-blob";
import type { StudioSource } from "@/lib/studio/types";
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
  | "not_entitled"
  | "no_speech"
  | "storage_full"
  | "failed"
  | null;

const MAX_FEEDBACK_VIDEO_BYTES = 250 * 1024 * 1024;
const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

interface FeedbackRunLease {
  id: number;
  controller: AbortController;
}

/** Owns exactly one feedback run and fences stale async completions. */
export class FeedbackRunFence {
  private nextId = 0;
  private current: FeedbackRunLease | null = null;

  begin(): FeedbackRunLease {
    this.cancel("feedback_superseded");
    const lease = { id: ++this.nextId, controller: new AbortController() };
    this.current = lease;
    return lease;
  }

  owns(lease: FeedbackRunLease): boolean {
    return this.current?.id === lease.id;
  }

  finish(lease: FeedbackRunLease): void {
    if (this.owns(lease)) this.current = null;
  }

  cancel(reason = "feedback_cancelled"): void {
    this.current?.controller.abort(reason);
    this.current = null;
  }
}

function canonicalVideoMime(blob: Blob, name: string): string {
  const declared = blob.type.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (VIDEO_MIME_TYPES.has(declared)) return declared;
  const extension = name.toLowerCase().split(".").pop();
  if (extension === "mp4" || extension === "m4v") return "video/mp4";
  if (extension === "mov") return "video/quicktime";
  if (extension === "webm") return "video/webm";
  throw new Error("unsupported_video");
}

/** Resolve the original source Blob when available. A fallback fetch remains
 * for native/linked sources, but is size-checked before and after buffering. */
export async function feedbackSourceBlob(
  source: Pick<StudioSource, "url" | "name">,
  signal: AbortSignal,
): Promise<{ blob: Blob; mimeType: string }> {
  signal.throwIfAborted();
  let blob = sourceBlobForUrl(source.url);
  if (!blob) {
    const response = await fetch(source.url, { signal });
    if (!response.ok) throw new Error("source_read_failed");
    const declared = response.headers.get("content-length");
    if (declared && /^\d+$/.test(declared)) {
      const bytes = Number(declared);
      if (!Number.isSafeInteger(bytes) || bytes > MAX_FEEDBACK_VIDEO_BYTES) {
        void response.body?.cancel().catch(() => undefined);
        throw new Error("video_too_large");
      }
    }
    blob = await response.blob();
  }
  signal.throwIfAborted();
  if (blob.size <= 0) throw new Error("empty_video");
  if (blob.size > MAX_FEEDBACK_VIDEO_BYTES) throw new Error("video_too_large");
  return { blob, mimeType: canonicalVideoMime(blob, source.name) };
}

async function wavFrom(sourceUrl: string, signal: AbortSignal): Promise<Blob> {
  const samples = await decodeToMono16k(sourceUrl, signal);
  signal.throwIfAborted();
  return encodeWav(samples, 16000);
}

async function uploadVideo(
  source: Pick<StudioSource, "url" | "name">,
  signal: AbortSignal,
): Promise<{ mediaKey: string; mimeType: string }> {
  const { blob, mimeType } = await feedbackSourceBlob(source, signal);
  const ext = mimeType === "video/webm" ? "webm" : "mp4";
  const response = await fetch("/api/media/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sizeBytes: blob.size,
      mimeType,
      ext,
      purpose: "recording",
    }),
    signal,
  });
  if (response.status === 402) throw new Error("storage_full");
  if (!response.ok) throw new Error("upload_start_failed");
  const value = (await response.json()) as { url?: unknown; key?: unknown };
  if (typeof value.url !== "string" || typeof value.key !== "string") {
    throw new Error("upload_start_failed");
  }
  signal.throwIfAborted();
  const upload = await fetch(value.url, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: blob,
    signal,
  });
  if (!upload.ok) throw new Error("upload_failed");
  return { mediaKey: value.key, mimeType };
}

function feedbackError(error: unknown): FeedbackError {
  if (!(error instanceof Error)) return "failed";
  if (error.message === "storage_full") return "storage_full";
  if (error.message === "not_entitled") return "not_entitled";
  if (error.message === "insufficient_credits") return "insufficient_credits";
  if (error.message === "no_speech") return "no_speech";
  return "failed";
}

export async function executeFeedback(
  source: Pick<StudioSource, "url" | "name">,
  tier: FeedbackTier,
  signal: AbortSignal,
  onStatus: (status: FeedbackStatus) => void,
): Promise<FeedbackData> {
  let url = `/api/feedback?tier=${tier}`;
  let body: Blob | undefined;

  if (tier === "video" || tier === "full") {
    onStatus("uploading");
    const uploaded = await uploadVideo(source, signal);
    url += `&mediaKey=${encodeURIComponent(uploaded.mediaKey)}&mimeType=${encodeURIComponent(uploaded.mimeType)}`;
    if (tier === "full") body = await wavFrom(source.url, signal);
  } else {
    body = await wavFrom(source.url, signal);
  }

  signal.throwIfAborted();
  onStatus("analyzing");
  const response = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "audio/wav" } : undefined,
    body,
    signal,
  });
  const value = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  signal.throwIfAborted();
  if (response.ok) return value as unknown as FeedbackData;
  if (value.error === "not_entitled") throw new Error("not_entitled");
  if (value.error === "storage_full") throw new Error("storage_full");
  if (response.status === 402) throw new Error("insufficient_credits");
  if (value.detail === "no_speech") throw new Error("no_speech");
  throw new Error("feedback_failed");
}

export function useFeedback(source: StudioSource | null) {
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [data, setData] = useState<FeedbackData | null>(null);
  const [error, setError] = useState<FeedbackError>(null);
  const fenceRef = useRef<FeedbackRunFence | null>(null);
  if (!fenceRef.current) fenceRef.current = new FeedbackRunFence();
  const latestSourceUrl = useRef(source?.url);
  latestSourceUrl.current = source?.url;

  const cancel = useCallback(() => {
    fenceRef.current?.cancel();
    setStatus("idle");
    setError(null);
  }, []);

  useEffect(() => {
    fenceRef.current?.cancel("feedback_source_changed");
    setStatus("idle");
    setData(null);
    setError(null);
  }, [source?.url]);

  useEffect(() => () => fenceRef.current?.cancel("feedback_unmounted"), []);

  const run = useCallback(
    async (tier: FeedbackTier) => {
      if (!source) return;
      const sourceUrl = source.url;
      const lease = fenceRef.current!.begin();
      const ownsCurrentSource = () =>
        fenceRef.current!.owns(lease) && latestSourceUrl.current === sourceUrl;
      setStatus("preparing");
      setData(null);
      setError(null);
      try {
        const result = await executeFeedback(
          source,
          tier,
          lease.controller.signal,
          (next) => {
            if (ownsCurrentSource()) setStatus(next);
          },
        );
        if (!ownsCurrentSource()) return;
        setData(result);
        setStatus("done");
      } catch (caught) {
        if (!ownsCurrentSource()) return;
        if (lease.controller.signal.aborted) {
          setStatus("idle");
          return;
        }
        setStatus("error");
        setError(feedbackError(caught));
      } finally {
        fenceRef.current!.finish(lease);
      }
    },
    [source],
  );

  const reset = useCallback(() => {
    fenceRef.current?.cancel();
    setStatus("idle");
    setData(null);
    setError(null);
  }, []);

  return { status, data, error, run, cancel, reset };
}
