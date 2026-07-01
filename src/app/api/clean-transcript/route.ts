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
    "You clean up a spoken-video transcript for editing. You receive tokens as " +
    "index:word. Identify ONLY the tokens that are mistakes to cut: false " +
    "starts, restarted sentences (keep the final, cleanest take and cut the " +
    "earlier attempts), stumbles, accidental word repeats, and self-" +
    "corrections. Never cut correct content, and never cut the final clean " +
    "version of a restarted sentence. Respond with strict JSON only.";
  const user =
    `Tokens:\n${numbered}\n\n` +
    `Return {"cuts":[[startIndex,endIndex], ...]} with inclusive index ranges ` +
    `to remove. Return {"cuts":[]} if nothing should be cut.`;

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
