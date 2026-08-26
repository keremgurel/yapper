"use client";

import { useCallback, useState } from "react";
import {
  createContent,
  patchContent,
  type ContentDetail,
} from "@/lib/content/client";

export type AddVideoState = "idle" | "uploading" | "preparing" | "error";
export type AddVideoError =
  | "storage_full"
  | "locked"
  | "not_video"
  | "too_large"
  | "network"
  | "failed";
export type AddVideoNotice = "transcript_failed";

const VIDEO_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
};

export function videoTypeFor(file: Pick<File, "name" | "size" | "type">) {
  if (file.size <= 0) return null;
  if (file.type.startsWith("video/")) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_TYPES[extension] ?? null;
}

async function responseError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error ?? "failed";
}

/** Upload through the presigned URL with real progress. `fetch` exposes no
 * upload progress, which made a 100 MB export look frozen for minutes. */
export function uploadPresignedFile(
  url: string,
  file: File,
  mimeType: string,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", mimeType);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(1, event.loaded / event.total));
      }
    };
    request.onerror = () => reject(new Error("network"));
    request.onabort = () => reject(new Error("network"));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new Error("failed"));
      }
    };
    request.send(file);
  });
}

/**
 * Bring a finished video into the library as a new content item with a master
 * video: create the item, upload the file to R2, register it, link it. The
 * back-catalog / "I just want to post this" entry point, distinct from the
 * idea → script → record flow.
 */
export function useAddVideo(
  onAdded: (item: ContentDetail) => void,
  onUpdated?: (item: ContentDetail) => void,
) {
  const [state, setState] = useState<AddVideoState>("idle");
  const [error, setError] = useState<AddVideoError | null>(null);
  const [notice, setNotice] = useState<AddVideoNotice | null>(null);
  const [progress, setProgress] = useState(0);

  const add = useCallback(
    async (file: File) => {
      const detectedType = videoTypeFor(file);
      if (!detectedType) {
        setError("not_video");
        setState("error");
        return;
      }
      setState("uploading");
      setError(null);
      setNotice(null);
      setProgress(0);
      try {
        const title = file.name.replace(/\.[^.]+$/, "") || "Untitled video";
        const mimeType = detectedType;
        const ext = mimeType.split("/")[1]?.split(";")[0] || "mp4";
        const presign = await fetch("/api/media/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sizeBytes: file.size,
            mimeType,
            ext,
            purpose: "recording",
          }),
        });
        if (!presign.ok) {
          const reason = await responseError(presign);
          throw new Error(
            reason === "not_entitled"
              ? "locked"
              : reason === "storage_full"
                ? "storage_full"
                : reason === "media_too_large"
                  ? "too_large"
                  : "failed",
          );
        }
        const { url, key } = (await presign.json()) as {
          url: string;
          key: string;
        };

        await uploadPresignedFile(url, file, mimeType, setProgress);

        const reg = await fetch("/api/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaKey: key, title }),
        });
        const regData = (await reg.json().catch(() => ({}))) as {
          submission?: { id: string };
          error?: string;
        };
        if (!reg.ok || !regData.submission) {
          throw new Error(
            regData.error === "not_entitled"
              ? "locked"
              : regData.error === "storage_full"
                ? "storage_full"
                : "failed",
          );
        }

        // Create the visible library row only after the media is safely stored
        // and registered. A failed upload must never leave a blank orphan idea.
        const linked = await createContent({
          title,
          submissionId: regData.submission.id,
          sourceUrl: "yapper://poster-upload",
          sourceTitle: "Poster upload",
          transcriptStatus: "pending",
        });
        onAdded(linked);

        // Hear the actual export before writing social copy. The uploaded master
        // stays in R2; the transcriber resolves it through this owner-scoped
        // submission id, so the browser never uploads 100 MB twice.
        setState("preparing");
        try {
          const transcriptResponse = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ submissionId: regData.submission.id }),
          });
          if (!transcriptResponse.ok) throw new Error("transcript_failed");
          const data = (await transcriptResponse.json()) as {
            words?: { text?: string }[];
          };
          const transcript = (data.words ?? [])
            .map((word) => word.text ?? "")
            .join(" ")
            .replace(/\s+/g, " ")
            .trim();
          if (!transcript) throw new Error("transcript_failed");
          const updated = await patchContent(linked.id, {
            sourceTranscript: transcript,
            transcriptStatus: "ready",
          });
          onUpdated?.(updated);
        } catch {
          setNotice("transcript_failed");
          const updated = await patchContent(linked.id, {
            transcriptStatus: "unavailable",
          }).catch(() => null);
          if (updated) onUpdated?.(updated);
        }
        setState("idle");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "failed";
        setError(
          msg === "storage_full" ||
            msg === "locked" ||
            msg === "too_large" ||
            msg === "network"
            ? (msg as AddVideoError)
            : "failed",
        );
        setState("error");
      }
    },
    [onAdded, onUpdated],
  );

  return { state, error, notice, progress, add };
}
