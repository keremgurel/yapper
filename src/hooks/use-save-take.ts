"use client";

import { useRef, useState } from "react";
import { patchContent } from "@/lib/content/client";

export type SaveTakeState = "idle" | "saving" | "saved" | "error";
export type SaveTakeError = "storage_full" | "locked" | "failed" | null;

/**
 * Persist a recorded take to a Content Library item: presigned PUT to R2,
 * register it as a (feedback-less) submission, then link it on the item.
 * One concern: the save pipeline + its state.
 *
 * The registered submission id is held across attempts, so a retry after the
 * final link step failed only re-runs the link. It never re-uploads or
 * re-registers (which would create an orphan submission and re-count storage).
 */
export function useSaveTake(itemId: string | null) {
  const [state, setState] = useState<SaveTakeState>("idle");
  const [error, setError] = useState<SaveTakeError>(null);
  const registeredRef = useRef<string | null>(null);

  const save = async (blob: Blob, title?: string) => {
    if (!itemId || state === "saving" || state === "saved") return;
    setState("saving");
    setError(null);
    try {
      if (!registeredRef.current) {
        const mimeType = blob.type || "video/webm";
        const ext = mimeType.split("/")[1]?.split(";")[0] || "webm";

        const presign = await fetch("/api/media/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sizeBytes: blob.size, mimeType, ext }),
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
          body: blob,
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
        registeredRef.current = regData.submission.id;
      }

      await patchContent(itemId, { submissionId: registeredRef.current });
      setState("saved");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "failed";
      setError(msg === "storage_full" || msg === "locked" ? msg : "failed");
      setState("error");
    }
  };

  return { state, error, save };
}
