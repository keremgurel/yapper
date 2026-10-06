import {
  getContent,
  patchContent,
  type ContentDetail,
} from "@/lib/content/client";

export async function transcribeCaptionMedia(
  media: string | { submissionId: string },
): Promise<string> {
  const response = await fetch("/api/transcribe", {
    method: "POST",
    signal: AbortSignal.timeout(180_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      typeof media === "string" ? { mediaKey: media } : media,
    ),
  });
  if (!response.ok) throw new Error("caption_transcript_failed");
  const data = (await response.json()) as { words?: { text?: string }[] };
  const transcript = (data.words ?? [])
    .map((word) => word.text ?? "")
    .join(" ")
    .trim();
  if (!transcript) throw new Error("caption_transcript_failed");
  return transcript;
}

// Upload preparation and an explicit caption retry share one request in this
// page. A persisted "pending" flag is not proof that a request is still alive.
const preparingUploads = new Map<string, Promise<ContentDetail>>();
export function prepareUploadedCaption(
  contentItemId: string,
  submissionId: string,
): Promise<ContentDetail> {
  const key = `${contentItemId}:${submissionId}`;
  const existing = preparingUploads.get(key);
  if (existing) return existing;
  const pending = (async () => {
    const item = await getContent(contentItemId);
    if (item.submissionId !== submissionId)
      throw new Error("caption_transcript_failed");
    if (item.recordedTranscript?.trim()) return item;
    const transcript = await transcribeCaptionMedia({ submissionId });
    return patchContent(contentItemId, {
      recordedTranscript: transcript,
      transcriptStatus: "ready",
    });
  })().finally(() => preparingUploads.delete(key));
  preparingUploads.set(key, pending);
  return pending;
}
