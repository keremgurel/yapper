export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * AI "remove mistakes" pass. Given the transcript as index:word tokens, a hosted
 * LLM (via Surplus, OpenAI-compatible) returns inclusive token-index ranges to
 * cut: false starts, restarted sentences (keep the final take), stumbles, and
 * self-corrections. Responds 501 when no key is set. Nothing is auto-applied —
 * the client marks these ranges as struck-through for review.
 */
export async function POST(req: Request): Promise<Response> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) return Response.json({ error: "no_provider" }, { status: 501 });
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.AI_CLEAN_MODEL ?? "gpt-5.4-mini";

  const { words } = (await req.json()) as { words?: { text: string }[] };
  if (!Array.isArray(words) || words.length === 0) {
    return Response.json({ cuts: [] });
  }

  const numbered = words.map((w, i) => `${i}:${w.text}`).join(" ");
  const system =
    "You are an expert video editor cleaning a spoken transcript so only the " +
    "final, clean performance remains. You receive tokens as index:word.\n\n" +
    "Cut, aggressively: RETAKES (when the speaker says a line, then restarts " +
    "and says a similar line again — cut EVERY earlier attempt and keep only " +
    "the LAST, most complete version), false starts, stumbles, filler words, " +
    "accidental repeats, and self-corrections.\n\n" +
    "Rules: keep all unique, correct content; keep the final version of any " +
    "restarted sentence; a retake usually reuses most of the same words, so " +
    "cut the whole earlier attempt (a partial cut that leaves half a sentence " +
    "is wrong). When several attempts of the same line occur in a row, cut " +
    "from the start of the first attempt through the end of the token just " +
    "before the final attempt begins.\n\n" +
    "Worked example. Tokens: 0:You 1:can 2:transcribe 3:the 4:video 5:and " +
    "6:cut 7:silences. 8:You 9:can 10:transcribe 11:a 12:video 13:and 14:cut " +
    "15:in 16:silences. 17:Here 18:you 19:can 20:transcribe 21:a 22:video " +
    "23:and 24:cut 25:mistakes. -> The last attempt starts at 17 (Here), so " +
    'cut both earlier attempts: {"cuts":[[0,16]]}.\n\n' +
    "Respond with strict JSON only.";
  const user =
    `Tokens:\n${numbered}\n\n` +
    `Return {"cuts":[[startIndex,endIndex], ...]} with inclusive index ranges ` +
    `to remove. Return {"cuts":[]} only if the transcript is already clean.`;

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
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      return Response.json({ error: `ai_${res.status}` }, { status: 502 });
    }
    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "{}";
    return Response.json({ cuts: parseCuts(content, words.length) });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "ai_failed" },
      { status: 502 },
    );
  }
}

/** Salvage the {"cuts":[...]} array from the model output, clamped to range. */
function parseCuts(content: string, count: number): [number, number][] {
  const s = content.indexOf("{");
  const e = content.lastIndexOf("}");
  if (s < 0 || e <= s) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.slice(s, e + 1));
  } catch {
    return [];
  }
  const raw = (parsed as { cuts?: unknown })?.cuts;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (r): r is [number, number] =>
        Array.isArray(r) &&
        r.length === 2 &&
        Number.isInteger(r[0]) &&
        Number.isInteger(r[1]),
    )
    .map(
      (r) => [Math.max(0, r[0]), Math.min(count - 1, r[1])] as [number, number],
    )
    .filter(([a, b]) => a <= b);
}
