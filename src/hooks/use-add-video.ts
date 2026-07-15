"use client";

import { useState } from "react";
import {
  createContent,
  patchContent,
  type ContentDetail,
} from "@/lib/content/client";

export type AddVideoState = "idle" | "uploading" | "error";
export type AddVideoError = "storage_full" | "locked" | "not_video" | "failed";

/**
 * Bring a finished video into the library as a new content item with a master
 * video: create the item, upload the file to R2, register it, link it. The
 * back-catalog / "I just want to post this" entry point, distinct from the
 * idea → script → record flow.
 */
export function useAddVideo(onAdded: (item: ContentDetail) => void) {
  const [state, setState] = useState<AddVideoState>("idle");
  const [error, setError] = useState<AddVideoError | null>(null);

  const add = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      setError("not_video");
      setState("error");
      return;
    }
    setState("uploading");
    setError(null);
    try {
      const title = file.name.replace(/\.[^.]+$/, "") || "Untitled video";
      const item = await createContent({ title });

      const mimeType = file.type || "video/mp4";
      const ext = mimeType.split("/")[1]?.split(";")[0] || "mp4";
      const presign = await fetch("/api/media/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sizeBytes: file.size, mimeType, ext }),
      });
      if (presign.status === 402) throw new Error("storage_full");
      if (!presign.ok) throw new Error("failed");
      const { url, key } = (await presign.json()) as {
        url: string;
        key: string;
      };

      const put = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: file,
      });
      if (!put.ok) throw new Error("failed");

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

      const linked = await patchContent(item.id, {
        submissionId: regData.submission.id,
      });
      setState("idle");
      onAdded(linked);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "failed";
      setError(
        msg === "storage_full" || msg === "locked"
          ? (msg as AddVideoError)
          : "failed",
      );
      setState("error");
    }
  };

  return { state, error, add };
}
