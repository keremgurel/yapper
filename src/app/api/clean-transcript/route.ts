import { cutsFromCleanedText } from "@/lib/studio/align-transcript";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AI "remove mistakes" pass. The model is given the transcript as plain speech
 * and returns the CLEANED speech (final takes only) — not token indices. Asking
 * for cleaned text instead of index ranges is dramatically more reliable:
 * counting token positions is exactly what LLMs are bad at, and a single
 * off-by-one there deletes real words. We then align the cleaned text back onto
 * the original words (right-anchored, so a restated line maps to its LAST
 * attempt) to derive the cut ranges. Responds 501 when no key is set; nothing is
 * auto-applied without the client also validating each cut.
 */
export async function POST(req: Request): Promise<Response> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) return Response.json({ error: "no_provider" }, { status: 501 });
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.AI_CLEAN_MODEL ?? "gpt-5.4";

  const { words } = (await req.json()) as { words?: { text: string }[] };
  if (!Array.isArray(words) || words.length === 0) {
    return Response.json({ cuts: [] });
  }

  const rawText = words.map((w) => w.text).join(" ");
  const system =
    "You clean a spoken-word transcript for a talking-head video. The speaker " +
    "often restarts a sentence several times (with slightly different words or " +
    "numbers) before getting it right, and stutters or repeats words " +
    "mid-sentence.\n\n" +
    "Return ONLY the final, clean version of the speech:\n" +
    "- For each restarted line, keep the LAST complete attempt and drop all " +
    "earlier ones.\n" +
    "- Remove mid-sentence stutters, false starts, and duplicated words.\n" +
    "- NEVER drop a sentence that is only said once — if it appears a single " +
    "time it is real content, keep it even if it sounds like a new topic.\n" +
    "- Do NOT paraphrase, reword, fix grammar, or change numbers. Output the " +
    "speaker's EXACT words, just with the retakes and stutters removed.\n\n" +
    "Output plain text only — no quotes, labels, or commentary.";

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: rawText },
        ],
      }),
    });
    if (!res.ok) {
      return Response.json({ error: `ai_${res.status}` }, { status: 502 });
    }
    const json = await res.json();
    const cleaned: string = json?.choices?.[0]?.message?.content ?? "";
    if (!cleaned.trim()) return Response.json({ cuts: [] });
    return Response.json({ cuts: cutsFromCleanedText(words, cleaned) });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "ai_failed" },
      { status: 502 },
    );
  }
}
