/**
 * Fetch the recording linked to a Content Library item as a Blob for the
 * editor: item -> its submission -> signed R2 URL -> bytes. Returns null when
 * any link in the chain is missing (no recording, deleted submission, signed
 * out); throws only on a mid-chain network/CORS failure so the caller can
 * surface it.
 *
 * Note: fetching the bytes needs the R2 bucket CORS to allow GET from the app
 * origin (playback via <video src> does not, so this is a separate requirement).
 */
export async function loadLinkedRecording(
  itemId: string,
): Promise<{ blob: Blob; name: string } | null> {
  const itemRes = await fetch(`/api/content/${itemId}`);
  if (!itemRes.ok) return null;
  const { item } = (await itemRes.json()) as {
    item: { title: string; submissionId: string | null };
  };
  if (!item.submissionId) return null;

  const subRes = await fetch(`/api/submissions/${item.submissionId}`);
  if (!subRes.ok) return null;
  const { submission } = (await subRes.json()) as {
    submission: { mediaKey: string | null };
  };
  if (!submission.mediaKey) return null;

  const signRes = await fetch(
    `/api/media/sign?key=${encodeURIComponent(submission.mediaKey)}`,
  );
  if (!signRes.ok) return null;
  const { url } = (await signRes.json()) as { url: string };

  const media = await fetch(url);
  if (!media.ok) throw new Error("recording_fetch_failed");
  const blob = await media.blob();
  return { blob, name: item.title.trim() || "Library take" };
}
