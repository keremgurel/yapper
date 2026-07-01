import type { Word } from "@/lib/studio/types";

/**
 * Ask the backend AI pass which token-index ranges are mistakes to cut.
 * Returns null when the backend has no LLM key configured (HTTP 501).
 */
export async function cleanTranscriptRemote(
  words: Word[],
): Promise<[number, number][] | null> {
  const res = await fetch("/api/clean-transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ words: words.map((w) => ({ text: w.text })) }),
  });
  if (res.status === 501) return null;
  if (!res.ok) throw new Error(`clean_${res.status}`);
  const data = (await res.json()) as { cuts?: [number, number][] };
  return data.cuts ?? [];
}
