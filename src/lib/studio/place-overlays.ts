import type { Placement } from "@/lib/studio/overlay-plan";
import type { MediaAsset, Word } from "@/lib/studio/types";

/**
 * Ask the backend which stretch of speech each named file belongs over. Returns
 * null when the backend has no LLM key configured (HTTP 501).
 *
 * Only the transcript's text goes over the wire. The word timings, the media,
 * and the timeline stay in the browser: what comes back is quotes, and the
 * client alone decides what seconds they mean.
 */
export async function placeOverlaysRemote(
  instruction: string,
  words: Word[],
  files: MediaAsset[],
): Promise<Placement[] | null> {
  const res = await fetch("/api/place-overlays", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instruction,
      words: words.map((w) => ({ text: w.text })),
      files: files.map((f) => ({
        name: f.name,
        kind: f.kind,
        duration: f.duration,
      })),
    }),
  });
  if (res.status === 501) return null;
  if (!res.ok) throw new Error(`place_${res.status}`);
  const data = (await res.json()) as { placements?: Placement[] };
  return data.placements ?? [];
}
