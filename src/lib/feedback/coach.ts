import type { DeliveryMetrics } from "./metrics";
import { fetchBoundedJson } from "@/lib/http/outbound";

const PROVIDER_TIMEOUT_MS = 35_000;
const MAX_COMPLETION_TOKENS = 1_000;
const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;
interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

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

const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const isUpgradeLine = (u: unknown): u is { before: string; after: string } =>
  typeof u === "object" &&
  u !== null &&
  typeof (u as Record<string, unknown>).before === "string" &&
  typeof (u as Record<string, unknown>).after === "string";

/**
 * Coerce an arbitrary parsed object into a valid Coaching, sanitizing every
 * field against untrusted model output: the score is clamped to its documented
 * 0-100 range so a hallucinated value can't overflow the delivery bar or store a
 * negative, the summary must be a real string, and the list fields drop anything
 * that isn't the shape the UI renders. Shared by the audio and video coaching
 * parsers so both sanitize identically.
 */
export function sanitizeCoaching(raw: Record<string, unknown>): Coaching {
  return {
    score:
      typeof raw.score === "number" && Number.isFinite(raw.score)
        ? Math.min(100, Math.max(0, Math.round(raw.score)))
        : 0,
    summary: typeof raw.summary === "string" ? raw.summary : "",
    strengths: strArr(raw.strengths),
    improvements: strArr(raw.improvements),
    upgradeLines: Array.isArray(raw.upgradeLines)
      ? raw.upgradeLines.filter(isUpgradeLine)
      : [],
  };
}

/** Salvage the outer {...} and JSON.parse it (tolerates fences / prose), then
 * sanitize it against untrusted model output. */
export function parseCoaching(content: string): Coaching {
  const s = content.indexOf("{");
  const e = content.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("coach_unparseable");
  return sanitizeCoaching(
    JSON.parse(content.slice(s, e + 1)) as Record<string, unknown>,
  );
}

/**
 * The LLM coaching pass over the transcript + metrics, via the Surplus gateway
 * (OpenAI-compatible; reused from the editor's clean-transcript route).
 */
export async function coachDelivery(
  transcript: string,
  metrics: DeliveryMetrics,
  signal?: AbortSignal,
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

  const { response, data } = await fetchBoundedJson<ChatCompletionResponse>(
    `${base}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    },
    {
      timeoutMs: PROVIDER_TIMEOUT_MS,
      maxBytes: MAX_PROVIDER_RESPONSE_BYTES,
      signal,
    },
  );
  if (!response.ok) throw new Error(`coach_${response.status}`);
  return parseCoaching(data.choices?.[0]?.message?.content ?? "{}");
}
