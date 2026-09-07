export async function transcribeCaptionMedia(
  mediaKey: string,
): Promise<string> {
  const response = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaKey }),
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
