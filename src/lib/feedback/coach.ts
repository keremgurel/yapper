import type { DeliveryMetrics } from "./metrics";

export interface Coaching {
  score: number; // 0-100 overall delivery
  summary: string;
  strengths: string[];
  improvements: string[];
  upgradeLines: { before: string; after: string }[];
}

const SYSTEM =
  "You are a warm, sharp speaking coach for short-form video creators " +
  "(TikTok/Reels/Shorts). You are given a transcript of someone talking to " +
  "camera plus PRE-COMPUTED delivery metrics. Do NOT recompute numbers — " +
  "reference the metrics and explain what they mean for on-camera delivery, " +
  "then coach.\n\n" +
  "Judge: hook strength (first line), clarity, pace/energy, filler habits, " +
  "pauses, and whether the point lands. Be specific and encouraging, never " +
  "generic. Quote the creator's own words.\n\n" +
  "Return STRICT JSON only, matching:\n" +
  '{"score": <0-100 overall delivery>, "summary": "<2-3 sentence read>", ' +
  '"strengths": ["..."], "improvements": ["..."], ' +
  '"upgradeLines": [{"before":"<their words>","after":"<punchier rewrite>"}]}\n' +
  "3-5 items in strengths/improvements; 2-4 upgradeLines. No prose outside JSON.";

/** Salvage the outer {...} and JSON.parse it (tolerates fences / prose). */
function parseCoaching(content: string): Coaching {
  const s = content.indexOf("{");
  const e = content.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("coach_unparseable");
  const raw = JSON.parse(content.slice(s, e + 1)) as Partial<Coaching>;
  return {
    score: typeof raw.score === "number" ? Math.round(raw.score) : 0,
    summary: raw.summary ?? "",
    strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
    improvements: Array.isArray(raw.improvements) ? raw.improvements : [],
    upgradeLines: Array.isArray(raw.upgradeLines) ? raw.upgradeLines : [],
  };
}

/**
 * The LLM coaching pass over the transcript + metrics, via the Surplus gateway
 * (OpenAI-compatible; reused from the editor's clean-transcript route).
 */
export async function coachDelivery(
  transcript: string,
  metrics: DeliveryMetrics,
): Promise<Coaching> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model = process.env.FEEDBACK_MODEL ?? "gpt-5.4-mini";

  const user =
    `Transcript:\n${transcript}\n\n` +
    `Metrics (pre-computed, do not recompute):\n${JSON.stringify(metrics)}\n\n` +
    `Coach this delivery. Return the JSON described in the system prompt.`;

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`coach_${res.status}`);
  const json = await res.json();
  return parseCoaching(json?.choices?.[0]?.message?.content ?? "{}");
}
